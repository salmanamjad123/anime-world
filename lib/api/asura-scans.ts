/**
 * AsuraScans via Consumet manga API (title search — not AniList-mapped).
 * Best coverage for many Korean manhwa / webtoons.
 */

import { axiosInstance } from './axios';
import { CONSUMET_API_URL } from '@/constants/api';
import { getCached, CACHE_TTL } from '@/lib/cache';
import {
  mangaProviderResultMatches,
  normalizeMangaTitle,
} from '@/lib/utils/manga-title-match';
import type { MangaChapter, MangaChapterPage } from '@/types';

const PROVIDER = 'asurascans';

type AsuraSearchHit = {
  id: string;
  title: string;
  image?: string;
};

type AsuraChapter = {
  id: string;
  title?: string;
  chapterNumber?: string | number;
  chapter?: string | number;
};

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
  const fromId = id.match(/(?:chapter|ch)[_-]?0*(\d+(?:\.\d+)?)/i);
  if (fromId?.[1]) return fromId[1];
  return undefined;
}

function normalizeAsuraChapters(raw: unknown): MangaChapter[] {
  const list: AsuraChapter[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? (Object.values(raw as Record<string, AsuraChapter>) as AsuraChapter[])
      : [];

  return list
    .map((ch) => {
      const id = String(ch?.id ?? '');
      if (!id) return null;
      const chapter = extractChapterNumber(
        id,
        ch.title,
        ch.chapterNumber ?? ch.chapter
      );
      return {
        id,
        ...(ch.title ? { title: ch.title } : {}),
        ...(chapter ? { chapter } : {}),
      } satisfies MangaChapter;
    })
    .filter((ch): ch is MangaChapter => ch != null);
}

async function searchAsura(query: string): Promise<AsuraSearchHit[]> {
  try {
    const url = `${CONSUMET_API_URL}/manga/${PROVIDER}/${encodeURIComponent(query)}`;
    const res = await axiosInstance.get(url, {
      timeout: 12000,
      validateStatus: (s) => s < 500,
    });
    const results = res.data?.results;
    if (!Array.isArray(results)) return [];
    return results
      .map((r: { id?: string; title?: string; image?: string }) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        image: r.image,
      }))
      .filter((r: AsuraSearchHit) => r.id && r.title);
  } catch (err) {
    console.warn('[AsuraScans] search failed:', (err as Error).message);
    return [];
  }
}

function pickBestAsuraHit(
  hits: AsuraSearchHit[],
  expectedTitles: string[]
): AsuraSearchHit | null {
  if (hits.length === 0) return null;

  for (const hit of hits) {
    // Prefer exact/safe title match — pass id as slug sample
    if (mangaProviderResultMatches(expectedTitles, hit.title, hit.id)) {
      return hit;
    }
  }

  return null;
}

async function fetchAsuraInfo(asuraId: string): Promise<{
  title: string;
  chapters: MangaChapter[];
} | null> {
  try {
    const url = `${CONSUMET_API_URL}/manga/${PROVIDER}/info`;
    const res = await axiosInstance.get(url, {
      params: { id: asuraId },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });
    const data = res.data;
    if (!data) return null;
    const chapters = normalizeAsuraChapters(data.chapters);
    // Prefer ascending chapter order for reader UX (Asura often returns newest first)
    chapters.sort((a, b) => {
      const na = Number(a.chapter);
      const nb = Number(b.chapter);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return 0;
    });
    return {
      title: String(data.title ?? ''),
      chapters,
    };
  } catch (err) {
    console.warn('[AsuraScans] info failed:', (err as Error).message);
    return null;
  }
}

/**
 * Resolve AsuraScans chapters for an AniList title set.
 */
export async function getAsuraChaptersForTitles(
  expectedTitles: string[]
): Promise<{
  chapters: MangaChapter[];
  title: string;
  asuraId: string;
} | null> {
  const query = expectedTitles.find((t) => /[a-zA-Z]/.test(t)) || expectedTitles[0];
  if (!query?.trim()) return null;

  const cacheKey = `manga:asura:v1:${normalizeMangaTitle(query).slice(0, 80)}`;

  return getCached(
    cacheKey,
    async () => {
      const hits = await searchAsura(query.trim());
      const best = pickBestAsuraHit(hits, expectedTitles);
      if (!best) return null;

      const info = await fetchAsuraInfo(best.id);
      if (!info?.chapters.length) return null;

      if (!mangaProviderResultMatches(expectedTitles, info.title || best.title, best.id)) {
        console.warn(
          '[AsuraScans] Rejected title mismatch:',
          info.title || best.title,
          'vs',
          expectedTitles[0]
        );
        return null;
      }

      return {
        chapters: info.chapters,
        title: info.title || best.title,
        asuraId: best.id,
      };
    },
    CACHE_TTL.MANGA_CHAPTERS_LIST
  );
}

export async function getAsuraChapterPages(
  chapterId: string
): Promise<MangaChapterPage[]> {
  try {
    const url = `${CONSUMET_API_URL}/manga/${PROVIDER}/read`;
    const res = await axiosInstance.get(url, {
      params: { chapterId },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });
    const data = res.data;
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.pages)
        ? data.pages
        : [];
    return arr
      .map(
        (
          p: { img?: string; page?: number; headerForImage?: Record<string, string> | string },
          i: number
        ) => {
          const header =
            typeof p.headerForImage === 'string'
              ? { Referer: p.headerForImage }
              : p.headerForImage;
          return {
            img: p.img || '',
            page: typeof p.page === 'number' ? p.page : i + 1,
            ...(header ? { headerForImage: header } : {}),
          };
        }
      )
      .filter((p: MangaChapterPage) => Boolean(p.img));
  } catch (err) {
    console.warn('[AsuraScans] read failed:', (err as Error).message);
    return [];
  }
}

export { PROVIDER as ASURA_PROVIDER };
