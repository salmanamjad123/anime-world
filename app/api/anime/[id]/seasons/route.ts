/**
 * Anime Seasons API Route
 * GET /api/anime/[id]/seasons - Get all seasons and related content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeSeasons } from '@/lib/api/anime-relations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    const result = await getAnimeSeasons(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/anime/[id]/seasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}
