/**
 * HiAnime browse fallback when AniList + Jikan are unavailable.
 * Uses streaming-api search (Anikoto) — works independently of AniList/MAL.
 */

import { axiosInstance } from './axios';
import { resolveAnimeImageUrl } from '@/lib/utils/image-url';
import type { HiAnimeSearchResult } from './hianime';
import type { Anime, AnimeFormat, AnimeSearchResult } from '@/types';

const HIANIME_API_URL = process.env.NEXT_PUBLIC_HIANIME_API_URL || 'http://localhost:4000';
/** Keep fallback fast for Vercel serverless limits */
const FALLBACK_TIMEOUT = 12_000;

/** Curated popular titles — first hit per query is usually the main series */
const BROWSE_QUERIES = [
  'one piece',
  'naruto',
  'bleach',
  'demon slayer',
  'attack on titan',
  'jujutsu kaisen',
  'my hero academia',
  'dragon ball',
  'death note',
  'fullmetal alchemist',
  'hunter x hunter',
  'one punch man',
  'spy x family',
  'chainsaw man',
  'solo leveling',
  'frieren',
  'blue lock',
  'tokyo ghoul',
  'black clover',
  'vinland saga',
  'mob psycho',
  'rezero',
  'steins gate',
  'code geass',
  'haikyuu',
  'fairy tail',
  'sword art online',
  'your name',
  'weathering with you',
  'a silent voice',
] as const;

function mapFormat(type?: string | null): AnimeFormat | undefined {
  if (!type) return undefined;
  const t = type.toUpperCase().replace(/\s+/g, '_');
  const allowed: AnimeFormat[] = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
  return allowed.includes(t as AnimeFormat) ? (t as AnimeFormat) : 'TV';
}

export function mapHiAnimeSearchToAnime(item: HiAnimeSearchResult): Anime {
  const poster = resolveAnimeImageUrl(item.poster);
  const sub = item.episodes?.sub ?? 0;
  const dub = item.episodes?.dub ?? 0;
  const episodes = sub + dub || undefined;

  return {
    id: item.id,
    title: {
      romaji: item.name,
      english: item.name,
      native: item.name,
    },
    coverImage: {
      large: poster,
      medium: poster,
      extraLarge: poster,
    },
    genres: [],
    episodes,
    format: mapFormat(item.type),
  };
}

function pickBestMatch(results: HiAnimeSearchResult[], query: string): HiAnimeSearchResult | null {
  if (!results.length) return null;

  const q = query.toLowerCase();
  const exact = results.find((r) => r.name.toLowerCase() === q);
  if (exact) return exact;

  const tvWithEps = results.find(
    (r) =>
      (r.type?.toUpperCase() === 'TV' || !r.type) &&
      ((r.episodes?.sub ?? 0) + (r.episodes?.dub ?? 0)) > 1
  );
  if (tvWithEps) return tvWithEps;

  return results[0];
}

async function searchHiAnimeFast(query: string): Promise<HiAnimeSearchResult[]> {
  const url = `${HIANIME_API_URL}/api/v2/hianime/search`;
  const response = await axiosInstance.get(url, {
    params: { q: query, page: 1 },
    timeout: FALLBACK_TIMEOUT,
  });
  return response.data?.data?.animes ?? [];
}

function buildResult(
  media: Anime[],
  page: number,
  perPage: number,
  totalAvailable: number
): AnimeSearchResult {
  const lastPage = Math.max(1, Math.ceil(totalAvailable / perPage));
  return {
    data: {
      Page: {
        pageInfo: {
          total: totalAvailable,
          currentPage: page,
          lastPage,
          hasNextPage: page < lastPage,
          perPage,
        },
        media: media.slice(0, perPage),
      },
    },
  };
}

/** Collect up to perPage unique anime from query batch (6 parallel at a time). */
async function collectFromQueries(queries: string[], perPage: number): Promise<Anime[]> {
  const seen = new Set<string>();
  const media: Anime[] = [];

  for (let i = 0; i < queries.length && media.length < perPage; i += 6) {
    const group = queries.slice(i, i + 6);
    const batch = await Promise.all(
      group.map(async (query) => {
        try {
          const results = await searchHiAnimeFast(query);
          const best = pickBestMatch(results, query);
          return best ? mapHiAnimeSearchToAnime(best) : null;
        } catch {
          return null;
        }
      })
    );

    for (const item of batch) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      media.push(item);
      if (media.length >= perPage) break;
    }
  }

  return media;
}

/** Broad search to fill remaining slots when curated queries aren't enough */
async function topUpFromBroadSearch(media: Anime[], perPage: number): Promise<Anime[]> {
  if (media.length >= perPage) return media;

  const seen = new Set(media.map((a) => a.id));
  try {
    const extras = await searchHiAnimeFast('a');
    for (const raw of extras) {
      if (media.length >= perPage) break;
      if (!raw.id || seen.has(raw.id)) continue;
      seen.add(raw.id);
      media.push(mapHiAnimeSearchToAnime(raw));
    }
  } catch {
    // optional top-up
  }

  return media;
}

/**
 * Build a homepage-style list from HiAnime search.
 * IDs are HiAnime slugs — /anime/[slug] already works in the app.
 */
export async function getHiAnimeBrowseList(
  page = 1,
  perPage = 20,
  variant: 'trending' | 'popular' = 'trending'
): Promise<AnimeSearchResult> {
  const queries =
    variant === 'popular'
      ? [...BROWSE_QUERIES].reverse()
      : [...BROWSE_QUERIES];

  const start = (page - 1) * perPage;
  const batch = queries.slice(start, start + perPage);

  if (batch.length === 0 && page > 1) {
    throw new Error('[HiAnime] No browse queries for page');
  }

  const queryBatch = batch.length > 0 ? batch : [...queries];
  let media = await collectFromQueries(queryBatch, perPage);
  media = await topUpFromBroadSearch(media, perPage);

  if (media.length === 0) {
    throw new Error('[HiAnime] Browse fallback returned no results');
  }

  return buildResult(media, page, perPage, queries.length);
}

/** Text search via HiAnime when AniList search is down */
export async function searchHiAnimeAsList(
  query: string,
  page = 1,
  perPage = 20
): Promise<AnimeSearchResult> {
  const results = await searchHiAnimeFast(query.trim());
  const media = results.slice(0, perPage).map(mapHiAnimeSearchToAnime);

  return {
    data: {
      Page: {
        pageInfo: {
          total: media.length,
          currentPage: page,
          lastPage: 1,
          hasNextPage: false,
          perPage,
        },
        media,
      },
    },
  };
}
