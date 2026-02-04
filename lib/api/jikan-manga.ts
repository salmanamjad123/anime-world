/**
 * Jikan API (MyAnimeList) — manga fallback when AniList is unavailable.
 * https://docs.api.jikan.moe/
 */

import { axiosInstance } from './axios';
import { resolveAnimeImageUrl } from '@/lib/utils/image-url';
import type { Manga, MangaFormat, MangaSearchResult, MangaStatus } from '@/types';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const JIKAN_TIMEOUT = 12_000;

interface JikanManga {
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
  chapters?: number | null;
  volumes?: number | null;
}

interface JikanMangaListResponse {
  data: JikanManga[];
  pagination?: {
    last_visible_page?: number;
    has_next_page?: boolean;
    current_page?: number;
    items?: { count?: number; total?: number; per_page?: number };
  };
}

function mapJikanMangaStatus(status?: string | null): MangaStatus | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s.includes('finish') || s.includes('complete')) return 'FINISHED';
  if (s.includes('publish') || s.includes('currently')) return 'RELEASING';
  if (s.includes('not yet')) return 'NOT_YET_RELEASED';
  if (s.includes('cancel') || s.includes('discontinu')) return 'CANCELLED';
  return undefined;
}

function mapJikanMangaFormat(type?: string | null): MangaFormat | undefined {
  if (!type) return undefined;
  const t = type.toUpperCase().replace(/\s+/g, '_');
  const allowed: MangaFormat[] = ['MANGA', 'NOVEL', 'ONE_SHOT'];
  return allowed.includes(t as MangaFormat) ? (t as MangaFormat) : 'MANGA';
}

/** Map Jikan entry to our Manga shape. Uses mal_id as id (matches many AniList IDs). */
export function mapJikanToManga(item: JikanManga, preserveId?: string): Manga {
  const image = resolveAnimeImageUrl(
    item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
  );

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
    status: mapJikanMangaStatus(item.status),
    format: mapJikanMangaFormat(item.type),
    chapters: item.chapters ?? undefined,
    volumes: item.volumes ?? undefined,
  };
}

function buildSearchResult(
  items: JikanManga[],
  page: number,
  perPage: number,
  pagination?: JikanMangaListResponse['pagination']
): MangaSearchResult {
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
        media: items.map((item) => mapJikanToManga(item)),
      },
    },
  };
}

async function fetchJikanMangaList(
  path: string,
  page: number,
  perPage: number
): Promise<MangaSearchResult> {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const response = await axiosInstance.get<JikanMangaListResponse>(`${JIKAN_BASE}${path}`, {
    params: { page, limit },
    timeout: JIKAN_TIMEOUT,
  });

  const items = response.data?.data ?? [];
  if (items.length === 0) {
    throw new Error('[Jikan] Empty manga list response');
  }

  return buildSearchResult(items, page, perPage, response.data?.pagination);
}

/** Currently publishing manga */
export async function getJikanTrendingManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  return fetchJikanMangaList('/top/manga?filter=publishing', page, perPage);
}

/** Most popular manga on MAL */
export async function getJikanPopularManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  return fetchJikanMangaList('/top/manga?filter=bypopularity', page, perPage);
}

/** Top rated manga by score */
export async function getJikanTopRatedManga(page = 1, perPage = 20): Promise<MangaSearchResult> {
  return fetchJikanMangaList('/top/manga?filter=score', page, perPage);
}

/** Single manga by MAL id */
export async function getJikanMangaByMalId(
  malId: number,
  preserveAnilistId?: string
): Promise<Manga | null> {
  try {
    const response = await axiosInstance.get<{ data: JikanManga }>(
      `${JIKAN_BASE}/manga/${malId}`,
      { timeout: JIKAN_TIMEOUT }
    );
    const item = response.data?.data;
    if (!item?.mal_id) return null;
    return mapJikanToManga(item, preserveAnilistId);
  } catch {
    return null;
  }
}

/** Search manga on MAL via Jikan */
export async function searchJikanManga(
  query: string,
  page = 1,
  perPage = 20
): Promise<MangaSearchResult> {
  const limit = Math.min(Math.max(perPage, 1), 25);
  const response = await axiosInstance.get<JikanMangaListResponse>(`${JIKAN_BASE}/manga`, {
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
