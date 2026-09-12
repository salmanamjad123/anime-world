/**
 * Manga chapter resolution
 * MangaDex (official API, readable chapters only) first → Consumet scrapers as fallback
 */

import { getMangaById } from '@/lib/api/anilist-manga';
import { getMangaInfo, MANGA_PROVIDERS } from '@/lib/api/consumet-manga';
import {
  findMangaDexByAnilistId,
  getMangaDexChapters,
} from '@/lib/api/mangadex';
import { getStaleCache, saveStaleCache } from '@/lib/cache/stale-cache';
import type { Manga, MangaChapter } from '@/types';
import { getPreferredTitle } from '@/lib/utils';

export const CHAPTER_SOURCES = ['mangadex', 'mangapill', 'mangareader'] as const;
export type ChapterSource = (typeof CHAPTER_SOURCES)[number];

export const DEFAULT_CHAPTER_SOURCE: ChapterSource = 'mangadex';

const CONSUMET_SOURCES = ['mangapill', 'mangareader', 'mangahere', 'mangakakalot'] as const;

export interface ResolveChaptersResult {
  chapters: MangaChapter[];
  provider: string;
  mangadexId?: string | null;
  source?: 'mangadex' | 'consumet' | 'none';
}

function isNativeMangaDex(provider: string): boolean {
  return !provider || provider === 'mangadex' || provider === 'auto';
}

async function resolveMangaDexId(
  anilistId: string,
  manga: Manga,
  mangadexIdHint?: string | null
): Promise<string | null> {
  if (mangadexIdHint) return mangadexIdHint;
  if (manga.mangadexId) return manga.mangadexId;

  const cached = await getStaleCache<string>(`mangadex:uuid:${anilistId}`);
  if (cached) return cached;

  const title = getPreferredTitle(manga.title);
  const titles = [
    title,
    manga.title?.english,
    manga.title?.romaji,
    manga.title?.native,
  ].filter((t, i, arr): t is string => Boolean(t?.trim()) && arr.indexOf(t) === i);

  for (const t of titles) {
    const found = await findMangaDexByAnilistId(anilistId, t);
    if (found) {
      saveStaleCache(`mangadex:uuid:${anilistId}`, found).catch(() => {});
      return found;
    }
  }
  return null;
}

async function chaptersFromMangaDex(
  anilistId: string,
  manga: Manga,
  mangadexIdHint?: string | null
): Promise<{ chapters: MangaChapter[]; mangadexId: string | null }> {
  const mangadexId = await resolveMangaDexId(anilistId, manga, mangadexIdHint);
  if (!mangadexId) {
    return { chapters: [], mangadexId: null };
  }
  const chapters = await getMangaDexChapters(mangadexId);
  return { chapters, mangadexId };
}

async function chaptersFromConsumet(
  anilistId: string,
  preferred: string
): Promise<{ chapters: MangaChapter[]; provider: string }> {
  const order = [
    preferred,
    ...CONSUMET_SOURCES.filter((p) => p !== preferred),
  ];

  for (const provider of order) {
    try {
      const info = await getMangaInfo(anilistId, provider);
      if (info?.chapters?.length) {
        return { chapters: info.chapters, provider };
      }
    } catch (err) {
      console.warn(`[Manga chapters] Consumet ${provider}:`, (err as Error).message);
    }
  }

  return { chapters: [], provider: preferred };
}

/**
 * Resolve readable chapters for an AniList manga id.
 *
 * - provider=mangadex|auto (default): MangaDex official → Consumet scrapers
 * - provider=mangapill|mangareader|...: that scraper first → MangaDex → other scrapers
 */
export async function resolveMangaChapters(
  anilistId: string,
  provider: string = DEFAULT_CHAPTER_SOURCE,
  mangaHint?: Manga | null,
  mangadexIdHint?: string | null
): Promise<ResolveChaptersResult> {
  let manga = mangaHint ?? null;
  if (!manga) {
    const anilistRes = await getMangaById(
      anilistId,
      mangadexIdHint ? { mangadexId: mangadexIdHint } : undefined
    );
    manga = anilistRes?.data?.Media ?? null;
  }

  if (!manga) {
    return { chapters: [], provider, source: 'none' };
  }

  if (isNativeMangaDex(provider)) {
    const { chapters, mangadexId } = await chaptersFromMangaDex(
      anilistId,
      manga,
      mangadexIdHint
    );

    // Enough readable MD chapters → skip slow Consumet (often offline locally)
    if (chapters.length >= 5) {
      return {
        chapters,
        provider: 'mangadex',
        mangadexId,
        source: 'mangadex',
      };
    }

    // Sparse/empty MD (licensed/external-only) → try scrapers for fuller lists
    const fallback = await chaptersFromConsumet(anilistId, 'mangapill');
    if (fallback.chapters.length > chapters.length) {
      return {
        chapters: fallback.chapters,
        provider: fallback.provider,
        mangadexId,
        source: 'consumet',
      };
    }

    if (chapters.length > 0) {
      return {
        chapters,
        provider: 'mangadex',
        mangadexId,
        source: 'mangadex',
      };
    }

    return {
      chapters: [],
      provider: 'mangadex',
      mangadexId,
      source: 'none',
    };
  }

  const consumet = await chaptersFromConsumet(anilistId, provider);
  if (consumet.chapters.length > 0) {
    return {
      chapters: consumet.chapters,
      provider: consumet.provider,
      source: 'consumet',
    };
  }

  const { chapters, mangadexId } = await chaptersFromMangaDex(
    anilistId,
    manga,
    mangadexIdHint
  );
  if (chapters.length > 0) {
    return {
      chapters,
      provider: 'mangadex',
      mangadexId,
      source: 'mangadex',
    };
  }

  return {
    chapters: [],
    provider,
    mangadexId,
    source: 'none',
  };
}

export { MANGA_PROVIDERS };
