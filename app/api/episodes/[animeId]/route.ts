/**
 * Episodes API Route
 * GET /api/episodes/[animeId] - Get episodes for an anime
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEpisodesMultiSource } from '@/lib/api/reliable-episodes';
import { getAnimeById } from '@/lib/api/anilist';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ animeId: string }> }
) {
  try {
    const { animeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dub = searchParams.get('dub') === 'true';

    if (!animeId) {
      return NextResponse.json(
        { error: 'Anime ID is required' },
        { status: 400 }
      );
    }

    // Get anime info from AniList first
    const animeData = await getAnimeById(animeId);
    const anime = animeData.data.Media;
    
    if (!anime) {
      return NextResponse.json(
        { error: 'Anime not found' },
        { status: 404 }
      );
    }

    // Get the anime title and episode count
    const animeTitle = anime.title.english || anime.title.romaji;
    const episodeCount = anime.episodes || 0;
    const malId = anime.malId;

    // Use multi-source fetcher with fallbacks
    const result = await getEpisodesMultiSource(
      animeId,
      malId,
      animeTitle,
      episodeCount,
      dub
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/episodes/[animeId]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
