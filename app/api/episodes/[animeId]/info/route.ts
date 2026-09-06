/**
 * Anime Info API Route
 * GET /api/episodes/[animeId]/info - Get anime streaming info (sub/dub availability)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import { resolveAnilistIdFromSegment } from '@/lib/seo/anime-slug';

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

    const anilistId = await resolveAnilistIdFromSegment(animeId, { allowLookup: true });

    if (anilistId) {
      const animeData = await getAnimeById(anilistId);
      const anime = animeData.data.Media;

      if (anime) {
        return NextResponse.json({
          id: anilistId,
          title: anime.title.english || anime.title.romaji,
          totalEpisodes: anime.episodes || 0,
          hasDub: true,
          hasSub: true,
        });
      }
    }

    // HiAnime slug or unresolved segment — read stats from streaming API
    const info = await getHiAnimeInfo(animeId);
    const sub = info.stats?.episodes?.sub ?? 0;
    const dub = info.stats?.episodes?.dub ?? 0;

    return NextResponse.json({
      id: animeId,
      title: info.name,
      totalEpisodes: sub + dub || Math.max(sub, dub),
      hasDub: dub > 0,
      hasSub: sub > 0,
    });
  } catch (error) {
    console.error('[API Error] /api/episodes/[animeId]/info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime info' },
      { status: 500 }
    );
  }
}
