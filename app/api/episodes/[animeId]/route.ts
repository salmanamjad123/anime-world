/**
 * Episodes API Route
 * GET /api/episodes/[animeId] - Get episodes for an anime (AniList id or HiAnime slug)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEpisodesMultiSource } from '@/lib/api/reliable-episodes';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeEpisodesStandard } from '@/lib/api/hianime';

function isAniListId(id: string): boolean {
  return /^\d+$/.test(id);
}

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

    // HiAnime slug: fetch episodes directly from HiAnime (no AniList)
    if (!isAniListId(animeId)) {
      try {
        const result = await getHiAnimeEpisodesStandard(animeId, animeId);
        return NextResponse.json(result);
      } catch (error) {
        console.error('[API Error] /api/episodes/[animeId] HiAnime:', error);
        return NextResponse.json(
          { error: 'Anime not found', episodes: [], totalEpisodes: 0, animeId },
          { status: 404 }
        );
      }
    }

    // AniList id: get anime info then multi-source episodes
    const animeData = await getAnimeById(animeId);
    const anime = animeData.data.Media;

    if (!anime) {
      return NextResponse.json(
        { error: 'Anime not found' },
        { status: 404 }
      );
    }

    const animeTitle = anime.title.english || anime.title.romaji;
    const episodeCount = anime.episodes || 0;
    const malId = anime.malId;

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
