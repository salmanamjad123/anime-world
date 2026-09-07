/**
 * MangaDex browse fallback when AniList + Jikan are unavailable.
 * Uses MangaDex public API — works independently of AniList.
 */

import { axiosInstance } from './axios';
import { getCached, CACHE_TTL } from '@/lib/cache';
import { saveStaleCache } from '@/lib/cache/stale-cache';
import type { Manga, MangaSearchResult } from '@/types';

const MANGADEX_API = 'https://api.mangadex.org';
const FALLBACK_TIMEOUT = 12_000;

interface MangaDexTitle {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    status?: string;
    year?: number;
    contentRating?: string;
    tags?: Array<{ attributes: { name: { en?: string } } }>;
    links?: Record<string, string | null>;
  };
  relationships?: Array<{
    type: string;
    id: string;
    attributes?: { fileName?: string };
  }>;
}

interface MangaDexListResponse {
  data: MangaDexTitle[];
}

function getPreferredTitle(title: Record<string, string>): string {
  return title.en || title['ja-ro'] || title.ja || Object.values(title)[0] || 'Unknown';
}

function extractAnilistId(links?: Record<string, string | null>): string | null {
  const al = links?.al;
  if (!al) return null;
  if (/^\d+$/.test(al)) return al;
  const match = al.match(/manga\/(\d+)/);
  return match ? match[1] : null;
}

