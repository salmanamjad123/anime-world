/**
 * Manga chapter resolution + pagination
 * Full lists are cached; API returns page slices for fast first paint.
 *
 * - provider=auto: fetch all sources in parallel, pick longest title-verified list
 * - explicit tab: only that source (no silent swap)
 */

import { getMangaById } from '@/lib/api/anilist-manga';
import { getMangaInfo, MANGA_PROVIDERS } from '@/lib/api/consumet-manga';
import {
  findMangaDexByAnilistId,
  getMangaDexChapters,
} from '@/lib/api/mangadex';
import { getCachedWhen, CACHE_TTL } from '@/lib/cache';
import { getStaleCache, saveStaleCache } from '@/lib/cache/stale-cache';
import type { Manga, MangaChapter } from '@/types';
import { getPreferredTitle } from '@/lib/utils';
import {
  collectAniListMangaTitles,
  mangaProviderResultMatches,
} from '../utils/manga-title-match';

/** Tabs shown in the manga detail UI */
export const CHAPTER_UI_SOURCES = [
  'auto',
  'mangadex',
  'mangapill',
  'mangareader',
  'mangahere',
] as const;
export type ChapterUiSource = (typeof CHAPTER_UI_SOURCES)[number];

export const CHAPTER_SOURCES = CHAPTER_UI_SOURCES;
export type ChapterSource = ChapterUiSource;

export const DEFAULT_CHAPTER_SOURCE: ChapterSource = 'auto';
export const DEFAULT_CHAPTER_PAGE_SIZE = 60;

const CONSUMET_SOURCES = ['mangapill', 'mangareader', 'mangahere'] as const;

/** Tie-break when chapter counts are equal (prefer official MD) */
const PROVIDER_PRIORITY = ['mangadex', 'mangapill', 'mangareader', 'mangahere'] as const;

export interface ResolveChaptersResult {
  chapters: MangaChapter[];
  /** Provider used for reading chapter pages */
  provider: string;
  /** Requested mode (auto vs explicit tab) */
  mode: string;
  mangadexId?: string | null;
  source?: 'mangadex' | 'consumet' | 'none';
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unavailableReason?: 'empty' | 'title_mismatch';
}

function isAutoMode(provider: string): boolean {
  return !provider || provider === 'auto';
}

function isConsumetProvider(provider: string): boolean {
  return (CONSUMET_SOURCES as readonly string[]).includes(provider);
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

type ConsumetFetchResult = {
  chapters: MangaChapter[];
  provider: string;
  rejected?: 'empty' | 'title_mismatch';
};

async function chaptersFromConsumetProvider(
  anilistId: string,
  provider: string,
  expectedTitles: string[]
): Promise<ConsumetFetchResult> {
  if (!isConsumetProvider(provider)) {
    return { chapters: [], provider, rejected: 'empty' };
  }

  try {
    const info = await getMangaInfo(anilistId, provider);
    if (!info?.chapters?.length) {
      return { chapters: [], provider, rejected: 'empty' };
    }

    const sampleId = info.chapters[0]?.id;
    if (!mangaProviderResultMatches(expectedTitles, info.title, sampleId)) {
      console.warn(
        `[Manga chapters] Rejected ${provider} title mismatch for ${anilistId}:`,
        typeof info.title === 'string' ? info.title : info.title,
        'vs',
        expectedTitles[0]
      );
      return { chapters: [], provider, rejected: 'title_mismatch' };
    }

    return { chapters: info.chapters, provider };
  } catch (err) {
    console.warn(`[Manga chapters] Consumet ${provider}:`, (err as Error).message);
    return { chapters: [], provider, rejected: 'empty' };
  }
}

interface FullChapterList {
  chapters: MangaChapter[];
  provider: string;
  mode: string;
  mangadexId?: string | null;
  source: 'mangadex' | 'consumet' | 'none';
  unavailableReason?: 'empty' | 'title_mismatch';
}

type Candidate = {
  chapters: MangaChapter[];
  provider: string;
  source: 'mangadex' | 'consumet';
  mangadexId?: string | null;
};

function pickBestCandidate(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, cur) => {
    if (cur.chapters.length > best.chapters.length) return cur;
    if (cur.chapters.length < best.chapters.length) return best;
    const curPri = PROVIDER_PRIORITY.indexOf(cur.provider as (typeof PROVIDER_PRIORITY)[number]);
    const bestPri = PROVIDER_PRIORITY.indexOf(best.provider as (typeof PROVIDER_PRIORITY)[number]);
    const curRank = curPri >= 0 ? curPri : 99;
    const bestRank = bestPri >= 0 ? bestPri : 99;
    return curRank < bestRank ? cur : best;
  });
}

/**
 * Auto mode: query MangaDex + scrapers in parallel, return the longest verified list.
 */
