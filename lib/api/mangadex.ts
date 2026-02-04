/**
 * MangaDex API Client
 * Fallback when Consumet returns no chapters - MangaDex has public API
 */

import { axiosInstance } from './axios';
import { getChapterCached } from './chapter-cache';
import { getCached, CACHE_TTL } from '@/lib/cache';
import type { MangaChapter } from '@/types';

const MANGADEX_API = 'https://api.mangadex.org';

export interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
  };
}

export interface MangaDexChapter {
  id: string;
  attributes: {
    chapter?: string;
    title?: string;
    translatedLanguage?: string;
  };
  relationships?: Array<{
    type: string;
    id: string;
    attributes?: { name?: string };
  }>;
}

/**
 * Search MangaDex by title, return first match with AniList link or best title match
 */
export async function searchMangaDexByTitle(title: string): Promise<string | null> {
  try {
    const res = await axiosInstance.get<{ data: MangaDexManga[] }>(`${MANGADEX_API}/manga`, {
      params: {
        title: title.slice(0, 100),
        limit: 5,
        contentRating: ['safe', 'suggestive'],
      },
      timeout: 10000,
    });
    const data = res.data?.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0].id;
  } catch (err) {
    console.warn('[MangaDex] search failed:', (err as Error).message);
    return null;
  }
}

/**
 * Find MangaDex manga ID by searching title (cached 1h)
 */
export async function findMangaDexByAnilistId(
  anilistId: string,
  title: string
): Promise<string | null> {
  const key = `mangadex:anilist:${anilistId}`;
  return getCached(
    key,
    async () => {
      try {
        const res = await axiosInstance.get<{ data: MangaDexManga[] }>(`${MANGADEX_API}/manga`, {
          params: {
            title: title.slice(0, 80),
            limit: 10,
          },
          timeout: 10000,
        });
        const data = res.data?.data;
        if (!Array.isArray(data) || data.length === 0) return null;
        return data[0].id;
      } catch (err) {
        console.warn('[MangaDex] find by title failed:', (err as Error).message);
        return null;
      }
    },
    CACHE_TTL.MANGA_INFO
  );
}

/**
 * Get chapter feed for a MangaDex manga (cached 30 min)
 */
export async function getMangaDexChapters(
  mangaId: string,
  lang = 'en'
): Promise<MangaChapter[]> {
  const key = `mangadex:chapters:${mangaId}:${lang}`;
  return getCached(
    key,
    async () => {
      try {
        const res = await axiosInstance.get<{ data: MangaDexChapter[] }>(
          `${MANGADEX_API}/manga/${mangaId}/feed`,
          {
            params: {
              limit: 500,
              'translatedLanguage[]': lang,
              'order[chapter]': 'asc',
            },
            timeout: 15000,
          }
        );
        const data = res.data?.data;
        if (!Array.isArray(data) || data.length === 0) return [];

        return data.map((ch) => ({
          id: ch.id,
          chapter: ch.attributes?.chapter ?? '',
          title: ch.attributes?.title ?? undefined,
        }));
      } catch (err) {
        console.warn('[MangaDex] get chapters failed:', (err as Error).message);
        return [];
      }
    },
    CACHE_TTL.MANGA_CHAPTERS_LIST
  );
}

/** Check if ID is MangaDex UUID format */
export function isMangaDexChapterId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export interface MangaDexAtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

/**
 * Fetch chapter pages from MangaDex at-home server (with retry)
 */
async function fetchMangaDexChapterPages(
  chapterId: string
): Promise<Array<{ img: string; page: number }>> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axiosInstance.get<MangaDexAtHomeResponse>(
        `${MANGADEX_API}/at-home/server/${chapterId}`,
        { timeout: 15000 }
      );
      const { baseUrl, chapter } = res.data;
      if (!chapter?.hash) {
        console.warn('[MangaDex] No chapter hash in response');
        return [];
      }
      const files = chapter.data?.length ? chapter.data : chapter.dataSaver || [];
      const quality = chapter.data?.length ? 'data' : 'data-saver';
      const hash = chapter.hash;

      if (!files.length) {
        console.warn('[MangaDex] No page files for chapter', chapterId);
        return [];
      }

      return files.map((filename, i) => ({
        img: `${baseUrl}/${quality}/${hash}/${filename}`,
        page: i + 1,
      }));
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message;
      const status = (err as { response?: { status?: number } })?.response?.status;
      console.warn(`[MangaDex] get chapter pages attempt ${attempt}/${maxRetries}:`, msg, status ? `(HTTP ${status})` : '');
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  if (lastError) {
    console.error('[MangaDex] get chapter pages failed after retries:', lastError.message);
  }
  return [];
}

/**
 * Get chapter pages - raw fetch (no cache)
 */
export async function getMangaDexChapterPages(
  chapterId: string
): Promise<Array<{ img: string; page: number }>> {
  return fetchMangaDexChapterPages(chapterId);
}

/**
 * Get chapter pages with cache (Redis → memory only; MangaDex baseUrl expires in ~15 min)
 */
export async function getMangaDexChapterPagesCached(
  chapterId: string,
  forceRefresh = false
): Promise<Array<{ img: string; page: number }>> {
  return getChapterCached(
    chapterId,
    'mangadex',
    () => fetchMangaDexChapterPages(chapterId),
    forceRefresh,
    CACHE_TTL.MANGA_DEX_CHAPTER_PAGES
  );
}
