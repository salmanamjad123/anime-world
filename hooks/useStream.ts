/**
 * useStream Hook
 * React Query hook for fetching streaming sources
 */

import { useQuery } from '@tanstack/react-query';
import type { StreamSourcesResponse } from '@/types';

type StreamCategory = 'sub' | 'dub' | 'raw';

export interface StreamFetchOptions {
  category?: StreamCategory;
  server?: string;
  /** Bypass Redis/Firestore and fetch fresh m3u8 from streaming-api */
  refresh?: boolean;
}

/**
 * Build /api/stream URL from HiAnime episode id (slug?ep=123).
 * Next.js route expects ?ep= as a query param when the slug has no embedded ?.
 */
export function buildStreamApiUrl(
  episodeId: string,
  options: StreamFetchOptions = {}
): string {
  const { category = 'sub', server = 'hd-1', refresh = false } = options;

  let slug = episodeId;
  let ep: string | null = null;

  if (episodeId.includes('?ep=')) {
    const [s, e] = episodeId.split('?ep=');
    slug = s;
    ep = e?.split('&')[0] ?? null;
  }

  const params = new URLSearchParams({
    category,
    server,
  });
  if (ep) params.set('ep', ep);
  if (refresh) params.set('refresh', 'true');

  return `/api/stream/${encodeURIComponent(slug)}?${params.toString()}`;
}

async function fetchStreamSources(
  episodeId: string,
  options: StreamFetchOptions
): Promise<StreamSourcesResponse> {
  const url = buildStreamApiUrl(episodeId, options);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ||
        (body as { error?: string }).error ||
        'Failed to fetch streaming sources'
    );
  }
  return response.json();
}

/**
 * Get streaming sources for an episode
 */
export function useStreamingSources(episodeId: string | null, provider: string = 'gogoanime') {
  return useQuery<StreamSourcesResponse>({
    queryKey: ['stream', episodeId, provider],
    queryFn: async () => {
      if (!episodeId) throw new Error('Episode ID is required');
      const separator = episodeId.includes('?') ? '&' : '?';
      const response = await fetch(`/api/stream/${episodeId}${separator}provider=${provider}`);
      if (!response.ok) throw new Error('Failed to fetch streaming sources');
      return response.json();
    },
    enabled: !!episodeId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

/**
 * Stream sources with server fallback (hd-1 → hd-2) and optional cache bust.
 *
 * refreshNonce > 0: adds refresh=true so expired CDN links are refetched.
 * Server route also tries hd-2 when hd-1 fails.
 */
export function useStreamingSourcesWithFallback(
  episodeId: string | null,
  category: StreamCategory = 'sub',
  server: string = 'hd-1',
  refreshNonce: number = 0
) {
  return useQuery<StreamSourcesResponse>({
    queryKey: ['stream-fallback', episodeId, category, server, refreshNonce],
    queryFn: async () => {
      if (!episodeId) throw new Error('Episode ID is required');

      const refresh = refreshNonce > 0;

      try {
        return await fetchStreamSources(episodeId, { category, server, refresh });
      } catch (firstErr) {
        // Client-side fallback: alternate server if primary fails
        const altServer = server === 'hd-1' ? 'hd-2' : 'hd-1';
        if (altServer === server) throw firstErr;
        return fetchStreamSources(episodeId, {
          category,
          server: altServer,
          refresh: true,
        });
      }
    },
    enabled: !!episodeId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
