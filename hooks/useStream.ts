/**
 * useStream Hook
 * React Query hook for fetching streaming sources
 */

import { useQuery } from '@tanstack/react-query';
import type { StreamSourcesResponse } from '@/types';

/**
 * Get streaming sources for an episode
 */
export function useStreamingSources(episodeId: string | null, provider: string = 'gogoanime') {
  return useQuery<StreamSourcesResponse>({
    queryKey: ['stream', episodeId, provider],
    queryFn: async () => {
      if (!episodeId) throw new Error('Episode ID is required');
      
      const response = await fetch(`/api/stream/${episodeId}?provider=${provider}`);
      if (!response.ok) throw new Error('Failed to fetch streaming sources');
      return response.json();
    },
    enabled: !!episodeId,
    staleTime: 0, // Don't cache - links expire quickly
    gcTime: 0, // Don't keep in cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Get streaming sources with automatic fallback
 */
export function useStreamingSourcesWithFallback(episodeId: string | null) {
  return useQuery<StreamSourcesResponse>({
    queryKey: ['stream-fallback', episodeId],
    queryFn: async () => {
      if (!episodeId) throw new Error('Episode ID is required');
      
      const response = await fetch(`/api/stream/${episodeId}?fallback=true`);
      if (!response.ok) throw new Error('Failed to fetch streaming sources');
      return response.json();
    },
    enabled: !!episodeId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 3, // Retry up to 3 times if it fails
  });
}
