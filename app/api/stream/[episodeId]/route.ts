/**
 * Stream API Route
 * GET /api/stream/[episodeId] - Get streaming sources for an episode
 * 
 * Uses ONLY HiAnime API (Direct) - Production-ready, reliable
 * NO FALLBACKS - Clean and simple
 * NO PLACEHOLDER - Only returns real anime streams or error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHiAnimeStreamSources, isHiAnimeAvailable } from '@/lib/api/hianime';
import { retry } from '@/lib/utils/retry';

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
    console.log('📺 [Stream API] Using HiAnime API only');
    console.log('═══════════════════════════════════════════════');

    // Get language preference and server
    const category = (url.searchParams.get('category') || 'sub') as 'sub' | 'dub' | 'raw';
    const server = url.searchParams.get('server') || 'hd-1';

    // Validate episode ID format
    if (!episodeId.includes('?ep=')) {
      console.error('❌ [Stream API] Invalid episode ID format (missing ?ep=)');
      return NextResponse.json(
        { 
          error: 'Invalid episode ID format',
          message: 'Episode ID must be in HiAnime format (anime-id?ep=12345)',
          episodeId,
        },
        { status: 400 }
      );
    }

    // Check HiAnime API availability
    const hiAnimeAvailable = await Promise.race([
      isHiAnimeAvailable(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]).catch(() => false) as boolean;
    
    if (!hiAnimeAvailable) {
      console.error('❌ [Stream API] HiAnime API not available at localhost:4000');
      return NextResponse.json(
        { 
          error: 'HiAnime API not available',
          message: 'Make sure the HiAnime API is running at http://localhost:4000',
          suggestions: [
            'Check if aniwatch-api is running in terminal',
            'Verify the API is accessible at http://localhost:4000',
            'Restart the HiAnime API if needed',
          ]
        },
        { status: 503 }
      );
    }

    console.log('📺 [HiAnime API] Episode ID:', episodeId);
    console.log('🎙️ [HiAnime API] Category:', category);
    console.log('🖥️ [HiAnime API] Server:', server);
    
    // Fetch streaming sources with retry logic
    try {
      const sources = await retry(
        () => getHiAnimeStreamSources(episodeId, category, server),
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
        console.log('✅ [HiAnime API] SUCCESS!');
        console.log('🎥 Found', sources.sources.length, 'source(s)');
        console.log('📝 Found', sources.subtitles?.length || 0, 'subtitle(s)');
        console.log('🎬 Quality:', sources.sources[0]?.quality);
        console.log('═══════════════════════════════════════════════');
        
        return NextResponse.json(sources);
      }
      
      // No sources found
      console.error('❌ [HiAnime API] No sources returned');
      throw new Error('No streaming sources available for this episode');
      
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
      console.error('   3. Check HiAnime API logs at localhost:4000');
      console.error('═══════════════════════════════════════════════');
    }
    
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
