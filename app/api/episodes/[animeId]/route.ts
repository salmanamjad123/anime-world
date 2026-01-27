/**
 * Episodes API Route
 * GET /api/episodes/[animeId] - Get episodes for an anime
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEpisodes } from '@/lib/api/consumet';

export async function GET(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const { animeId } = params;
    const searchParams = request.nextUrl.searchParams;
    const dub = searchParams.get('dub') === 'true';
    const provider = searchParams.get('provider') || 'gogoanime';

    if (!animeId) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    const result = await getEpisodes(animeId, provider, dub);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/episodes/[animeId]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
