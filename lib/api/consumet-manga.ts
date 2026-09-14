/**
 * Consumet Manga API Client
 * Fetches manga info and chapter pages from meta/anilist-manga
 */

import { axiosInstance } from './axios';
import { CONSUMET_API_URL } from '@/constants/api';
import { getChapterCached } from './chapter-cache';
import { getCached, CACHE_TTL } from '@/lib/cache';
import { getMangaHereChapterPages, isMangaHereChapterId } from './mangahere';
import type { MangaInfoConsumet, MangaChapterPage, MangaChapter, Manga, MangaStatus } from '@/types';

const DEFAULT_PROVIDER = 'mangapill';
const MANGA_PROVIDERS = ['mangapill', 'mangadex', 'mangareader', 'mangahere'] as const;

function mapConsumetStatus(status?: string): MangaStatus | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s.includes('finish') || s.includes('complete')) return 'FINISHED';
  if (s.includes('publish') || s.includes('ongoing')) return 'RELEASING';
  if (s.includes('not yet')) return 'NOT_YET_RELEASED';
  if (s.includes('cancel')) return 'CANCELLED';
  return undefined;
}

/** Map Consumet meta response to our Manga shape for detail fallback */
export function mapConsumetToManga(info: MangaInfoConsumet, anilistId: string): Manga {
  const titleObj = info.title;
  const romaji =
    typeof titleObj === 'string'
      ? titleObj
      : titleObj?.romaji || titleObj?.english || 'Unknown';
  const english = typeof titleObj === 'string' ? titleObj : titleObj?.english;
  const image = info.image || '/images/anime-placeholder.svg';

  return {
    id: anilistId,
    malId: info.malId,
    title: {
      romaji,
      english,
    },
    description: info.description,
    coverImage: {
      large: image,
      medium: image,
      extraLarge: image,
    },
    genres: info.genres ?? [],
    averageScore: info.rating != null ? Math.round(info.rating * 10) : undefined,
    status: mapConsumetStatus(info.status),
    format: 'MANGA',
    chapters: info.chapters?.length,
  };
}

/**
 * Fetch manga metadata from Consumet when AniList is down.
 */
export async function getConsumetMangaMetadata(anilistId: string): Promise<Manga | null> {
  for (const provider of MANGA_PROVIDERS) {
    const info = await getMangaInfo(anilistId, provider);
    if (!info?.title) continue;
    return mapConsumetToManga(info, anilistId);
  }
  return null;
}

/** Normalize chapters from Consumet - can be array or object with numeric keys */
function extractChapterNumber(
  id: string,
  title?: string,
  chapter?: string | number
): string | undefined {
  if (chapter != null && String(chapter).trim() !== '') {
    return String(chapter).trim();
  }

  const fromTitle = title?.match(
    /(?:ch(?:apter)?\.?\s*|ep(?:isode)?\.?\s*)(\d+(?:\.\d+)?)/i
  );
  if (fromTitle?.[1]) return fromTitle[1].replace(/^0+(\d)/, '$1');

  // MangaHere-style ids: slug/c001 or slug/c1.5
  const fromId = id.match(/\/c0*(\d+(?:\.\d+)?)/i);
  if (fromId?.[1]) return fromId[1];

  // MangaPill-style: ...-chapter-1 or ...chapter-1.5
  const fromSlug = id.match(/chapter[_-]?0*(\d+(?:\.\d+)?)/i);
  if (fromSlug?.[1]) return fromSlug[1];

  return undefined;
}

function normalizeChapters(raw: unknown): MangaChapter[] {
  const mapOne = (ch: {
    id?: string;
    title?: string;
    chapter?: string | number;
  }): MangaChapter | null => {
    const id = String(ch.id ?? '');
    if (!id) return null;
    const chapter = extractChapterNumber(id, ch.title, ch.chapter);
    return {
      id,
      ...(ch.title ? { title: ch.title } : {}),
      ...(chapter ? { chapter } : {}),
    };
  };

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(mapOne).filter((ch): ch is MangaChapter => ch != null);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, { id?: string; title?: string; chapter?: string | number }>;
    return Object.values(obj)
      .filter((ch) => ch && typeof ch === 'object' && ch.id)
      .map(mapOne)
      .filter((ch): ch is MangaChapter => ch != null);
  }
  return [];
}

