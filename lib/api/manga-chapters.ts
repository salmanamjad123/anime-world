/**
 * Manga chapter resolution + pagination
 * Full lists are cached; API returns page slices for fast first paint.
 *
 * - provider=auto: fetch all sources in parallel, pick longest title-verified list
 * - explicit tab: only that source (no silent swap)
 * - Manhwa (KR) / manhua (CN/TW): prefer MangaPark, MangaSee, MangaHere, AsuraScans
 */

import { getMangaById } from '@/lib/api/anilist-manga';
import { getMangaInfo, getMangaInfoByTitleSearch, MANGA_PROVIDERS } from '@/lib/api/consumet-manga';
import { getAsuraChaptersForTitles } from '@/lib/api/asura-scans';
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
  'mangapark',
  'mangasee123',
  'asurascans',
  'mangapill',
  'mangareader',
  'mangahere',
] as const;
export type ChapterUiSource = (typeof CHAPTER_UI_SOURCES)[number];

export const CHAPTER_SOURCES = CHAPTER_UI_SOURCES;
export type ChapterSource = ChapterUiSource;

export const DEFAULT_CHAPTER_SOURCE: ChapterSource = 'auto';
export const DEFAULT_CHAPTER_PAGE_SIZE = 60;

/** AniList-mapped Consumet scrapers */
const CONSUMET_SOURCES = [
  'mangapill',
  'mangareader',
  'mangahere',
  'mangapark',
  'mangasee123',
] as const;

/** Stronger for Korean / Chinese titles */
const MANHWA_FRIENDLY_SOURCES = [
  'mangapark',
  'mangasee123',
  'mangahere',
  'asurascans',
] as const;

/** Tie-break when chapter counts are equal (JP manga) */
const PROVIDER_PRIORITY = [
  'mangadex',
  'mangapark',
  'mangasee123',
  'asurascans',
  'mangahere',
  'mangapill',
  'mangareader',
] as const;

/** Prefer scrapers over sparse MangaDex for KR/CN */
const MANHWA_PROVIDER_PRIORITY = [
  'mangahere',
  'mangapark',
  'mangasee123',
  'asurascans',
  'mangapill',
  'mangareader',
  'mangadex',
] as const;

export interface ChapterPageRange {
  page: number;
  first: string;
  last: string;
  count: number;
  label: string;
}

export interface ResolveChaptersResult {
  chapters: MangaChapter[];
  /** Provider used for reading chapter pages */
  provider: string;
  /** Requested mode (auto vs explicit tab) */
  mode: string;
  mangadexId?: string | null;
  source?: 'mangadex' | 'consumet' | 'asura' | 'none';
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unavailableReason?: 'empty' | 'title_mismatch';
  /** Dropdown labels for all pages (from cached full list; not the chapter payloads) */
  pageRanges?: ChapterPageRange[];
  /** First chapter in the full list — for Read Now */
  firstChapter?: MangaChapter | null;
}

function isAutoMode(provider: string): boolean {
  return !provider || provider === 'auto';
}

function isConsumetProvider(provider: string): boolean {
  return (CONSUMET_SOURCES as readonly string[]).includes(provider);
}

/** KR manhwa / CN·TW manhua — need scraper-heavy sources */
export function isManhwaOrManhua(
  manga: Pick<Manga, 'countryOfOrigin' | 'tags'>
): boolean {
  const country = (manga.countryOfOrigin || '').toUpperCase();
  if (country === 'KR' || country === 'CN' || country === 'TW') return true;
  const tags = manga.tags ?? [];
  return tags.some((t) => {
    const n = (t.name || '').toLowerCase();
    return n === 'manhwa' || n === 'manhua' || n.includes('webtoon');
  });
}

