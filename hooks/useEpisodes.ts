/**
 * useEpisodes Hook
 * React Query hook for fetching anime episodes
 */

import { useQuery } from '@tanstack/react-query';
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
