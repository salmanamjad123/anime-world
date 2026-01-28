/**
 * Anime Seasons API Route
 * GET /api/anime/[id]/seasons - Get all seasons and related content (AniList id or HiAnime slug)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeSeasons } from '@/lib/api/anime-relations';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import type { AnimeRelation } from '@/lib/api/anime-relations';

const PLACEHOLDER_IMAGE = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-nxxpfCRq.png';

function isAniListId(id: string): boolean {
  return /^\d+$/.test(id);
}

function validCover(url: string | undefined): string {
  return typeof url === 'string' && url.trim().startsWith('http') ? url.trim() : PLACEHOLDER_IMAGE;
}

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

    if (isAniListId(id)) {
      const result = await getAnimeSeasons(id);
      return NextResponse.json(result);
    }

    const info = await getHiAnimeInfo(id);
    const sub = info.stats?.episodes?.sub ?? 0;
    const dub = info.stats?.episodes?.dub ?? 0;
    const main: AnimeRelation = {
      id: info.id,
      title: info.name,
      format: info.stats?.type ?? 'TV',
      episodes: sub + dub || 0,
      relationType: 'MAIN',
      coverImage: validCover(info.poster),
    };
    const seasonRelations: AnimeRelation[] = (info.seasons ?? []).map((s) => ({
      id: s.id,
      title: s.title || s.name,
      format: 'TV',
      episodes: 0,
      relationType: 'SEQUEL' as const,
      coverImage: validCover(s.poster),
    }));
    const related: AnimeRelation[] = (info.relatedAnimes ?? []).map((r) => ({
      id: r.id,
      title: r.name,
      format: (r.type ?? 'TV') as string,
      episodes: (r.episodes?.sub ?? 0) + (r.episodes?.dub ?? 0) || 0,
      relationType: 'SEQUEL' as const,
      coverImage: validCover(r.poster),
    }));
    const seasons = [...seasonRelations, ...related];
    return NextResponse.json({
      main,
      seasons,
      movies: [] as AnimeRelation[],
      specials: [] as AnimeRelation[],
    });
  } catch (error) {
    console.error('[API Error] /api/anime/[id]/seasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}
