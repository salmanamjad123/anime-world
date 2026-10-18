/**
 * Stream API Route
 * GET /api/stream/[episodeId] - Get streaming sources for an episode
 *
 * 3-tier cache: Redis → Firestore → HiAnime
 * ?refresh=true - bypass cache for broken link recovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHiAnimeStreamSources } from '@/lib/api/hianime';
import { getStreamCached } from '@/lib/api/stream-cache';
import { HIANIME_API_URL } from '@/constants/api';
import { retry } from '@/lib/utils/retry';
import { uncachedJson } from '@/lib/http-cache';

const STREAM_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId: rawEpisodeId } = await params;
    let episodeId = decodeURIComponent(rawEpisodeId);

    // Get query parameters
    const url = new URL(request.url);
    
    // IMPORTANT: Next.js treats ?ep=123 as a query param, not part of the route
    // So we need to reconstruct the full episode ID from both path and query
    const epParam = url.searchParams.get('ep');
    if (epParam && !episodeId.includes('?ep=')) {
      episodeId = `${episodeId}?ep=${epParam}`;
    }

    if (!episodeId) {
      return uncachedJson({ error: 'Episode ID is required' }, 400);
    }

    // Get language preference and server
    const category = (url.searchParams.get('category') || 'sub') as 'sub' | 'dub' | 'raw';
    const server = url.searchParams.get('server') || 'hd-1';
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Validate episode ID format (HiAnime format required)
    if (!episodeId.includes('?ep=')) {
      console.error('❌ [Stream API] Invalid episode ID format (missing ?ep=)');
      return uncachedJson(
        {
          error: 'Streaming server down',
          message: 'The streaming server was unavailable when this page loaded. Please go back to the anime page and refresh, then try again.',
          episodeId,
        },
        503
      );
    }

    // Fetch streaming sources: Redis → Firestore → HiAnime (no blocking health pre-check)
    const serversToTry = server === 'hd-1' ? ['hd-1', 'hd-2'] : [server];
    let lastError: unknown;

    try {
      for (const tryServer of serversToTry) {
        try {
          const sources = await getStreamCached(
            episodeId,
            tryServer,
            category,
            () =>
              retry(
                () => getHiAnimeStreamSources(episodeId, category, tryServer),
                {
                  maxAttempts: 1,
                  delayMs: 0,
                  shouldRetry: (error: unknown) => {
                    const err = error as { response?: { status?: number }; status?: number; name?: string };
                    const status = err?.response?.status ?? err?.status ?? 0;
                    return status >= 500 || err?.name === 'FetchError';
                  },
                }
              ),
            forceRefresh
          );

          // Accept HLS sources OR embed-only (Anikoto/Megaplay iframe playback)
          if (
            (sources?.sources && sources.sources.length > 0) ||
            sources?.embedUrl
          ) {
            return NextResponse.json(sources, { headers: STREAM_NO_STORE });
          }
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError ?? new Error('No streaming sources available');
    } catch (error: any) {
      console.error('═══════════════════════════════════════════════');
      console.error('❌ [Stream API] FAILED');
      console.error('🚫 Episode ID:', episodeId);
      console.error('⚠️  Error:', error.message);
      console.error('═══════════════════════════════════════════════');
      console.error('');
      console.error('💡 Possible reasons:');
      console.error('   1. Episode not available on HiAnime');
      console.error('   2. Episode ID mapping is incorrect');
      console.error('   3. HiAnime API is experiencing issues');
      console.error('');
      console.error('💡 Solutions:');
      console.error('   1. Try a different server (hd-1, hd-2, megacloud)');
      console.error('   2. Verify the anime exists on hianime.to');
      console.error('   3. Check HiAnime API at', HIANIME_API_URL);
      console.error('═══════════════════════════════════════════════');
    }
    
    return uncachedJson(
      {
        error: 'Streaming server down',
        message: 'The streaming server is temporarily unavailable. Please try again later.',
        episodeId,
        suggestions: [
          `Ensure HiAnime API is running at ${HIANIME_API_URL}`,
          'Refresh the page and try again',
        ],
      },
      503
    );
  } catch (error: any) {
    console.error('═══════════════════════════════════════════════');
    console.error('[API Error] /api/stream/[episodeId]:', error.message);
    console.error('═══════════════════════════════════════════════');
    
    return uncachedJson(
      {
        error: 'Failed to fetch streaming sources',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      500
    );
  }
}
