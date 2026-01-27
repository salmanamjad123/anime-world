/**
 * Stream API Route
 * GET /api/stream/[episodeId] - Get streaming sources for an episode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStreamingSources, getStreamingSourcesWithFallback } from '@/lib/api/consumet';

export async function GET(
  request: NextRequest,
  { params }: { params: { episodeId: string } }
) {
  try {
    const { episodeId } = params;
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider') || 'gogoanime';
    const fallback = searchParams.get('fallback') === 'true';

    if (!episodeId) {
      return NextResponse.json(
        { error: 'Episode ID is required' },
        { status: 400 }
      );
    }

    let result;

    if (fallback) {
      result = await getStreamingSourcesWithFallback(episodeId, provider);
      
      if (!result) {
        return NextResponse.json(
          { error: 'No streaming sources available' },
          { status: 404 }
        );
      }
    } else {
      result = await getStreamingSources(episodeId, provider);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/stream/[episodeId]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streaming sources' },
      { status: 500 }
    );
  }
}
