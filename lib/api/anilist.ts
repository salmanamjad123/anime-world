/**
 * AniList API Client
 * GraphQL client for fetching anime metadata from AniList
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import { CACHE_TTL, getCached, getCachedWhen } from '@/lib/cache';
import {
  fetchAnilistListWithFallback,
  fetchAnilistDetailWithFallback,
  getJikanTrending,
  getJikanPopular,
  getJikanTopRated,
  indexAnimeDetailsFromList,
  isAnilistOutage,
} from './anilist-resilience';
import { searchJikanAnime } from './jikan';
import { getHiAnimeBrowseList, searchHiAnimeAsList } from './hianime-fallback';
import { keepWatchableSearchResult, WATCHABLE_CATALOG_STATUSES } from './watchable-catalog';
import { expandSearchQueries, titleMatchesCompactQuery } from '@/lib/search-query';
import type {
  Anime,
  AnimeSearchResult,
  AnimeSearchFallbackSource,
  AnimeFilters,
} from '@/types';

const RATE_LIMIT_RETRY_MS = 8_000; // cap wait on 429 before retry
const RATE_LIMIT_MAX_WAIT_MS = 15_000;

/**
 * GraphQL Queries
 */

const ANIME_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  synonyms
  description
  coverImage {
    large
    medium
    extraLarge
  }
  bannerImage
  genres
  averageScore
  popularity
  status
  format
  episodes
  duration
  season
  seasonYear
  startDate {
    year
    month
    day
  }
  studios {
    nodes {
      name
      isAnimationStudio
    }
  }
  trailer {
    id
    site
  }
  tags {
    id
    name
    rank
  }
`;

const TRENDING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: ANIME, sort: TRENDING_DESC, status_in: [RELEASING, FINISHED, HIATUS]) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const POPULAR_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: ANIME, sort: POPULARITY_DESC, status_in: [RELEASING, FINISHED, HIATUS]) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const SEARCH_PAGE_INFO = `
        total
        currentPage
        lastPage
        hasNextPage
        perPage
`;

const TYPEAHEAD_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  coverImage { large medium }
  genres
  averageScore
  format
  episodes
  status
`;

const SEARCH_QUERY = `
  query (
    $search: String
    $page: Int
    $perPage: Int
    $genres: [String]
    $year: Int
    $season: MediaSeason
    $format: MediaFormat
    $status: MediaStatus
    $status_in: [MediaStatus]
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        ${SEARCH_PAGE_INFO}
      }
      media(
        type: ANIME
        search: $search
        genre_in: $genres
        seasonYear: $year
        season: $season
        format: $format
        status: $status
        status_in: $status_in
        sort: $sort
      ) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const TYPEAHEAD_SEARCH_QUERY = `
  query (
    $search: String
    $page: Int
    $perPage: Int
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        ${SEARCH_PAGE_INFO}
      }
      media(type: ANIME, search: $search, sort: $sort) {
        ${TYPEAHEAD_FIELDS}
      }
    }
  }
`;

const ANIME_BY_ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${ANIME_FIELDS}
    }
  }
`;

/**
 * Execute GraphQL query. On 429, fail fast to stale/Jikan/HiAnime fallbacks (no long blocking wait).
 */
async function executeQuery<T>(
  query: string,
  variables: Record<string, any> = {},
  retryCount = 0,
  timeoutMs?: number,
  options?: { retryOn429?: boolean; skipThrottle?: boolean }
): Promise<T> {
  try {
    const response = await axiosInstance.post<T>(
      ANILIST_API_URL,
      {
        query,
        variables,
      },
      {
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
        ...(options?.skipThrottle ? { skipAnilistThrottle: true } : {}),
      }
    );
    return response.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number; headers?: { 'retry-after'?: string } } })?.response?.status;
    if (status === 429) {
      if (options?.retryOn429 !== false && retryCount < 1) {
        const retryAfter =
          (error as { response?: { headers?: { 'retry-after'?: string } } })?.response?.headers?.['retry-after'];
        const parsed = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_RETRY_MS;
        const waitMs = Math.min(Number.isNaN(parsed) ? RATE_LIMIT_RETRY_MS : parsed, RATE_LIMIT_MAX_WAIT_MS);
        console.warn(`[AniList] 429 rate limit - brief wait ${waitMs / 1000}s then retry`);
        await new Promise((r) => setTimeout(r, waitMs));
        return executeQuery<T>(query, variables, retryCount + 1, timeoutMs, options);
      }
      console.warn('[AniList] 429 rate limit - failing over to cached/fallback sources');
    }
    console.error('[AniList API Error]', error);
    throw error;
  }
}

