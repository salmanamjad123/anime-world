/**
 * AniList Manga API Client
 * GraphQL client for manga metadata with Redis cache
 */

import { getCached, CACHE_TTL } from '@/lib/cache';
import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import type { Manga, MangaSearchResult } from '@/types';

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

async function executeQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await axiosInstance.post<T>(ANILIST_API_URL, {
    query,
    variables,
  });
  return response.data;
}

export async function getTrendingManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  const key = `manga:trending:${page}:${perPage}`;
  return getCached(
    key,
    () => executeQuery<MangaSearchResult>(TRENDING_MANGA_QUERY, { page, perPage }),
    CACHE_TTL.MANGA_INFO
  );
}

export async function getPopularManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  const key = `manga:popular:${page}:${perPage}`;
  return getCached(
    key,
    () => executeQuery<MangaSearchResult>(POPULAR_MANGA_QUERY, { page, perPage }),
    CACHE_TTL.MANGA_INFO
  );
}

export async function getMangaById(id: string | number): Promise<{ data: { Media: Manga } }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  const key = `manga:detail:${numericId}`;
  return getCached(
    key,
    () => executeQuery<{ data: { Media: Manga } }>(MANGA_BY_ID_QUERY, { id: numericId }),
    CACHE_TTL.MANGA_INFO
  );
}

export async function searchManga(
  search: string,
  page = 1,
  perPage = 25
): Promise<MangaSearchResult> {
  const key = `manga:search:${search}:${page}:${perPage}`;
  return getCached(
    key,
    () =>
      executeQuery<MangaSearchResult>(MANGA_SEARCH_QUERY, {
        search,
        page,
        perPage,
      }),
    CACHE_TTL.MANGA_INFO
  );
}

export async function getMangaByGenre(
  genres: string[],
  page = 1,
  perPage = 20,
  sort: 'POPULARITY_DESC' | 'TRENDING_DESC' = 'POPULARITY_DESC'
): Promise<MangaSearchResult> {
  const key = `manga:genre:${genres.join(',')}:${page}:${perPage}:${sort}`;
  return getCached(
    key,
    () =>
      executeQuery<MangaSearchResult>(MANGA_BY_GENRE_QUERY, {
        genres,
        page,
        perPage,
        sort: [sort],
      }),
    CACHE_TTL.MANGA_INFO
  );
}
