/**
 * useEpisodes Hook
 * React Query hook for fetching anime episodes
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import type { EpisodeListResponse } from '@/types';
import { CACHE_DURATIONS } from '@/constants/api';

/**
 * Get episodes for an anime
 */
export function useEpisodes(animeId: string | null, isDub: boolean = false) {
  return useQuery<EpisodeListResponse>({
    queryKey: ['episodes', animeId, isDub ? 'dub' : 'sub'],
    queryFn: async () => {
      if (!animeId) throw new Error('Anime ID is required');
      
      const response = await fetch(`/api/episodes/${animeId}?dub=${isDub}`);
      if (!response.ok) throw new Error('Failed to fetch episodes');
      return response.json();
    },
    enabled: !!animeId,
    staleTime: CACHE_DURATIONS.EPISODE_LIST * 1000,
  });
}

/**
 * Get episode counts for all seasons in parallel.
 * Returns a map of seasonId -> episode count (or null if still loading/failed).
 */
export function useEpisodesForSeasons(
  seasons: Array<{ id: string }>,
  isDub: boolean = false
): Record<string, number | null> {
  const results = useQueries({
    queries: seasons.map((season) => ({
      queryKey: ['episodes', season.id, isDub ? 'dub' : 'sub'],
      queryFn: async () => {
        const response = await fetch(`/api/episodes/${season.id}?dub=${isDub}`);
        if (!response.ok) throw new Error('Failed to fetch episodes');
        return response.json() as Promise<EpisodeListResponse>;
      },
      enabled: seasons.length > 0,
      staleTime: CACHE_DURATIONS.EPISODE_LIST * 1000,
    })),
  });

  const counts: Record<string, number | null> = {};
  seasons.forEach((season, i) => {
    const result = results[i];
    if (result?.data?.episodes) {
      counts[season.id] = result.data.episodes.length;
    } else if (result?.data?.totalEpisodes != null) {
      counts[season.id] = result.data.totalEpisodes;
    } else if (result?.isSuccess && result?.data) {
      counts[season.id] = 0;
    } else {
      counts[season.id] = null;
    }
  });
  return counts;
}

/**
 * Get anime info with streaming metadata
 */
export function useAnimeInfo(animeId: string | null) {
  return useQuery<{
    id: string;
    title: string;
    totalEpisodes: number;
    hasDub: boolean;
    hasSub: boolean;
  }>({
    queryKey: ['anime-info', animeId],
    queryFn: async () => {
      if (!animeId) throw new Error('Anime ID is required');
      
      const response = await fetch(`/api/episodes/${animeId}/info`);
      if (!response.ok) throw new Error('Failed to fetch anime info');
      return response.json();
    },
    enabled: !!animeId,
    staleTime: CACHE_DURATIONS.ANIME_DETAIL * 1000,
  });
}
