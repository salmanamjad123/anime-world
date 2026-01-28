/**
 * Anime Detail API Route
 * GET /api/anime/[id] - Get anime by ID (AniList numeric id or HiAnime slug)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import type { Anime, AnimeStatus } from '@/types';
import type { HiAnimeInfo } from '@/lib/api/hianime';

function isAniListId(id: string): boolean {
  return /^\d+$/.test(id);
}

const PLACEHOLDER_IMAGE = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-nxxpfCRq.png';

function parseStatus(s: string | undefined): AnimeStatus | undefined {
  if (!s || typeof s !== 'string') return undefined;
  const lower = s.toLowerCase();
  if (lower.includes('finish') || lower.includes('complet')) return 'FINISHED';
  if (lower.includes('ongoing') || lower.includes('releasing') || lower.includes('airing')) return 'RELEASING';
  if (lower.includes('upcoming') || lower.includes('not yet')) return 'NOT_YET_RELEASED';
  if (lower.includes('cancel')) return 'CANCELLED';
  return undefined;
}

/**
 * Parse score to AniList scale (0-100). Prefer malscore; ignore content rating (PG-13 -> 13).
 */
function parseScore(malscore: string | undefined, statsRating: string | undefined): number | undefined {
  const fromMal = parseOne(malscore);
  if (fromMal !== undefined) return fromMal;
  const fromStats = parseOne(statsRating);
  if (fromStats === undefined) return undefined;
  if (fromStats >= 11 && fromStats <= 20) return undefined;
  return fromStats;
}

function parseOne(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
  if (Number.isNaN(n)) return undefined;
  if (n <= 10) return n * 10;
  return n;
}

function parseSeasonYear(aired: string | undefined): number | undefined {
  if (!aired) return undefined;
  const match = String(aired).match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

function mapHiAnimeInfoToAnime(info: HiAnimeInfo): Anime {
  const sub = info.stats?.episodes?.sub ?? 0;
  const dub = info.stats?.episodes?.dub ?? 0;
  const episodes = sub + dub || undefined;
  const durationStr = info.stats?.duration;
  const duration = durationStr ? parseInt(String(durationStr).replace(/\D/g, ''), 10) || undefined : undefined;
  const typeStr = info.stats?.type?.toUpperCase().replace(/\s+/g, '_');
  const format = (typeStr === 'TV' || typeStr === 'MOVIE' || typeStr === 'OVA' || typeStr === 'ONA' || typeStr === 'SPECIAL' || typeStr === 'TV_SHORT' || typeStr === 'MUSIC' ? typeStr : 'TV') as Anime['format'];
  const poster = typeof info.poster === 'string' && info.poster.trim().startsWith('http') ? info.poster.trim() : PLACEHOLDER_IMAGE;
  const studiosStr = info.studios?.trim();
  const studios = studiosStr
    ? { nodes: studiosStr.split(/[,&]/).map((name) => ({ name: name.trim(), isAnimationStudio: true })).filter((n) => n.name.length > 0) }
    : undefined;
  return {
    id: info.id,
    title: { romaji: info.name, english: info.name, native: info.name ?? '' },
    description: info.description ?? undefined,
    coverImage: {
      large: poster,
      medium: poster,
      extraLarge: poster,
    },
    bannerImage: poster !== PLACEHOLDER_IMAGE ? poster : undefined,
    genres: Array.isArray(info.genres) ? info.genres : [],
    averageScore: parseScore(info.malscore, info.stats?.rating),
    status: parseStatus(info.status),
    seasonYear: parseSeasonYear(info.aired),
    episodes: episodes ?? undefined,
    duration,
    format,
    studios: studios?.nodes?.length ? studios : undefined,
  };
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
      const result = await getAnimeById(id);
      return NextResponse.json(result);
    }

    const info = await getHiAnimeInfo(id);
    const media = mapHiAnimeInfoToAnime(info);
    return NextResponse.json({ data: { Media: media } });
  } catch (error) {
    console.error('[API Error] /api/anime/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime details' },
      { status: 500 }
    );
  }
}
