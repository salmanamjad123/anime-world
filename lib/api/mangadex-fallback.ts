/**
 * MangaDex browse fallback when AniList + Jikan are unavailable.
 * Uses MangaDex public API — works independently of AniList.
 */

import { axiosInstance } from './axios';
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

  const media = data.map(mapMangaDexToManga).filter((m): m is Manga => m !== null);
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
  const media = data.map(mapMangaDexToManga).filter((m): m is Manga => m !== null);

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