/**
 * Get trending anime (cached 5 min)
 */
export async function getTrendingAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:trending:watchable:${page}:${perPage}`;
  const result = await fetchAnilistListWithFallback(
    cacheKey,
    () => executeQuery<AnimeSearchResult>(TRENDING_QUERY, { page, perPage }),
    getJikanTrending,
    page,
    perPage,
    'trending'
  );
  return keepWatchableSearchResult(result);
}

/**
 * Get popular anime (cached 5 min)
 */
export async function getPopularAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:popular:watchable:${page}:${perPage}`;
  const result = await fetchAnilistListWithFallback(
    cacheKey,
    () => executeQuery<AnimeSearchResult>(POPULAR_QUERY, { page, perPage }),
    getJikanPopular,
    page,
    perPage,
    'popular'
  );
  return keepWatchableSearchResult(result);
}

// AniList uses different names for some genres
const GENRE_ANILIST_MAP: Record<string, string> = {
  'Shoujo Ai': 'Girls Love',
  'Shounen Ai': 'Boys Love',
};

function mapGenresForAniList(genres: string[]): string[] {
  return genres.map((g) => GENRE_ANILIST_MAP[g] ?? g);
}

const SEARCH_EMPTY_TTL_MS = 12_000;
const TYPEAHEAD_TIMEOUT_MS = 2200;

function emptySearchResult(page: number, perPage: number): AnimeSearchResult {
  return {
    data: {
      Page: {
        pageInfo: { total: 0, currentPage: page, lastPage: 1, hasNextPage: false, perPage },
        media: [],
      },
    },
  };
}

function searchMediaCount(result: AnimeSearchResult | null | undefined): number {
  return result?.data?.Page?.media?.length ?? 0;
}

function mergeSearchResults(
  results: Array<AnimeSearchResult | null>,
  query: string,
  page: number,
  perPage: number
): AnimeSearchResult | null {
  const seen = new Set<string>();
  const media: Anime[] = [];
  let fallback: AnimeSearchFallbackSource | undefined;

  for (const result of results) {
    if (!result?.data?.Page?.media?.length) continue;
    if (!fallback && result._fallback) fallback = result._fallback;
    for (const item of result.data.Page.media) {
      const id = String(item.id);
      if (seen.has(id)) continue;
      seen.add(id);
      media.push(item);
    }
  }

  const matched = media.filter((item) =>
    titleMatchesCompactQuery(item.title, query, item.synonyms)
  );
  const picked = matched.length > 0 ? matched : media;
  if (!picked.length) return null;

  const sliced = picked.slice(0, perPage);
  return {
    ...(fallback ? { _fallback: fallback } : {}),
    data: {
      Page: {
        pageInfo: {
          total: sliced.length,
          currentPage: page,
          lastPage: 1,
          hasNextPage: false,
          perPage,
        },
        media: sliced,
      },
    },
  };
}

async function runFastTextSearch(
  query: string,
  page: number,
  perPage: number
): Promise<AnimeSearchResult | null> {
  const anilistPromise = executeQuery<AnimeSearchResult>(
    TYPEAHEAD_SEARCH_QUERY,
    { search: query, page, perPage, sort: ['SEARCH_MATCH'] },
    0,
    TYPEAHEAD_TIMEOUT_MS,
    { retryOn429: false, skipThrottle: true }
  ).catch(() => null);

  const hianimePromise = searchHiAnimeAsList(
    query,
    page,
    perPage,
    TYPEAHEAD_TIMEOUT_MS
  ).catch(() => null);

  const anilist = await anilistPromise;
  if (searchMediaCount(anilist) > 0) return anilist;
  const hianime = await hianimePromise;
  if (searchMediaCount(hianime) > 0) {
    return { ...(hianime as AnimeSearchResult), _fallback: 'hianime-search' };
  }
  return null;
}

