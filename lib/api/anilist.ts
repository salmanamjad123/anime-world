/**
 * AniList API Client
 * GraphQL client for fetching anime metadata from AniList
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import {
  fetchAnilistListWithFallback,
  fetchAnilistDetailWithFallback,
  getJikanTrending,
  getJikanPopular,
  getJikanTopRated,
  isAnilistOutage,
} from './anilist-resilience';
import { searchJikanAnime } from './jikan';
import { getHiAnimeBrowseList, searchHiAnimeAsList } from './hianime-fallback';
import type {
  Anime,
  AnimeSearchResult,
  AnimeSearchFallbackSource,
  AnimeFilters,
} from '@/types';

const RATE_LIMIT_RETRY_MS = 60_000; // wait 1 min on 429 then retry

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
      media(type: ANIME, sort: TRENDING_DESC) {
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
      media(type: ANIME, sort: POPULARITY_DESC) {
        ${ANIME_FIELDS}
      }
    }
  }
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
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(
        type: ANIME
        search: $search
        genre_in: $genres
        seasonYear: $year
        season: $season
        format: $format
        status: $status
        sort: $sort
      ) {
        ${ANIME_FIELDS}
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
 * Execute GraphQL query. Retries once after 1 min on 429 (rate limit).
 */
async function executeQuery<T>(query: string, variables: Record<string, any> = {}, retryCount = 0): Promise<T> {
  try {
    const response = await axiosInstance.post<T>(ANILIST_API_URL, {
      query,
      variables,
    });
    return response.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number; headers?: { 'retry-after'?: string } } })?.response?.status;
    if (status === 429 && retryCount < 1) {
      const retryAfter =
        (error as { response?: { headers?: { 'retry-after'?: string } } })?.response?.headers?.['retry-after'];
      const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 120_000) : RATE_LIMIT_RETRY_MS;
      console.warn(`[AniList] 429 rate limit - waiting ${waitMs / 1000}s before retry`);
      await new Promise((r) => setTimeout(r, waitMs));
      return executeQuery<T>(query, variables, retryCount + 1);
    }
    console.error('[AniList API Error]', error);
    throw error;
  }
}

/**
 * Get trending anime (cached 5 min)
 */
export async function getTrendingAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:trending:${page}:${perPage}`;
  return fetchAnilistListWithFallback(
    cacheKey,
    () => executeQuery<AnimeSearchResult>(TRENDING_QUERY, { page, perPage }),
    getJikanTrending,
    page,
    perPage,
    'trending'
  );
}

/**
 * Get popular anime (cached 5 min)
 */
export async function getPopularAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  const cacheKey = `anilist:popular:${page}:${perPage}`;
  return fetchAnilistListWithFallback(
    cacheKey,
    () => executeQuery<AnimeSearchResult>(POPULAR_QUERY, { page, perPage }),
    getJikanPopular,
    page,
    perPage,
    'popular'
  );
}

// AniList uses different names for some genres
const GENRE_ANILIST_MAP: Record<string, string> = {
  'Shoujo Ai': 'Girls Love',
  'Shounen Ai': 'Boys Love',
};

function mapGenresForAniList(genres: string[]): string[] {
  return genres.map((g) => GENRE_ANILIST_MAP[g] ?? g);
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
    const query = genreQuery ? `${textQuery} ${genreQuery}` : textQuery;
    const fallback: AnimeSearchFallbackSource = genreQuery
      ? 'hianime-genre'
      : 'hianime-search';

    console.warn('[AniList] Outage — HiAnime search fallback');
    try {
      const result = await searchHiAnimeAsList(query, page, perPage);
      return { ...result, _fallback: fallback };
    } catch {
      console.warn('[AniList] Outage — Jikan search fallback');
      const result = await searchJikanAnime(textQuery, page, perPage);
      return { ...result, _fallback: 'hianime-search' };
    }
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
  const variables: Record<string, unknown> = {
    page,
    perPage,
    sort: filters.sort ? [filters.sort] : ['POPULARITY_DESC'],
  };

  if (filters.search?.trim()) variables.search = filters.search.trim();
  if (filters.genres?.length) variables.genres = mapGenresForAniList(filters.genres);
  if (filters.year) variables.year = filters.year;
  if (filters.season) variables.season = filters.season;
  if (filters.format) variables.format = filters.format;
  if (filters.status) variables.status = filters.status;

  try {
    return await executeQuery<AnimeSearchResult>(SEARCH_QUERY, variables);
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;
    return searchAnimeOutageFallback(filters, page, perPage);
  }
}

/**
 * Get anime by ID (cached 24 h)
 */
export async function getAnimeById(id: string | number): Promise<{ data: { Media: Anime } }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  return fetchAnilistDetailWithFallback(numericId, () =>
    executeQuery<{ data: { Media: Anime } }>(ANIME_BY_ID_QUERY, { id: numericId })
  );
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
  const cacheKey = `anilist:top:${page}:${perPage}`;
  return fetchAnilistListWithFallback(
    cacheKey,
    () =>
      executeQuery<AnimeSearchResult>(SEARCH_QUERY, {
        page,
        perPage,
        sort: ['SCORE_DESC'],
      }),
    getJikanTopRated,
    page,
    perPage,
    'popular'
  );
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
