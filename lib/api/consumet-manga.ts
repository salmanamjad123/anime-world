/**
 * Consumet Manga API Client
 * Fetches manga info and chapter pages from meta/anilist-manga
 */

import { axiosInstance } from './axios';
import { CONSUMET_API_URL } from '@/constants/api';
import { getChapterCached } from './chapter-cache';
import { getCached, CACHE_TTL } from '@/lib/cache';
import type { MangaInfoConsumet, MangaChapterPage, MangaChapter, Manga, MangaStatus } from '@/types';

const DEFAULT_PROVIDER = 'mangapill';
const MANGA_PROVIDERS = ['mangapill', 'mangadex', 'mangareader', 'mangahere', 'mangakakalot'] as const;

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
function normalizeChapters(raw: unknown): MangaChapter[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((ch: { id?: string; title?: string; chapter?: string }) => ({
      id: String(ch.id ?? ''),
      title: ch.title,
      chapter: ch.chapter,
    })).filter((ch) => ch.id);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, { id?: string; title?: string; chapter?: string }>;
    return Object.values(obj)
      .filter((ch) => ch && typeof ch === 'object' && ch.id)
      .map((ch) => ({
        id: String(ch.id),
        title: ch.title,
        chapter: ch.chapter,
      }));
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
  const key = `manga:info:${anilistId}:${provider}`;
  return getCached(
    key,
    async () => {
      try {
        const url = `${CONSUMET_API_URL}/meta/anilist-manga/info/${anilistId}`;
        const response = await axiosInstance.get(url, {
          params: { provider },
          timeout: 15000,
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

/**
 * Get chapter pages - raw fetch (no cache)
 */
async function fetchChapterPages(
  chapterId: string,
  provider: string
): Promise<MangaChapterPage[]> {
  const url = `${CONSUMET_API_URL}/meta/anilist-manga/read`;
  const response = await axiosInstance.get<MangaChapterPage[]>(url, {
    params: { chapterId, provider },
    timeout: 15000,
  });

  const data = response.data;
  let arr: Array<{ img?: string; page?: number }> = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as { pages?: unknown }).pages)) {
    arr = (data as { pages: Array<{ img?: string; page?: number }> }).pages;
  }
  if (arr.length > 0) {
    return arr.map((p, i) => ({
      img: p.img || '',
      page: typeof p.page === 'number' ? p.page : i + 1,
    }));
  }
  return [];
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
