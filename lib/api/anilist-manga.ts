/**
 * AniList Manga API Client
 * GraphQL client for manga metadata with Redis cache and outage fallback
 */

import { getCached, CACHE_TTL } from '@/lib/cache';
import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import {
  fetchAnilistMangaListWithFallback,
  fetchAnilistMangaDetailWithFallback,
  getJikanTrendingManga,
  getJikanPopularManga,
  isAnilistOutage,
} from './anilist-manga-resilience';
import { getMangaDexBrowseList, searchMangaDexAsList } from './mangadex-fallback';
import { searchJikanManga } from './jikan-manga';
import type { Manga, MangaSearchResult, MangaSearchFallbackSource } from '@/types';

const RATE_LIMIT_RETRY_MS = 60_000;

const MANGA_FIELDS = `
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
  chapters
  volumes
  startDate {
    year
    month
    day
  }
  endDate {
    year
    month
    day
  }
  tags {
    id
    name
    rank
  }
`;

const TRENDING_MANGA_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, sort: TRENDING_DESC) {
        ${MANGA_FIELDS}
      }
    }
  }
`;

const POPULAR_MANGA_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, sort: POPULARITY_DESC) {
        ${MANGA_FIELDS}
      }
    }
  }
`;

const MANGA_BY_ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      ${MANGA_FIELDS}
    }
  }
`;

const MANGA_SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, search: $search, sort: [POPULARITY_DESC]) {
        ${MANGA_FIELDS}
      }
    }
  }
`;

const MANGA_BY_GENRE_QUERY = `
  query ($page: Int, $perPage: Int, $genres: [String], $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, genre_in: $genres, sort: $sort) {
        ${MANGA_FIELDS}
      }
    }
  }
`;

async function executeQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retryCount = 0
): Promise<T> {
  try {
    const response = await axiosInstance.post<T>(ANILIST_API_URL, {
      query,
      variables,
    });
    return response.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number; headers?: { 'retry-after'?: string } } })
      ?.response?.status;
    if (status === 429 && retryCount < 1) {
      const retryAfter = (error as { response?: { headers?: { 'retry-after'?: string } } })
        ?.response?.headers?.['retry-after'];
      const waitMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 120_000) : RATE_LIMIT_RETRY_MS;
      console.warn(`[AniList Manga] 429 rate limit - waiting ${waitMs / 1000}s before retry`);
      await new Promise((r) => setTimeout(r, waitMs));
      return executeQuery<T>(query, variables, retryCount + 1);
    }
    console.error('[AniList Manga API Error]', error);
    throw error;
  }
}

/** MangaDex/Jikan fallback when AniList search is unavailable */
async function searchMangaOutageFallback(
  search: string,
  page: number,
  perPage: number
): Promise<MangaSearchResult> {
  const textQuery = search.trim();

  if (textQuery) {
    console.warn('[AniList] Outage — MangaDex search fallback');
    try {
      const result = await searchMangaDexAsList(textQuery, page, perPage);
      if (result.data.Page.media.length > 0) {
        return { ...result, _fallback: 'mangadex-search' as MangaSearchFallbackSource };
      }
    } catch {
      /* fall through to Jikan */
    }

    console.warn('[AniList] Outage — Jikan manga search fallback');
    const result = await searchJikanManga(textQuery, page, perPage);
    return { ...result, _fallback: 'mangadex-search' as MangaSearchFallbackSource };
  }

  console.warn('[AniList] Outage — MangaDex browse fallback for manga search');
  const browse = await getMangaDexBrowseList(page, perPage, 'popular');
  return { ...browse, _fallback: 'mangadex-browse' as MangaSearchFallbackSource };
}

export async function getTrendingManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  const cacheKey = `manga:trending:${page}:${perPage}`;
  return fetchAnilistMangaListWithFallback(
    cacheKey,
    () => executeQuery<MangaSearchResult>(TRENDING_MANGA_QUERY, { page, perPage }),
    getJikanTrendingManga,
    page,
    perPage,
    'trending'
  );
}

export async function getPopularManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  const cacheKey = `manga:popular:${page}:${perPage}`;
  return fetchAnilistMangaListWithFallback(
    cacheKey,
    () => executeQuery<MangaSearchResult>(POPULAR_MANGA_QUERY, { page, perPage }),
    getJikanPopularManga,
    page,
    perPage,
    'popular'
  );
}

export async function getMangaById(id: string | number): Promise<{ data: { Media: Manga } }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  return fetchAnilistMangaDetailWithFallback(numericId, () =>
    executeQuery<{ data: { Media: Manga } }>(MANGA_BY_ID_QUERY, { id: numericId })
  );
}

export async function searchManga(
  search: string,
  page = 1,
  perPage = 25
): Promise<MangaSearchResult> {
  const key = `manga:search:${search}:${page}:${perPage}`;

  try {
    return await getCached(
      key,
      () =>
        executeQuery<MangaSearchResult>(MANGA_SEARCH_QUERY, {
          search,
          page,
          perPage,
        }),
      CACHE_TTL.MANGA_LIST
    );
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;
    return searchMangaOutageFallback(search, page, perPage);
  }
}

export async function getMangaByGenre(
  genres: string[],
  page = 1,
  perPage = 20,
  sort: 'POPULARITY_DESC' | 'TRENDING_DESC' = 'POPULARITY_DESC'
): Promise<MangaSearchResult> {
  const cacheKey = `manga:genre:${genres.join(',')}:${page}:${perPage}:${sort}`;

  try {
    return await getCached(
      cacheKey,
      () =>
        executeQuery<MangaSearchResult>(MANGA_BY_GENRE_QUERY, {
          genres,
          page,
          perPage,
          sort: [sort],
        }),
      CACHE_TTL.MANGA_LIST
    );
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const genreQuery = genres.join(' ');
    console.warn('[AniList] Outage — genre search fallback for manga');
    try {
      const result = await searchMangaDexAsList(genreQuery, page, perPage);
      if (result.data.Page.media.length > 0) {
        return { ...result, _fallback: 'mangadex-genre' as MangaSearchFallbackSource };
      }
    } catch {
      /* fall through */
    }

    const browse = await getMangaDexBrowseList(page, perPage, 'popular');
    return { ...browse, _fallback: 'mangadex-browse' as MangaSearchFallbackSource };
  }
}
