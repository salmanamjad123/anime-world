/**
 * Jikan API (MyAnimeList) — fallback when AniList is unavailable.
 * https://docs.api.jikan.moe/
 */

import { axiosInstance } from './axios';
import type { Anime, AnimeFormat, AnimeSearchResult, AnimeStatus } from '@/types';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const JIKAN_TIMEOUT = 12_000;

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  images?: {
    jpg?: {
      image_url?: string;
      large_image_url?: string;
    };
  };
  synopsis?: string | null;
  genres?: Array<{ name: string }>;
  score?: number | null;
  popularity?: number | null;
  status?: string | null;
  type?: string | null;
  episodes?: number | null;
  duration?: string | null;
  year?: number | null;
  aired?: { from?: string | null };
  studios?: Array<{ name: string }>;
}

interface JikanListResponse {
  data: JikanAnime[];
  pagination?: {
    last_visible_page?: number;
    has_next_page?: boolean;
    current_page?: number;
    items?: { count?: number; total?: number; per_page?: number };
  };
}

function mapJikanStatus(status?: string | null): AnimeStatus | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s.includes('finish') || s.includes('complete')) return 'FINISHED';
  if (s.includes('airing') || s.includes('currently')) return 'RELEASING';
  if (s.includes('not yet')) return 'NOT_YET_RELEASED';
  if (s.includes('cancel')) return 'CANCELLED';
  return undefined;
}

function mapJikanFormat(type?: string | null): AnimeFormat | undefined {
  if (!type) return undefined;
  const t = type.toUpperCase().replace(/\s+/g, '_');
  const allowed: AnimeFormat[] = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
  return allowed.includes(t as AnimeFormat) ? (t as AnimeFormat) : 'TV';
}

function parseDurationMinutes(duration?: string | null): number | undefined {
  if (!duration) return undefined;
  const minMatch = duration.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  return undefined;
}

function parseSeasonYear(aired?: { from?: string | null }, year?: number | null): number | undefined {
  if (year) return year;
  if (!aired?.from) return undefined;
  const match = aired.from.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

/** Map Jikan entry to our Anime shape. Uses mal_id as id (matches many classic AniList IDs). */
export function mapJikanToAnime(item: JikanAnime, preserveId?: string): Anime {
  const image =
    item.images?.jpg?.large_image_url ||
    item.images?.jpg?.image_url ||
    'https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png';

  return {
    id: preserveId ?? String(item.mal_id),
    malId: item.mal_id,
    title: {
      romaji: item.title,
      english: item.title_english || undefined,
      native: item.title_japanese || undefined,
    },
    description: item.synopsis || undefined,
    coverImage: {
      large: image,
      medium: image,
      extraLarge: image,
    },
    genres: (item.genres ?? []).map((g) => g.name),
    averageScore: item.score != null ? Math.round(item.score * 10) : undefined,
    popularity: item.popularity ?? undefined,
    status: mapJikanStatus(item.status),
    format: mapJikanFormat(item.type),
    episodes: item.episodes ?? undefined,
    duration: parseDurationMinutes(item.duration),
    seasonYear: parseSeasonYear(item.aired, item.year),
    studios: item.studios?.length
      ? { nodes: item.studios.map((s) => ({ name: s.name, isAnimationStudio: true })) }
      : undefined,
  };
}

function buildSearchResult(
  items: JikanAnime[],
  page: number,
  perPage: number,
  pagination?: JikanListResponse['pagination']
): AnimeSearchResult {
  const total = pagination?.items?.total ?? items.length;
  const lastPage = pagination?.last_visible_page ?? page;

  return {
    data: {
      Page: {
        pageInfo: {
          total,
          currentPage: page,
          lastPage,
          hasNextPage: pagination?.has_next_page ?? false,
          perPage,
        },
        media: items.map((item) => mapJikanToAnime(item)),
      },
    },
  };
}

async function fetchJikanList(
  path: string,
  page: number,
  perPage: number
): Promise<AnimeSearchResult> {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const response = await axiosInstance.get<JikanListResponse>(`${JIKAN_BASE}${path}`, {
    params: { page, limit },
    timeout: JIKAN_TIMEOUT,
  });

  const items = response.data?.data ?? [];
  if (items.length === 0) {
    throw new Error('[Jikan] Empty list response');
  }

  return buildSearchResult(items, page, perPage, response.data?.pagination);
}

/** Trending / currently airing */
export async function getJikanTrending(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return fetchJikanList('/top/anime?filter=airing', page, perPage);
}

/** Most popular on MAL */
export async function getJikanPopular(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return fetchJikanList('/top/anime?filter=bypopularity', page, perPage);
}

/** Top rated by score */
export async function getJikanTopRated(page = 1, perPage = 20): Promise<AnimeSearchResult> {
  return fetchJikanList('/top/anime?filter=score', page, perPage);
}

/** Single anime by MAL id */
export async function getJikanAnimeByMalId(
  malId: number,
  preserveAnilistId?: string
): Promise<Anime | null> {
  try {
    const response = await axiosInstance.get<{ data: JikanAnime }>(
      `${JIKAN_BASE}/anime/${malId}`,
      { timeout: JIKAN_TIMEOUT }
    );
    const item = response.data?.data;
    if (!item?.mal_id) return null;
    return mapJikanToAnime(item, preserveAnilistId);
  } catch {
    return null;
  }
}

/** Search anime on MAL via Jikan */
export async function searchJikanAnime(
  query: string,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const response = await axiosInstance.get<JikanListResponse>(`${JIKAN_BASE}/anime`, {
    params: {
      q: query.trim(),
      page,
      limit,
      order_by: 'popularity',
      sort: 'desc',
    },
    timeout: JIKAN_TIMEOUT,
  });

  const items = response.data?.data ?? [];
  return buildSearchResult(items, page, perPage, response.data?.pagination);
}
