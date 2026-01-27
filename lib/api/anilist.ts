/**
 * AniList API Client
 * GraphQL client for fetching anime metadata from AniList
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import type { Anime, AnimeSearchResult, AnimeFilters } from '@/types';

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
 * Execute GraphQL query
 */
async function executeQuery<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  try {
    const response = await axiosInstance.post<T>(ANILIST_API_URL, {
      query,
      variables,
    });
    return response.data;
  } catch (error) {
    console.error('[AniList API Error]', error);
    throw new Error('Failed to fetch data from AniList');
  }
}

/**
 * Get trending anime
 */
export async function getTrendingAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return executeQuery<AnimeSearchResult>(TRENDING_QUERY, { page, perPage });
}

/**
 * Get popular anime
 */
export async function getPopularAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return executeQuery<AnimeSearchResult>(POPULAR_QUERY, { page, perPage });
}

/**
 * Search anime with filters
 */
export async function searchAnime(
  filters: AnimeFilters,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  const variables = {
    page,
    perPage,
    search: filters.search,
    genres: filters.genres,
    year: filters.year,
    season: filters.season,
    format: filters.format,
    status: filters.status,
    sort: filters.sort ? [filters.sort] : ['POPULARITY_DESC'],
  };

  return executeQuery<AnimeSearchResult>(SEARCH_QUERY, variables);
}

/**
 * Get anime by ID
 */
export async function getAnimeById(id: string | number): Promise<{ data: { Media: Anime } }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  return executeQuery<{ data: { Media: Anime } }>(ANIME_BY_ID_QUERY, { id: numericId });
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
 * Get top rated anime
 */
export async function getTopRatedAnime(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return executeQuery<AnimeSearchResult>(
    SEARCH_QUERY,
    {
      page,
      perPage,
      sort: ['SCORE_DESC'],
    }
  );
}

/**
 * Get anime by season
 */
export async function getAnimeBySeason(
  season: string,
  year: number,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  return executeQuery<AnimeSearchResult>(
    SEARCH_QUERY,
    {
      page,
      perPage,
      season,
      year,
      sort: ['POPULARITY_DESC'],
    }
  );
}
