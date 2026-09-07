/**
 * useAnime Hook
 * React Query hooks for anime data fetching
 */

import { useQuery } from '@tanstack/react-query';
import type { Anime, AnimeSearchResult, AnimeFilters } from '@/types';
import { CACHE_DURATIONS } from '@/constants/api';

const CLIENT_FETCH_TIMEOUT_MS = 25_000;

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = CLIENT_FETCH_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get trending anime
 */
export function useTrendingAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['trending-anime', page, perPage],
    queryFn: () =>
      fetchJsonWithTimeout<AnimeSearchResult>(
        `/api/anime?type=trending&page=${page}&perPage=${perPage}`
      ),
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Get popular anime
 */
export function usePopularAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['popular-anime', page, perPage],
    queryFn: () =>
      fetchJsonWithTimeout<AnimeSearchResult>(
        `/api/anime?type=popular&page=${page}&perPage=${perPage}`
      ),
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Get top rated anime
 */
export function useTopRatedAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['top-rated-anime', page, perPage],
    queryFn: () =>
      fetchJsonWithTimeout<AnimeSearchResult>(
        `/api/anime?type=top-rated&page=${page}&perPage=${perPage}`
      ),
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Get anime by ID
 */
export function useAnimeById(id: string | null) {
  return useQuery<{ data: { Media: Anime } }>({
    queryKey: ['anime', id],
    queryFn: () => {
      if (!id) throw new Error('Anime ID is required');
      return fetchJsonWithTimeout<{ data: { Media: Anime } }>(`/api/anime/${encodeURIComponent(id)}`);
    },
    enabled: !!id,
    staleTime: CACHE_DURATIONS.ANIME_DETAIL * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

/**
 * Search anime with filters
 */
export function useSearchAnime(filters: AnimeFilters, page = 1, perPage = 20) {
  const searchParams = new URLSearchParams();

  if (filters.search) searchParams.set('search', filters.search);
  if (filters.genres?.length) searchParams.set('genres', filters.genres.join(','));
  if (filters.year) searchParams.set('year', filters.year.toString());
  if (filters.season) searchParams.set('season', filters.season);
  if (filters.format) searchParams.set('format', filters.format);
  if (filters.status) searchParams.set('status', filters.status);
  if (filters.sort) searchParams.set('sort', filters.sort);
  searchParams.set('page', page.toString());
  searchParams.set('perPage', perPage.toString());

  const queryString = searchParams.toString();

  return useQuery<AnimeSearchResult>({
    queryKey: ['search-anime', filters, page, perPage],
    queryFn: () => fetchJsonWithTimeout<AnimeSearchResult>(`/api/search?${queryString}`),
    enabled: true,
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Get anime by season
 */
export function useAnimeBySeason(season: string, year: number, page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['anime-season', season, year, page, perPage],
    queryFn: () =>
      fetchJsonWithTimeout<AnimeSearchResult>(
        `/api/anime?type=season&season=${season}&year=${year}&page=${page}&perPage=${perPage}`
      ),
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
    placeholderData: (previous) => previous,
  });
}
