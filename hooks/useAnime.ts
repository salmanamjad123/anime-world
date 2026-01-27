/**
 * useAnime Hook
 * React Query hooks for anime data fetching
 */

import { useQuery } from '@tanstack/react-query';
import type { Anime, AnimeSearchResult, AnimeFilters } from '@/types';
import { CACHE_DURATIONS } from '@/constants/api';

/**
 * Get trending anime
 */
export function useTrendingAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['trending-anime', page, perPage],
    queryFn: async () => {
      const response = await fetch(`/api/anime?type=trending&page=${page}&perPage=${perPage}`);
      if (!response.ok) throw new Error('Failed to fetch trending anime');
      return response.json();
    },
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}

/**
 * Get popular anime
 */
export function usePopularAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['popular-anime', page, perPage],
    queryFn: async () => {
      const response = await fetch(`/api/anime?type=popular&page=${page}&perPage=${perPage}`);
      if (!response.ok) throw new Error('Failed to fetch popular anime');
      return response.json();
    },
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}

/**
 * Get top rated anime
 */
export function useTopRatedAnime(page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['top-rated-anime', page, perPage],
    queryFn: async () => {
      const response = await fetch(`/api/anime?type=top-rated&page=${page}&perPage=${perPage}`);
      if (!response.ok) throw new Error('Failed to fetch top rated anime');
      return response.json();
    },
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}

/**
 * Get anime by ID
 */
export function useAnimeById(id: string | null) {
  return useQuery<{ data: { Media: Anime } }>({
    queryKey: ['anime', id],
    queryFn: async () => {
      if (!id) throw new Error('Anime ID is required');
      const response = await fetch(`/api/anime/${id}`);
      if (!response.ok) throw new Error('Failed to fetch anime details');
      return response.json();
    },
    enabled: !!id,
    staleTime: CACHE_DURATIONS.ANIME_DETAIL * 1000,
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

  return useQuery<AnimeSearchResult>({
    queryKey: ['search-anime', filters, page, perPage],
    queryFn: async () => {
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to search anime');
      return response.json();
    },
    enabled: !!(filters.search || filters.genres?.length || filters.year),
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}

/**
 * Get anime by season
 */
export function useAnimeBySeason(season: string, year: number, page = 1, perPage = 20) {
  return useQuery<AnimeSearchResult>({
    queryKey: ['anime-season', season, year, page, perPage],
    queryFn: async () => {
      const response = await fetch(
        `/api/anime?type=season&season=${season}&year=${year}&page=${page}&perPage=${perPage}`
      );
      if (!response.ok) throw new Error('Failed to fetch seasonal anime');
      return response.json();
    },
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}