/** HiAnime/Jikan fallback when AniList search is unavailable */
async function searchAnimeOutageFallback(
  filters: AnimeFilters,
  page: number,
  perPage: number
): Promise<AnimeSearchResult> {
  const textQuery = filters.search?.trim() ?? '';
  const genreQuery = filters.genres?.length ? filters.genres.join(' ') : '';

  if (textQuery) {
    try {
      const hianime = await searchHiAnimeAsList(textQuery, page, perPage, TYPEAHEAD_TIMEOUT_MS);
      if (searchMediaCount(hianime) > 0) {
        return { ...hianime, _fallback: 'hianime-search' };
      }
    } catch {
      /* Jikan next */
    }
    console.warn('[AniList] Outage — Jikan search fallback');
    const result = await searchJikanAnime(textQuery, page, perPage);
    return { ...result, _fallback: 'hianime-search' };
  }

  if (genreQuery) {
    console.warn('[AniList] Outage — HiAnime genre search fallback');
    try {
      const result = await searchHiAnimeAsList(genreQuery, page, perPage);
      if (result.data.Page.media.length > 0) {
        return { ...result, _fallback: 'hianime-genre' };
      }
    } catch {
      /* fall through to browse */
    }
  }

  console.warn('[AniList] Outage — HiAnime browse fallback for filtered search');
  const browse = await getHiAnimeBrowseList(page, perPage, 'popular');
  return { ...browse, _fallback: 'hianime-browse' };
}

/**
 * Search anime with filters
 * Only pass defined filters - empty arrays/strings would restrict results to nothing
 */
export async function searchAnime(
  filters: AnimeFilters,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  const textQuery = filters.search?.trim() ?? '';
  const variables: Record<string, unknown> = {
    page,
    perPage,
    sort: filters.sort
      ? [filters.sort]
      : textQuery
        ? ['SEARCH_MATCH']
        : ['POPULARITY_DESC'],
  };

  if (textQuery) variables.search = textQuery;
  if (filters.genres?.length) variables.genres = mapGenresForAniList(filters.genres);
  if (filters.year) variables.year = filters.year;
  if (filters.season) variables.season = filters.season;
  if (filters.format) variables.format = filters.format;
  if (filters.status) {
    variables.status = filters.status;
  } else if (!textQuery) {
    // Genre / browse grids are watch catalogs — hide unreleased titles
    variables.status_in = WATCHABLE_CATALOG_STATUSES;
  }

  const runBrowse = async (): Promise<AnimeSearchResult> => {
    try {
      const result = await executeQuery<AnimeSearchResult>(SEARCH_QUERY, variables);
      return keepWatchableSearchResult(result);
    } catch (error) {
      if (!isAnilistOutage(error)) throw error;
      return keepWatchableSearchResult(
        await searchAnimeOutageFallback(filters, page, perPage)
      );
    }
  };

  if (!textQuery) return runBrowse();

  const hasExtraFilters = Boolean(
    filters.genres?.length || filters.year || filters.season || filters.format || filters.status
  );

  const cacheKey = `anilist:search:v2:${textQuery.toLowerCase()}:${page}:${perPage}:${String(
    filters.sort || 'SEARCH_MATCH'
  )}:${(filters.genres || []).join(',')}:${filters.year || ''}:${filters.season || ''}:${filters.format || ''}:${filters.status || ''}`;

  if (hasExtraFilters) {
    return getCachedWhen(
      cacheKey,
      async () => {
        try {
          const result = await executeQuery<AnimeSearchResult>(SEARCH_QUERY, variables, 0, 4000, {
            retryOn429: false,
            skipThrottle: true,
          });
          void indexAnimeDetailsFromList(result?.data?.Page?.media ?? []);
          return result;
        } catch (error) {
          if (!isAnilistOutage(error)) throw error;
          return searchAnimeOutageFallback(filters, page, perPage);
        }
      },
      CACHE_TTL.ANIME_SEARCH,
      (data) => searchMediaCount(data) > 0,
      SEARCH_EMPTY_TTL_MS
    );
  }

  return getCachedWhen(
    cacheKey,
    async () => {
      const variants = expandSearchQueries(textQuery);
      const variantHits: Array<AnimeSearchResult | null> = [];
      for (const variant of variants) {
        const hit = await runFastTextSearch(variant, page, perPage);
        variantHits.push(hit);
        if (searchMediaCount(hit) > 0) break;
      }
      const merged = mergeSearchResults(variantHits, textQuery, page, perPage);
      if (merged) {
        void indexAnimeDetailsFromList(merged.data?.Page?.media ?? []);
        return merged;
      }

      try {
        const jikanHits: Array<AnimeSearchResult | null> = [];
        for (const variant of variants) {
          const hit = await searchJikanAnime(variant, page, perPage).catch(() => null);
          jikanHits.push(hit);
          if (searchMediaCount(hit) > 0) break;
        }
        const jikanMerged = mergeSearchResults(
          jikanHits.map((result) =>
            result ? { ...result, _fallback: 'hianime-search' as const } : null
          ),
          textQuery,
          page,
          perPage
        );
        if (jikanMerged) {
          void indexAnimeDetailsFromList(jikanMerged.data?.Page?.media ?? []);
          return jikanMerged;
        }
      } catch {
        /* empty */
      }

      return emptySearchResult(page, perPage);
    },
    CACHE_TTL.ANIME_SEARCH,
    (data) => searchMediaCount(data) > 0,
    SEARCH_EMPTY_TTL_MS
  );
}

