/**
 * Manga chapter resolution
 * MangaDex (official API) first → Consumet scrapers as fallback
 */

import { getMangaById } from '@/lib/api/anilist-manga';
import { getMangaInfo, MANGA_PROVIDERS } from '@/lib/api/consumet-manga';
import {
  findMangaDexByAnilistId,
  getMangaDexChapters,
} from '@/lib/api/mangadex';
import type { Manga, MangaChapter } from '@/types';
import { getPreferredTitle } from '@/lib/utils';

export const CHAPTER_SOURCES = ['mangadex', 'mangapill', 'mangareader'] as const;
export type ChapterSource = (typeof CHAPTER_SOURCES)[number];

export const DEFAULT_CHAPTER_SOURCE: ChapterSource = 'mangadex';

const CONSUMET_SOURCES = ['mangapill', 'mangareader', 'mangadex', 'mangahere', 'mangakakalot'] as const;

export interface ResolveChaptersResult {
  chapters: MangaChapter[];
  provider: string;
  mangadexId?: string | null;
  source?: 'mangadex' | 'consumet' | 'none';
}

function isNativeMangaDex(provider: string): boolean {
  return !provider || provider === 'mangadex' || provider === 'auto';
}

async function chaptersFromMangaDex(
  anilistId: string,
  manga: Manga
): Promise<{ chapters: MangaChapter[]; mangadexId: string | null }> {
  const title = getPreferredTitle(manga.title);
  const mangadexId = await findMangaDexByAnilistId(anilistId, title);
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
    ...CONSUMET_SOURCES.filter((p) => p !== preferred && p !== 'mangadex'),
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
  mangaHint?: Manga | null
): Promise<ResolveChaptersResult> {
  let manga = mangaHint ?? null;
  if (!manga) {
    const anilistRes = await getMangaById(anilistId);
    manga = anilistRes?.data?.Media ?? null;
  }

  if (!manga) {
    return { chapters: [], provider, source: 'none' };
  }

  // Preferred path: official MangaDex
  if (isNativeMangaDex(provider)) {
    const { chapters, mangadexId } = await chaptersFromMangaDex(anilistId, manga);
    if (chapters.length > 0) {
      return {
        chapters,
        provider: 'mangadex',
        mangadexId,
        source: 'mangadex',
      };
    }

    const fallback = await chaptersFromConsumet(anilistId, 'mangapill');
    if (fallback.chapters.length > 0) {
      return {
        chapters: fallback.chapters,
        provider: fallback.provider,
        mangadexId,
        source: 'consumet',
      };
    }

    return {
      chapters: [],
      provider: 'mangadex',
      mangadexId,
      source: 'none',
    };
  }

  // Explicit scraper: try it (and siblings), then MangaDex
  const consumet = await chaptersFromConsumet(anilistId, provider);
  if (consumet.chapters.length > 0) {
    return {
      chapters: consumet.chapters,
      provider: consumet.provider,
      source: 'consumet',
    };
  }

  const { chapters, mangadexId } = await chaptersFromMangaDex(anilistId, manga);
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