function extractMalId(links?: Record<string, string | null>): number | null {
  const mal = links?.mal;
  if (!mal) return null;
  if (/^\d+$/.test(mal)) return parseInt(mal, 10);
  const match = mal.match(/manga\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function resolveCoverUrl(item: MangaDexTitle): string {
  const coverRel = item.relationships?.find((r) => r.type === 'cover_art');
  const fileName = coverRel?.attributes?.fileName;
  if (fileName) {
    return `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg`;
  }
  return '/images/anime-placeholder.svg';
}

export function mapMangaDexToManga(item: MangaDexTitle): Manga | null {
  const title = getPreferredTitle(item.attributes.title);
  const anilistId = extractAnilistId(item.attributes.links);
  const malId = extractMalId(item.attributes.links);
  const cover = resolveCoverUrl(item);
  const genres =
    item.attributes.tags
      ?.map((t) => t.attributes.name.en)
      .filter((g): g is string => !!g) ?? [];

  const id = anilistId ?? (malId ? String(malId) : null);
  if (!id) return null;

  return {
    id,
    malId: malId ?? undefined,
    mangadexId: item.id,
    title: {
      romaji: title,
      english: title,
      native: item.attributes.title.ja,
    },
    description: item.attributes.description?.en,
    coverImage: {
      large: cover,
      medium: cover,
      extraLarge: cover,
    },
    genres,
    status:
      item.attributes.status === 'completed'
        ? 'FINISHED'
        : item.attributes.status === 'ongoing'
          ? 'RELEASING'
          : undefined,
    format: 'MANGA',
  };
}

/** Persist MangaDex search/browse hits so detail pages work after AniList outage */
export async function persistMangaDexResults(items: MangaDexTitle[]): Promise<Manga[]> {
  const media: Manga[] = [];

  for (const item of items) {
    const manga = mapMangaDexToManga(item);
    if (!manga) continue;

    media.push(manga);
    await saveStaleCache(`manga:detail:${manga.id}`, { data: { Media: manga } });
    await saveStaleCache(`mangadex:uuid:${manga.id}`, item.id);
    if (manga.malId) {
      await saveStaleCache(`manga:malfor:${manga.id}`, manga.malId);
      await saveStaleCache(`manga:malmap:${manga.malId}`, manga.id);
    }
  }

  return media;
}

/** Fetch a single manga from MangaDex by UUID */
export async function getMangaDexMangaByUuid(uuid: string): Promise<Manga | null> {
  const key = `mangadex:uuid-detail:${uuid}`;

  return getCached(
    key,
    async () => {
      try {
        const response = await axiosInstance.get<{ data: MangaDexTitle }>(
          `${MANGADEX_API}/manga/${uuid}`,
          {
            params: { 'includes[]': 'cover_art' },
            timeout: FALLBACK_TIMEOUT,
          }
        );
        const item = response.data?.data;
        if (!item) return null;
        return mapMangaDexToManga(item);
      } catch (err) {
        console.warn('[MangaDex] fetch by UUID failed:', (err as Error).message);
        return null;
      }
    },
    CACHE_TTL.MANGA_INFO
  );
}

function buildResult(
  media: Manga[],
  page: number,
  perPage: number,
  totalAvailable: number
): MangaSearchResult {
  const lastPage = Math.max(1, Math.ceil(totalAvailable / perPage));
  return {
    data: {
      Page: {
        pageInfo: {
          total: totalAvailable,
          currentPage: page,
          lastPage,
          hasNextPage: page < lastPage,
          perPage,
        },
        media: media.slice(0, perPage),
      },
    },
  };
}

async function fetchMangaDexList(
  orderField: 'followedCount' | 'rating',
  page: number,
  perPage: number
): Promise<MangaSearchResult> {
  const offset = (page - 1) * perPage;
  const response = await axiosInstance.get<MangaDexListResponse>(`${MANGADEX_API}/manga`, {
    params: {
      limit: perPage,
      offset,
      [`order[${orderField}]`]: 'desc',
      'contentRating[]': ['safe', 'suggestive'],
      'includes[]': 'cover_art',
      hasAvailableChapters: true,
    },
    timeout: FALLBACK_TIMEOUT,
  });

  const data = response.data?.data ?? [];
  if (data.length === 0) {
    throw new Error('[MangaDex] Browse fallback returned no results');
  }

  const media = await persistMangaDexResults(data);
  if (media.length === 0) {
    throw new Error('[MangaDex] Browse fallback returned no catalog-linked results');
  }

  return buildResult(media, page, perPage, offset + data.length + (data.length >= perPage ? perPage : 0));
}

/**
 * Build a homepage-style list from MangaDex.
 * Prefers AniList IDs from external links when available.
 */
export async function getMangaDexBrowseList(
  page = 1,
  perPage = 20,
  variant: 'trending' | 'popular' = 'trending'
): Promise<MangaSearchResult> {
  const orderField = variant === 'popular' ? 'followedCount' : 'rating';
  return fetchMangaDexList(orderField, page, perPage);
}

/** Text search via MangaDex when AniList search is down */
export async function searchMangaDexAsList(
  query: string,
  page = 1,
  perPage = 20
): Promise<MangaSearchResult> {
  const offset = (page - 1) * perPage;
  const response = await axiosInstance.get<MangaDexListResponse>(`${MANGADEX_API}/manga`, {
    params: {
      title: query.trim().slice(0, 100),
      limit: perPage,
      offset,
      'contentRating[]': ['safe', 'suggestive'],
      'includes[]': 'cover_art',
      hasAvailableChapters: true,
    },
    timeout: FALLBACK_TIMEOUT,
  });

  const data = response.data?.data ?? [];
  const media = await persistMangaDexResults(data);

  return {
    data: {
      Page: {
        pageInfo: {
          total: media.length,
          currentPage: page,
          lastPage: media.length < perPage ? page : page + 1,
          hasNextPage: media.length >= perPage,
          perPage,
        },
        media,
      },
    },
  };
}

/**
 * Find a manga on MangaDex by MAL id (title search + link match).
 */
export async function getMangaDexByMalId(malId: string): Promise<Manga | null> {
  const key = `mangadex:mal:${malId}`;

  return getCached(
    key,
    async () => {
      const { getStaleCache } = await import('@/lib/cache/stale-cache');
      const cachedUuid = await getStaleCache<string>(`mangadex:uuid:${malId}`);
      if (cachedUuid) {
        const fromUuid = await getMangaDexMangaByUuid(cachedUuid);
        if (fromUuid) return fromUuid;
      }

      const { getJikanMangaByMalId } = await import('./jikan-manga');
      const jikan = await getJikanMangaByMalId(parseInt(malId, 10), malId);
      const searchTitle = jikan?.title?.english || jikan?.title?.romaji;
      if (!searchTitle) return null;

      try {
        const response = await axiosInstance.get<MangaDexListResponse>(`${MANGADEX_API}/manga`, {
          params: {
            title: searchTitle.slice(0, 100),
            limit: 20,
            'includes[]': 'cover_art',
            'contentRating[]': ['safe', 'suggestive', 'erotica'],
          },
          timeout: FALLBACK_TIMEOUT,
        });

        const targetMal = parseInt(malId, 10);
        for (const item of response.data?.data ?? []) {
          if (extractMalId(item.attributes.links) === targetMal) {
            const manga = mapMangaDexToManga(item);
            if (manga) {
              await saveStaleCache(`mangadex:uuid:${manga.id}`, item.id);
              await saveStaleCache(`manga:detail:${manga.id}`, { data: { Media: manga } });
              return manga;
            }
          }
        }
      } catch (err) {
        console.warn('[MangaDex] lookup by MAL id failed:', (err as Error).message);
      }

      return null;
    },
    CACHE_TTL.MANGA_INFO
  );
}

/**
 * Find a manga on MangaDex by AniList id (paginated scan of popular titles).
 */
export async function getMangaDexByAnilistId(anilistId: string): Promise<Manga | null> {
  const key = `mangadex:al:${anilistId}`;

  return getCached(
    key,
    async () => {
      const { getStaleCache } = await import('@/lib/cache/stale-cache');
      const cachedUuid = await getStaleCache<string>(`mangadex:uuid:${anilistId}`);
      if (cachedUuid) {
        const fromUuid = await getMangaDexMangaByUuid(cachedUuid);
        if (fromUuid) return fromUuid;
      }

      for (let offset = 0; offset < 300; offset += 50) {
        try {
          const response = await axiosInstance.get<MangaDexListResponse>(`${MANGADEX_API}/manga`, {
            params: {
              limit: 50,
              offset,
              'order[followedCount]': 'desc',
              'contentRating[]': ['safe', 'suggestive'],
              'includes[]': 'cover_art',
              hasAvailableChapters: true,
            },
            timeout: FALLBACK_TIMEOUT,
          });

          const data = response.data?.data ?? [];
          for (const item of data) {
            if (extractAnilistId(item.attributes.links) === anilistId) {
              return mapMangaDexToManga(item);
            }
          }

          if (data.length < 50) break;
        } catch (err) {
          console.warn('[MangaDex] lookup by AniList id failed:', (err as Error).message);
          break;
        }
      }
      return null;
    },
    CACHE_TTL.MANGA_INFO
  );
}
