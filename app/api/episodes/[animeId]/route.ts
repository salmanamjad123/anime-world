/**
 * Episodes API Route
 * GET /api/episodes/[animeId] - Get episodes for an anime (AniList id or HiAnime slug)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEpisodesMultiSource,
  EpisodesUnavailableError,
} from '@/lib/api/reliable-episodes';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeEpisodesStandard } from '@/lib/api/hianime';
import { saveEpisodesToFirestoreBackground } from '@/lib/api/episode-cache';
import { resolveAnilistIdFromSegment } from '@/lib/seo/anime-slug';

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

    const anilistId = await resolveAnilistIdFromSegment(animeId, { allowLookup: true });

    if (!anilistId) {
      const category = dub ? 'dub' : 'sub';
      const slug = animeId;
      try {
        const result = await getHiAnimeEpisodesStandard(slug, slug);
        if (result.episodes.length > 0) {
          saveEpisodesToFirestoreBackground(slug, category, slug, result);
          return NextResponse.json(result);
        }
      } catch (error) {
        console.warn('[Episodes] HiAnime slug fetch failed, trying Firebase cache');
      }
      const { getEpisodesFromFirestore } = await import('@/lib/api/episode-cache');
      const cached = await getEpisodesFromFirestore(slug, category);
      if (cached?.episodes?.length) {
        return NextResponse.json(cached);
      }
      return NextResponse.json(
        { error: 'Anime not found', episodes: [], totalEpisodes: 0, animeId: slug },
        { status: 404 }
      );
    }

    const resolvedAnilistId = anilistId;

    // AniList id (numeric or title slug): get anime info then multi-source episodes
    const animeData = await getAnimeById(resolvedAnilistId);
    const anime = animeData.data.Media;

    if (!anime) {
      return NextResponse.json(
        { error: 'Anime not found' },
        { status: 404 }
      );
    }

    const animeTitle = anime.title.english || anime.title.romaji;
    const searchTitles = [
      anime.title.english,
      anime.title.romaji,
      anime.title.native,
    ].filter((t): t is string => Boolean(t?.trim()));
    const episodeCount = anime.episodes || 0;
    const malId = anime.malId;

    const result = await getEpisodesMultiSource(
      resolvedAnilistId,
      malId,
      searchTitles.length > 0 ? searchTitles : [animeTitle],
      episodeCount,
      dub
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EpisodesUnavailableError) {
      return NextResponse.json(
        {
          error: 'Streaming server unavailable',
          message: error.message,
          code: 'EPISODES_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    console.error('[API Error] /api/episodes/[animeId]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}