async function resolveAutoChapterList(
  anilistId: string,
  manga: Manga,
  mangadexIdHint?: string | null
): Promise<FullChapterList> {
  const expectedTitles = collectAniListMangaTitles(manga);

  const [mdResult, ...consumetResults] = await Promise.all([
    chaptersFromMangaDex(anilistId, manga, mangadexIdHint),
    ...CONSUMET_SOURCES.map((p) =>
      chaptersFromConsumetProvider(anilistId, p, expectedTitles)
    ),
  ]);

  const candidates: Candidate[] = [];

  if (mdResult.chapters.length > 0) {
    candidates.push({
      chapters: mdResult.chapters,
      provider: 'mangadex',
      source: 'mangadex',
      mangadexId: mdResult.mangadexId,
    });
  }

  for (const r of consumetResults) {
    if (r.chapters.length > 0) {
      candidates.push({
        chapters: r.chapters,
        provider: r.provider,
        source: 'consumet',
        mangadexId: mdResult.mangadexId,
      });
    }
  }

  const winner = pickBestCandidate(candidates);
  if (winner) {
    return {
      chapters: winner.chapters,
      provider: winner.provider,
      mode: 'auto',
      mangadexId: winner.mangadexId ?? mdResult.mangadexId,
      source: winner.source,
    };
  }

  const hadMismatch = consumetResults.some((r) => r.rejected === 'title_mismatch');

  return {
    chapters: [],
    provider: 'auto',
    mode: 'auto',
    mangadexId: mdResult.mangadexId,
    source: 'none',
    unavailableReason: hadMismatch ? 'title_mismatch' : 'empty',
  };
}

async function resolveFullChapterList(
  anilistId: string,
  provider: string,
  manga: Manga,
  mangadexIdHint?: string | null
): Promise<FullChapterList> {
  const expectedTitles = collectAniListMangaTitles(manga);
  const mode = provider || 'auto';

  if (isAutoMode(provider)) {
    return resolveAutoChapterList(anilistId, manga, mangadexIdHint);
  }

  if (provider === 'mangadex') {
    const { chapters, mangadexId } = await chaptersFromMangaDex(
      anilistId,
      manga,
      mangadexIdHint
    );
    return {
      chapters,
      provider: 'mangadex',
      mode,
      mangadexId,
      source: chapters.length > 0 ? 'mangadex' : 'none',
      unavailableReason: chapters.length > 0 ? undefined : 'empty',
    };
  }

  const consumet = await chaptersFromConsumetProvider(
    anilistId,
    provider,
    expectedTitles
  );
  if (consumet.chapters.length > 0) {
    const { mangadexId } = await chaptersFromMangaDex(anilistId, manga, mangadexIdHint);
    return {
      chapters: consumet.chapters,
      provider: consumet.provider,
      mode,
      mangadexId,
      source: 'consumet',
    };
  }

  const { mangadexId } = await chaptersFromMangaDex(anilistId, manga, mangadexIdHint);

  return {
    chapters: [],
    provider,
    mode,
    mangadexId,
    source: 'none',
    unavailableReason: consumet.rejected ?? 'empty',
  };
}

export function paginateChapters(
  chapters: MangaChapter[],
  page: number,
  limit: number
): {
  chapters: MangaChapter[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
} {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeLimit =
    limit <= 0
      ? chapters.length || DEFAULT_CHAPTER_PAGE_SIZE
      : Math.min(Math.max(1, Math.floor(limit) || DEFAULT_CHAPTER_PAGE_SIZE), 500);
  const total = chapters.length;
  const start = (safePage - 1) * safeLimit;
  const slice = chapters.slice(start, start + safeLimit);
  return {
    chapters: slice,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: start + slice.length < total,
  };
}

export async function resolveMangaChapters(
  anilistId: string,
  provider: string = DEFAULT_CHAPTER_SOURCE,
  mangaHint?: Manga | null,
  mangadexIdHint?: string | null,
  options?: { page?: number; limit?: number; all?: boolean }
): Promise<ResolveChaptersResult> {
  const page = options?.page ?? 1;
  const all = options?.all === true;
  const limit = all ? 0 : (options?.limit ?? DEFAULT_CHAPTER_PAGE_SIZE);
  const mode = provider || 'auto';

  let manga = mangaHint ?? null;
  if (!manga) {
    const anilistRes = await getMangaById(
      anilistId,
      mangadexIdHint ? { mangadexId: mangadexIdHint } : undefined
    );
    manga = anilistRes?.data?.Media ?? null;
  }

  if (!manga) {
    return {
      chapters: [],
      provider: mode,
      mode,
      source: 'none',
      page: 1,
      limit: DEFAULT_CHAPTER_PAGE_SIZE,
      total: 0,
      hasMore: false,
      unavailableReason: 'empty',
    };
  }

  const cacheKey = `manga:chapters:full:v5:${anilistId}:${mode}:${mangadexIdHint ?? ''}`;

  const full = await getCachedWhen(
    cacheKey,
    () => resolveFullChapterList(anilistId, provider, manga!, mangadexIdHint),
    CACHE_TTL.MANGA_CHAPTERS_LIST,
    (r) => (r?.chapters?.length ?? 0) > 0,
    5 * 60 * 1000
  );

  const paged = paginateChapters(full.chapters, page, limit);

  return {
    ...paged,
    provider: full.provider,
    mode: full.mode,
    mangadexId: full.mangadexId,
    source: full.source,
    unavailableReason: full.unavailableReason,
  };
}

export { MANGA_PROVIDERS };
