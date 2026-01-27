/**
 * Anime Detail API Route
 * GET /api/anime/[id] - Get anime by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeById } from '@/lib/api/anilist';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    const result = await getAnimeById(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/anime/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime details' },
      { status: 500 }
    );
  }
}
