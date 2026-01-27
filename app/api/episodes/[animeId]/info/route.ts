/**
 * Anime Info API Route
 * GET /api/episodes/[animeId]/info - Get anime streaming info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeInfo } from '@/lib/api/consumet';

export async function GET(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const { animeId } = params;

    if (!animeId) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    const result = await getAnimeInfo(animeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/episodes/[animeId]/info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime info' },
      { status: 500 }
    );
  }
}