function priorityList(preferManhwa: boolean): readonly string[] {
  return preferManhwa ? MANHWA_PROVIDER_PRIORITY : PROVIDER_PRIORITY;
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
  expectedTitles: string[],
  expectedChapterCount?: number | null,
  format?: string | null
): Promise<ConsumetFetchResult> {
  if (!isConsumetProvider(provider)) {
    return { chapters: [], provider, rejected: 'empty' };
  }

  const matchOpts = { format };

  try {
    const info = await getMangaInfo(anilistId, provider);
    const mappedChapters = info?.chapters ?? [];
    const sampleIds = mappedChapters.slice(0, 8).map((ch) => ch.id).filter(Boolean);
    const mappedOk =
      mappedChapters.length > 0 &&
      mangaProviderResultMatches(expectedTitles, info?.title, sampleIds, matchOpts);

    const sparse =
      !!expectedChapterCount &&
      expectedChapterCount >= 40 &&
      mappedChapters.length > 0 &&
      mappedChapters.length < expectedChapterCount * 0.45;

    // Bad AniList→site maps (Solo Leveling → Ragnarok / novel) or incomplete lists:
    // resolve via scraper title search instead.
    if (!mappedOk || sparse || mappedChapters.length === 0) {
      const searched = await getMangaInfoByTitleSearch(
        provider,
        expectedTitles,
        matchOpts
      );
      const searchChapters = searched?.chapters ?? [];
      if (searchChapters.length > 0) {
        if (
          !mappedOk ||
          searchChapters.length > mappedChapters.length ||
          (sparse && searchChapters.length >= mappedChapters.length)
        ) {
          console.info(
            `[Manga chapters] ${provider}: using title-search (${searchChapters.length} ch)` +
              (mappedOk ? ` over sparse AniList map (${mappedChapters.length})` : ' after AniList map rejected')
          );
          return { chapters: searchChapters, provider };
        }
      }
    }

    if (!mappedOk) {
      console.warn(
        `[Manga chapters] Rejected ${provider} title mismatch for ${anilistId}:`,
        sampleIds[0] || (typeof info?.title === 'string' ? info?.title : info?.title),
        'vs',
        expectedTitles[0]
      );
      return { chapters: [], provider, rejected: 'title_mismatch' };
    }

    return { chapters: mappedChapters, provider };
  } catch (err) {
    console.warn(`[Manga chapters] Consumet ${provider}:`, (err as Error).message);
    return { chapters: [], provider, rejected: 'empty' };
  }
}

async function chaptersFromAsura(
  expectedTitles: string[]
): Promise<ConsumetFetchResult> {
  try {
    const result = await getAsuraChaptersForTitles(expectedTitles);
    if (!result?.chapters.length) {
      return { chapters: [], provider: 'asurascans', rejected: 'empty' };
    }
    return { chapters: result.chapters, provider: 'asurascans' };
  } catch (err) {
    console.warn('[Manga chapters] AsuraScans:', (err as Error).message);
    return { chapters: [], provider: 'asurascans', rejected: 'empty' };
  }
}

interface FullChapterList {
  chapters: MangaChapter[];
  provider: string;
  mode: string;
  mangadexId?: string | null;
  source: 'mangadex' | 'consumet' | 'asura' | 'none';
  unavailableReason?: 'empty' | 'title_mismatch';
}

type Candidate = {
  chapters: MangaChapter[];
  provider: string;
  source: 'mangadex' | 'consumet' | 'asura';
  mangadexId?: string | null;
};

function pickBestCandidate(
  candidates: Candidate[],
  preferManhwa: boolean
): Candidate | null {
  if (candidates.length === 0) return null;
  const order = priorityList(preferManhwa);

  return candidates.reduce((best, cur) => {
    if (cur.chapters.length > best.chapters.length) return cur;
    if (cur.chapters.length < best.chapters.length) return best;
    const curPri = order.indexOf(cur.provider);
    const bestPri = order.indexOf(best.provider);
    const curRank = curPri >= 0 ? curPri : 99;
    const bestRank = bestPri >= 0 ? bestPri : 99;
    return curRank < bestRank ? cur : best;
  });
}

function sourceOf(provider: string): 'mangadex' | 'consumet' | 'asura' {
  if (provider === 'mangadex') return 'mangadex';
  if (provider === 'asurascans') return 'asura';
  return 'consumet';
}

/**
 * Auto mode: MangaDex + scrapers + AsuraScans in parallel; manhwa prefers scraper sources.
 */
