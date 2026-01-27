/**
 * Anime Info API Route
 * GET /api/episodes/[animeId]/info - Get anime streaming info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeById } from '@/lib/api/anilist';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string }> }
) {
  try {
    const { animeId } = await params;

    if (!animeId) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    // Get from AniList which is always reliable
    const animeData = await getAnimeById(animeId);
    const anime = animeData.data.Media;

    // Return info based on AniList data
    const result = {
      id: animeId,
      title: anime.title.english || anime.title.romaji,
      totalEpisodes: anime.episodes || 0,
      hasDub: true, // Assume both are available
      hasSub: true,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/episodes/[animeId]/info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime info' },
      { status: 500 }
    );
  }
}
