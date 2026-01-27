/**
 * Stream API Route
 * GET /api/stream/[episodeId] - Get streaming sources for an episode
 * 
 * Multi-Tier Streaming Strategy:
 * TIER 1: HiAnime API (Direct) - Fastest, most reliable
 * TIER 2: Consumet Multi-Provider - Fallback
 * 
 * NO PLACEHOLDER - Only returns real anime streams or error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStreamingSourcesWithFallback } from '@/lib/api/consumet';
import { getHiAnimeStreamSources, isHiAnimeAvailable } from '@/lib/api/hianime';
import { retry, isRetryableError } from '@/lib/utils/retry';

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
      return NextResponse.json(
        { error: 'Episode ID is required' },
        { status: 400 }
      );
    }

    console.log('═══════════════════════════════════════════════');
    console.log('🎬 [Stream API] Episode requested:', episodeId);
    console.log('📋 [Stream API] Starting multi-tier streaming...');
    console.log('═══════════════════════════════════════════════');

    // Get language preference
    const category = (url.searchParams.get('category') || 'sub') as 'sub' | 'dub' | 'raw';

    // TIER 1: Try HiAnime API directly (if episode ID matches HiAnime format)
    if (episodeId.includes('?ep=')) {
      try {
        // Check availability with timeout
        const hiAnimeAvailable = await Promise.race([
          isHiAnimeAvailable(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]).catch(() => false) as boolean;
        
        if (hiAnimeAvailable) {
          console.log('🎯 [TIER 1] Trying HiAnime API (Direct)...');
          console.log('📺 [HiAnime API] Episode ID:', episodeId);
          console.log('🎙️ [HiAnime API] Category:', category);
          
          // Try with retry logic (production: 2 attempts)
          const sources = await retry(
            () => getHiAnimeStreamSources(episodeId, category),
            {
              maxAttempts: 2,
              delayMs: 1000,
              shouldRetry: (error) => {
                // Retry on network/server errors, not on 404s
                return error.status >= 500 || error.name === 'FetchError';
              },
            }
          );
          
          if (sources?.sources && sources.sources.length > 0) {
            console.log('═══════════════════════════════════════════════');
            console.log('✅ [TIER 1 - HiAnime API] SUCCESS!');
            console.log('🎥 [HiAnime API] Found', sources.sources.length, 'sources');
            console.log('🎬 [HiAnime API] Quality:', sources.sources[0]?.quality);
            console.log('🎉 [HiAnime API] Ready to play REAL anime!');
            console.log('═══════════════════════════════════════════════');
            
            return NextResponse.json(sources);
          }
        } else {
          console.warn('⚠️ [TIER 1] HiAnime API not available');
        }
      } catch (error: any) {
        console.error('❌ [TIER 1] HiAnime API failed:', error.message);
        console.log('🔄 [TIER 1] Falling back to TIER 2...');
      }
    } else {
      console.log('⚠️ [TIER 1] Episode ID not in HiAnime format (missing ?ep=)');
      console.log('🔄 [TIER 1] Skipping to TIER 2...');
    }

    // TIER 2: Try Consumet multi-provider fallback
    console.log('═══════════════════════════════════════════════');
    console.log('🎯 [TIER 2] Trying Consumet multi-provider...');
    console.log('═══════════════════════════════════════════════');
    
    const sources = await getStreamingSourcesWithFallback(episodeId);
    
    if (sources && sources.sources && sources.sources.length > 0) {
      console.log('═══════════════════════════════════════════════');
      console.log('✅ [TIER 2 - Consumet] SUCCESS!');
      console.log('🎥 [Consumet] Found', sources.sources.length, 'sources');
      console.log('🎬 [Consumet] Ready to play REAL anime!');
      console.log('═══════════════════════════════════════════════');
      
      return NextResponse.json(sources);
    }
    
    // ALL TIERS FAILED - Return error (no placeholder)
    console.error('═══════════════════════════════════════════════');
    console.error('❌ [Stream API] ALL TIERS FAILED');
    console.error('🚫 [Stream API] Episode ID:', episodeId);
    console.error('⚠️  [Stream API] No streaming sources available');
    console.error('═══════════════════════════════════════════════');
    console.error('');
    console.error('💡 Possible reasons:');
    console.error('   1. Anime not available on any provider');
    console.error('   2. Episode ID mapping is incorrect');
    console.error('   3. All streaming providers are down');
    console.error('   4. API rate limiting');
    console.error('');
    console.error('💡 Solutions:');
    console.error('   1. Make sure HiAnime API is running (http://localhost:4000)');
    console.error('   2. Try a different anime');
    console.error('   3. Check network connectivity');
    console.error('═══════════════════════════════════════════════');
    
    return NextResponse.json(
      { 
        error: 'Streaming sources not available',
        message: 'This episode could not be found on any streaming provider. The anime may not be available, or all providers are currently down.',
        episodeId,
        suggestions: [
          'Make sure HiAnime API is running at http://localhost:4000',
          'Try a different anime or episode',
          'Check if the anime is available on HiAnime.to',
          'Verify your network connection',
        ]
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('═══════════════════════════════════════════════');
    console.error('[API Error] /api/stream/[episodeId]:', error.message);
    console.error('═══════════════════════════════════════════════');
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch streaming sources',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