async function resolveAutoChapterList(
  anilistId: string,
  manga: Manga,
  mangadexIdHint?: string | null
): Promise<FullChapterList> {
  const expectedTitles = collectAniListMangaTitles(manga);
  const preferManhwa = isManhwaOrManhua(manga);
  const format = manga.format ?? null;

  const consumetToQuery: string[] = preferManhwa
    ? [
        ...new Set([
          ...MANHWA_FRIENDLY_SOURCES.filter((p) => p !== 'asurascans'),
          // Skip mangapill for manhwa auto — often maps light-novel text editions
          ...CONSUMET_SOURCES.filter((p) => p !== 'mangapill'),
        ]),
      ]
    : [...CONSUMET_SOURCES];

  const expectedCount = manga.chapters ?? null;

  const [mdResult, ...scrapers] = await Promise.all([
    chaptersFromMangaDex(anilistId, manga, mangadexIdHint),
    ...consumetToQuery.map((p) =>
      chaptersFromConsumetProvider(
        anilistId,
        p,
        expectedTitles,
        expectedCount,
        format
      )
    ),
    chaptersFromAsura(expectedTitles),
  ]);

  const consumetResults = scrapers;

  const candidates: Candidate[] = [];
  const seenProviders = new Set<string>();

  if (mdResult.chapters.length > 0) {
    candidates.push({
      chapters: mdResult.chapters,
      provider: 'mangadex',
      source: 'mangadex',
      mangadexId: mdResult.mangadexId,
    });
    seenProviders.add('mangadex');
  }

  for (const r of consumetResults) {
    if (r.chapters.length === 0 || seenProviders.has(r.provider)) continue;
    seenProviders.add(r.provider);
    candidates.push({
      chapters: r.chapters,
      provider: r.provider,
      source: sourceOf(r.provider),
      mangadexId: mdResult.mangadexId,
    });
  }

  const winner = pickBestCandidate(candidates, preferManhwa);
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

  if (provider === 'asurascans') {
    const asura = await chaptersFromAsura(expectedTitles);
    const { mangadexId } = await chaptersFromMangaDex(
      anilistId,
      manga,
      mangadexIdHint
    );
    if (asura.chapters.length > 0) {
      return {
        chapters: asura.chapters,
        provider: 'asurascans',
        mode,
        mangadexId,
        source: 'asura',
      };
    }
    return {
      chapters: [],
      provider: 'asurascans',
      mode,
      mangadexId,
      source: 'none',
      unavailableReason: asura.rejected ?? 'empty',
    };
  }

  const consumet = await chaptersFromConsumetProvider(
    anilistId,
    provider,
    expectedTitles,
    manga.chapters ?? null,
    manga.format ?? null
  );
  if (consumet.chapters.length > 0) {
    const { mangadexId } = await chaptersFromMangaDex(
      anilistId,
      manga,
      mangadexIdHint
    );
    return {
      chapters: consumet.chapters,
      provider: consumet.provider,
      mode,
      mangadexId,
      source: 'consumet',
    };
  }

  const { mangadexId } = await chaptersFromMangaDex(
    anilistId,
    manga,
    mangadexIdHint
  );

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

function chapterNumLabel(ch?: MangaChapter | null): string {
  if (!ch) return '?';
  if (ch.chapter) return String(ch.chapter);
  const fromTitle = ch.title?.match(/(\d+(?:\.\d+)?)/);
  return fromTitle?.[1] ?? '?';
}

export function buildChapterPageRanges(
  chapters: MangaChapter[],
  pageSize: number
): ChapterPageRange[] {
  if (chapters.length === 0) return [];
  const size = Math.max(1, pageSize);
  const totalPages = Math.ceil(chapters.length / size);
  return Array.from({ length: totalPages }, (_, i) => {
    const start = i * size;
    const slice = chapters.slice(start, start + size);
    const first = chapterNumLabel(slice[0]);
    const last = chapterNumLabel(slice[slice.length - 1]);
    const label = first === last ? `Ch. ${first}` : `Ch. ${first} – ${last}`;
    return {
      page: i + 1,
      first,
      last,
      count: slice.length,
      label,
    };
  });
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
      pageRanges: [],
      firstChapter: null,
    };
  }

  // v10: reject light-novel editions; manhwa auto skips mangapill
  const cacheKey = `manga:chapters:full:v10:${anilistId}:${mode}:${mangadexIdHint ?? ''}`;

  const full = await getCachedWhen(
    cacheKey,
    () => resolveFullChapterList(anilistId, provider, manga!, mangadexIdHint),
    CACHE_TTL.MANGA_CHAPTERS_LIST,
    (r) => (r?.chapters?.length ?? 0) > 0,
    5 * 60 * 1000
  );

  const pageSize =
    all || limit <= 0 ? DEFAULT_CHAPTER_PAGE_SIZE : limit || DEFAULT_CHAPTER_PAGE_SIZE;
  const paged = paginateChapters(full.chapters, page, limit);
  const pageRanges = buildChapterPageRanges(full.chapters, pageSize);

  return {
    ...paged,
    provider: full.provider,
    mode: full.mode,
    mangadexId: full.mangadexId,
    source: full.source,
    unavailableReason: full.unavailableReason,
    pageRanges,
    firstChapter: full.chapters[0] ?? null,
  };
}

export { MANGA_PROVIDERS, MANHWA_FRIENDLY_SOURCES };