/**
 * Get manga info with chapters from Consumet (cached 30 min for fresh chapter list)
 */
export async function getMangaInfo(
  anilistId: string,
  provider: string = DEFAULT_PROVIDER
): Promise<MangaInfoConsumet | null> {
  const key = `manga:info:v2:${anilistId}:${provider}`;
  return getCached(
    key,
    async () => {
      try {
        const url = `${CONSUMET_API_URL}/meta/anilist-manga/info/${anilistId}`;
        const response = await axiosInstance.get(url, {
          params: { provider },
          timeout: 12000,
        });
        const data = response.data;
        if (!data) return null;
        const chapters = normalizeChapters(data.chapters ?? data.chapter ?? []);
        return {
          ...data,
          chapters: chapters.length > 0 ? chapters : undefined,
        } as MangaInfoConsumet;
      } catch (error: unknown) {
        console.error('[Consumet Manga] getMangaInfo:', (error as Error).message);
        return null;
      }
    },
    CACHE_TTL.MANGA_CHAPTERS_LIST
  );
}

function normalizePageList(data: unknown): MangaChapterPage[] {
  let arr: Array<{
    img?: string;
    page?: number;
    headerForImage?: Record<string, string> | string;
  }> = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as { pages?: unknown }).pages)) {
    arr = (data as {
      pages: Array<{
        img?: string;
        page?: number;
        headerForImage?: Record<string, string> | string;
      }>;
    }).pages;
  }
  return arr
    .map((p, i) => {
      const header =
        typeof p.headerForImage === 'string'
          ? { Referer: p.headerForImage }
          : p.headerForImage;
      return {
        img: p.img || '',
        page: typeof p.page === 'number' ? p.page : i + 1,
        ...(header ? { headerForImage: header } : {}),
      };
    })
    .filter((p) => p.img);
}

/**
 * Get chapter pages - raw fetch (no cache)
 */
async function fetchChapterPages(
  chapterId: string,
  provider: string
): Promise<MangaChapterPage[]> {
  const useMangaHere =
    provider === 'mangahere' || isMangaHereChapterId(chapterId);

  if (useMangaHere) {
    try {
      const pages = await getMangaHereChapterPages(chapterId);
      if (pages.length > 0) return pages;
    } catch (error: unknown) {
      console.error('[MangaHere] direct read:', (error as Error).message);
    }
    // Consumet mangahere/read is broken (500) and burns 20–35s on failure — skip it.
    return [];
  }

  // Prefer provider-specific route (meta/anilist-manga/read often breaks on scraper ids)
  try {
    const url = `${CONSUMET_API_URL}/manga/${provider}/read`;
    const response = await axiosInstance.get(url, {
      params: { chapterId },
      timeout: 12000,
      validateStatus: (s) => s < 500,
    });
    const pages = normalizePageList(response.data);
    if (pages.length > 0) return pages;
  } catch (error: unknown) {
    console.error('[Consumet Manga] provider read:', (error as Error).message);
  }

  try {
    const url = `${CONSUMET_API_URL}/meta/anilist-manga/read`;
    const response = await axiosInstance.get(url, {
      params: { chapterId, provider },
      timeout: 10000,
    });
    return normalizePageList(response.data);
  } catch (error: unknown) {
    console.error('[Consumet Manga] meta read:', (error as Error).message);
    return [];
  }
}

/**
 * Get chapter pages with 3-tier cache (Redis → Firestore → Consumet)
 */
export async function getChapterPages(
  chapterId: string,
  provider: string = DEFAULT_PROVIDER,
  forceRefresh = false
): Promise<MangaChapterPage[]> {
  return getChapterCached(
    chapterId,
    provider,
    () => fetchChapterPages(chapterId, provider),
    forceRefresh
  );
}

export { MANGA_PROVIDERS };