/**
 * Get anime by ID (cached 24 h)
 */
export async function getAnimeById(id: string | number): Promise<{ data: { Media: Anime } }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  return fetchAnilistDetailWithFallback(numericId, () =>
    executeQuery<{ data: { Media: Anime } }>(
      ANIME_BY_ID_QUERY,
      { id: numericId },
      0,
      4000,
      { retryOn429: false }
    )
  );
}

/** Lightweight title search for slug → AniList id resolution. */
export async function searchAnilistMediaByTitle(
  query: string,
  perPage = 8
): Promise<Anime[]> {
  if (!query.trim()) return [];
  try {
    const result = await executeQuery<AnimeSearchResult>(SEARCH_QUERY, {
      search: query.trim(),
      page: 1,
      perPage,
      sort: ['SEARCH_MATCH'],
    });
    return result?.data?.Page?.media ?? [];
  } catch (error) {
    if (!isAnilistOutage(error)) return [];
    try {
      const jikan = await searchJikanAnime(query.trim(), 1, perPage);
      return jikan?.data?.Page?.media ?? [];
    } catch {
      return [];
    }
  }
}

/**
 * Get anime by multiple IDs (batch request)
 */
export async function getAnimeByIds(ids: string[]): Promise<Anime[]> {
  const promises = ids.map((id) => getAnimeById(id));
  const results = await Promise.allSettled(promises);
  
  return results
    .filter((result): result is PromiseFulfilledResult<{ data: { Media: Anime } }> => 
      result.status === 'fulfilled'
    )
    .map((result) => result.value.data.Media);
}

/**
 * Get top rated anime (cached 5 min)
 */
export async function getTopRatedAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:top:watchable:${page}:${perPage}`;
  const result = await fetchAnilistListWithFallback(
    cacheKey,
    () =>
      executeQuery<AnimeSearchResult>(SEARCH_QUERY, {
        page,
        perPage,
        sort: ['SCORE_DESC'],
        status_in: WATCHABLE_CATALOG_STATUSES,
      }),
    getJikanTopRated,
    page,
    perPage,
    'popular'
  );
  return keepWatchableSearchResult(result);
}

/**
 * Get anime by season (cached 5 min)
 */
export async function getAnimeBySeason(
  season: string,
  year: number,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:season:${season}:${year}:${page}:${perPage}`;
  return fetchAnilistListWithFallback(
    cacheKey,
    () =>
      executeQuery<AnimeSearchResult>(SEARCH_QUERY, {
        page,
        perPage,
        season,
        year,
        sort: ['POPULARITY_DESC'],
      }),
    getJikanPopular,
    page,
    perPage,
    'trending'
  );
}
