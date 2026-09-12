/**
 * MangaDex API Client
 * Primary chapter source for manga (official API). Filters external-only chapters.
 */

import { axiosInstance } from './axios';
import { getChapterCached } from './chapter-cache';
import { getCached, getCachedWhen, CACHE_TTL } from '@/lib/cache';
import type { MangaChapter } from '@/types';

const MANGADEX_API = 'https://api.mangadex.org';

export interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    links?: Record<string, string | null>;
  };
}

export interface MangaDexChapter {
  id: string;
  attributes: {
    chapter?: string;
    title?: string;
    translatedLanguage?: string;
    pages?: number;
    externalUrl?: string | null;
  };
  relationships?: Array<{
    type: string;
    id: string;
    attributes?: { name?: string };
  }>;
}

function isReadableMangaDexChapter(ch: MangaDexChapter): boolean {
  const pages = ch.attributes?.pages ?? 0;
  const external = ch.attributes?.externalUrl;
  // Official/external hosts (Kodansha, etc.) have no at-home images
  if (external && String(external).trim()) return false;
  if (pages <= 0) return false;
  return true;
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
        contentRating: ['safe', 'suggestive', 'erotica'],
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
 * Find MangaDex manga ID by AniList id + title (cached 1h).
 * Prefers exact links.al match; otherwise best title candidate.
 */
export async function findMangaDexByAnilistId(
  anilistId: string,
  title: string
): Promise<string | null> {
  const key = `mangadex:anilist:v2:${anilistId}`;
  return getCached(
    key,
    async () => {
      try {
        const res = await axiosInstance.get<{ data: MangaDexManga[] }>(`${MANGADEX_API}/manga`, {
          params: {
            title: title.slice(0, 80),
            limit: 15,
            contentRating: ['safe', 'suggestive', 'erotica'],
            'order[relevance]': 'desc',
          },
          timeout: 10000,
        });
        const data = res.data?.data;
        if (!Array.isArray(data) || data.length === 0) return null;

        for (const item of data) {
          const al = item.attributes?.links?.al;
          if (al != null && String(al) === String(anilistId)) {
            return item.id;
          }
        }

        const needle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const scored = data.map((item) => {
          const titles = [
            ...Object.values(item.attributes?.title || {}),
            ...(item.attributes?.altTitles || []).flatMap((t) => Object.values(t)),
          ]
            .filter(Boolean)
            .map((t) => String(t).toLowerCase().replace(/[^\w\s]/g, '').trim());
          const exact = titles.some((t) => t === needle);
          const starts = titles.some((t) => t.startsWith(needle) || needle.startsWith(t));
          const includes = titles.some((t) => t.includes(needle) || needle.includes(t));
          const score = exact ? 3 : starts ? 2 : includes ? 1 : 0;
          return { id: item.id, score };
        });
        scored.sort((a, b) => b.score - a.score);
        if (scored[0]?.score > 0) return scored[0].id;

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
 * Get chapter feed for a MangaDex manga — only chapters with readable pages.
 */
async function fetchMangaDexChapterFeed(
  mangaId: string,
  lang?: string
): Promise<MangaChapter[]> {
  try {
    const all: MangaDexChapter[] = [];
    let offset = 0;
    const limit = 500;

    for (let page = 0; page < 4; page++) {
      const params: Record<string, string | number | string[]> = {
        limit,
        offset,
        'order[chapter]': 'asc',
        'contentRating[]': ['safe', 'suggestive', 'erotica', 'pornographic'],
        includeEmptyPages: 0,
        includeFuturePublishAt: 0,
        includeExternalUrl: 0,
      };
      if (lang) {
        params['translatedLanguage[]'] = lang;
      }

      const res = await axiosInstance.get<{ data: MangaDexChapter[]; total?: number }>(
        `${MANGADEX_API}/manga/${mangaId}/feed`,
        {
          params,
          timeout: 20000,
        }
      );
      const data = res.data?.data;
      if (!Array.isArray(data) || data.length === 0) break;
      all.push(...data);
      offset += data.length;
      const total = res.data?.total ?? all.length;
      if (offset >= total || data.length < limit) break;
    }

    if (all.length === 0) return [];

    const readable = all.filter(isReadableMangaDexChapter);
    return readable.map((ch) => ({
      id: ch.id,
      chapter: ch.attributes?.chapter ?? '',
      title: ch.attributes?.title ?? undefined,
    }));
  } catch (err) {
    console.warn('[MangaDex] get chapters failed:', (err as Error).message);
    return [];
  }
}

function dedupeChaptersByNumber(chapters: MangaChapter[]): MangaChapter[] {
  const byNumber = new Map<string, MangaChapter>();
  for (const ch of chapters) {
    const key = ch.chapter || ch.id;
    if (!byNumber.has(key)) byNumber.set(key, ch);
  }
  return Array.from(byNumber.values());
}

export async function getMangaDexChapters(
  mangaId: string,
  lang = 'en'
): Promise<MangaChapter[]> {
  const key = `mangadex:chapters:v3:${mangaId}:${lang}`;
  return getCachedWhen(
    key,
    async () => {
      let chapters = await fetchMangaDexChapterFeed(mangaId, lang);
      // Merge other languages when EN is sparse (licensed titles often have few EN uploads)
      if (lang === 'en') {
        const anyLang = dedupeChaptersByNumber(await fetchMangaDexChapterFeed(mangaId));
        if (anyLang.length > chapters.length) {
          chapters = anyLang;
        } else {
          chapters = dedupeChaptersByNumber(chapters);
        }
      } else {
        chapters = dedupeChaptersByNumber(chapters);
      }
      return chapters;
    },
    CACHE_TTL.MANGA_CHAPTERS_LIST,
    (chs) => chs.length > 0
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
      console.warn(
        `[MangaDex] get chapter pages attempt ${attempt}/${maxRetries}:`,
        msg,
        status ? `(HTTP ${status})` : ''
      );
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

export async function getMangaDexChapterPages(
  chapterId: string
): Promise<Array<{ img: string; page: number }>> {
  return fetchMangaDexChapterPages(chapterId);
}

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
