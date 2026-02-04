/**
 * Anime Relations and Seasons Handler
 * Fetches related anime (seasons, sequels, movies)
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import { getPreferredTitle } from '@/lib/utils';
import { CACHE_TTL, getCached } from '@/lib/cache';

const RELATIONS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      episodes
      format
      coverImage {
        medium
        large
      }
      relations {
        edges {
          relationType
          node {
            id
            idMal
            title {
              romaji
              english
              native
            }
            format
            episodes
            status
            seasonYear
            coverImage {
              medium
              large
            }
          }
        }
      }
    }
  }
`;

export interface AnimeRelation {
  id: string;
  malId?: number;
  title: string;
  format: string;
  episodes: number;
  seasonYear?: number;
  relationType: string;
  coverImage: string;
}

const RELATION_TYPES = ['SEQUEL', 'PREQUEL', 'ALTERNATIVE', 'PARENT'] as const;
const SEASON_FORMATS = ['TV', 'TV_SHORT'] as const;

function nodeToRelation(node: any, relationType: string): AnimeRelation {
  return {
    id: node.id.toString(),
    malId: node.idMal,
    title: getPreferredTitle(node.title),
    format: node.format,
    episodes: node.episodes || 0,
    seasonYear: node.seasonYear,
    relationType,
    coverImage: node.coverImage?.large || '',
  };
}

function shouldIncludeRelation(edge: any, node: any): boolean {
  if (!RELATION_TYPES.includes(edge.relationType)) return false;
  if (node.format === 'MOVIE') return true;
  if (SEASON_FORMATS.includes(node.format)) {
    const isUpcoming = node.status === 'NOT_YET_RELEASED';
    const hasEpisodes = !!node.episodes && node.episodes > 0;
    return !isUpcoming || hasEpisodes;
  }
  return false;
}

/**
 * Fetch a single anime with relations from AniList
 */
async function fetchAnimeWithRelations(id: number): Promise<any> {
  const response = await axiosInstance.post(ANILIST_API_URL, {
    query: RELATIONS_QUERY,
    variables: { id },
  });
  return response.data.data.Media;
}

/**
 * Get all seasons and movies for a franchise by walking the relation graph.
 * Regardless of which season the user opens, returns the full franchise.
 */
export async function getAnimeSeasonsUnified(animeId: string): Promise<{
  main: AnimeRelation;
  seasons: AnimeRelation[];
  movies: AnimeRelation[];
  specials: AnimeRelation[];
}> {
  const cacheKey = `anilist:relations:unified:${animeId}`;

  // In-flight de-dupe: if 100 users request same anime at once,
  // only one AniList graph walk runs; others await the same promise.
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = getCached(
    cacheKey,
    async () => getAnimeSeasonsUnifiedUncached(animeId),
    CACHE_TTL.ANIME_INFO // relations rarely change; keep long-lived
  ).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, promise);
  return promise;
}

const inFlight = new Map<string, Promise<{
  main: AnimeRelation;
  seasons: AnimeRelation[];
  movies: AnimeRelation[];
  specials: AnimeRelation[];
}>>();

async function getAnimeSeasonsUnifiedUncached(animeId: string): Promise<{
  main: AnimeRelation;
  seasons: AnimeRelation[];
  movies: AnimeRelation[];
  specials: AnimeRelation[];
}> {
  const openedId = animeId;
  const seen = new Set<string>();
  const allById = new Map<string, AnimeRelation>();
  const queue: number[] = [parseInt(animeId, 10)];
  const maxDepth = 3; // Prevent runaway for messy relation graphs
  let depth = 0;

  while (queue.length > 0 && depth < maxDepth) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const id = queue.shift()!;
      const idStr = id.toString();
      if (seen.has(idStr)) continue;
      seen.add(idStr);

      try {
        const anime = await fetchAnimeWithRelations(id);
        const mainRelation: AnimeRelation = {
          id: anime.id.toString(),
          malId: anime.idMal,
          title: getPreferredTitle(anime.title),
          format: anime.format,
          episodes: anime.episodes || 0,
          seasonYear: anime.seasonYear,
          relationType: idStr === openedId ? 'MAIN' : 'RELATED',
          coverImage: anime.coverImage?.large || '',
        };
        allById.set(idStr, mainRelation);

        if (anime.relations?.edges) {
          for (const edge of anime.relations.edges) {
            const node = edge.node;
            if (!shouldIncludeRelation(edge, node)) continue;
            const nodeId = node.id.toString();
            if (!seen.has(nodeId)) {
              queue.push(node.id);
            }
            if (!allById.has(nodeId)) {
              allById.set(nodeId, nodeToRelation(node, edge.relationType));
            }
          }
        }
      } catch (err) {
        console.warn('[Anime Relations] Failed to fetch anime', id, err);
      }
    }
    depth++;
  }

  const main = allById.get(openedId);
  if (!main) {
    throw new Error('Anime not found');
  }
  main.relationType = 'MAIN';

  const seasons: AnimeRelation[] = [];
  const movies: AnimeRelation[] = [];
  const specials: AnimeRelation[] = [];

  for (const rel of allById.values()) {
    if (rel.id === openedId) continue; // main is added separately
    if (rel.format === 'MOVIE') {
      movies.push(rel);
    } else if (SEASON_FORMATS.includes(rel.format as any)) {
      seasons.push(rel);
    } else if (['SPECIAL', 'OVA', 'ONA'].includes(rel.format)) {
      specials.push(rel);
    }
  }

  seasons.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));
  movies.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

  return { main, seasons, movies, specials };
}

/**
 * Get total episode count from franchise relations when main entry has 0.
 * Used as fallback for anime like One Piece where main AniList entry lacks episode data.
 */
export async function getEpisodeCountFromRelations(animeId: string): Promise<number> {
  try {
    const { main, seasons, movies } = await getAnimeSeasonsUnified(animeId);
    const counts = [
      main.episodes || 0,
      ...seasons.map((s) => s.episodes || 0),
      ...movies.map((m) => m.episodes || 0),
    ];
    return Math.max(0, ...counts);
  } catch {
    return 0;
  }
}

/**
 * Get all seasons and related content for an anime (direct relations only)
 */
export async function getAnimeSeasons(animeId: string): Promise<{
  main: AnimeRelation;
  seasons: AnimeRelation[];
  movies: AnimeRelation[];
  specials: AnimeRelation[];
}> {
  try {
    const response = await axiosInstance.post(ANILIST_API_URL, {
      query: RELATIONS_QUERY,
      variables: { id: parseInt(animeId, 10) },
    });

    const anime = response.data.data.Media;
    
    // Main anime
    const main: AnimeRelation = {
      id: anime.id.toString(),
      malId: anime.idMal,
      title: getPreferredTitle(anime.title),
      format: anime.format,
      episodes: anime.episodes || 0,
      seasonYear: anime.seasonYear,
      relationType: 'MAIN',
      coverImage: anime.coverImage?.large || '',
    };

    const seasons: AnimeRelation[] = [];
    const movies: AnimeRelation[] = [];
    const specials: AnimeRelation[] = [];

    // Process relations
    if (anime.relations && anime.relations.edges) {
      anime.relations.edges.forEach((edge: any) => {
        const node = edge.node;
        const relation: AnimeRelation = {
          id: node.id.toString(),
          malId: node.idMal,
          title: getPreferredTitle(node.title),
          format: node.format,
          episodes: node.episodes || 0,
          seasonYear: node.seasonYear,
          relationType: edge.relationType,
          coverImage: node.coverImage?.large || '',
        };

        // Categorize based on format and relation type
        if (node.format === 'MOVIE') {
          movies.push(relation);
        } else if (
          edge.relationType === 'SEQUEL' ||
          edge.relationType === 'PREQUEL' ||
          edge.relationType === 'ALTERNATIVE' ||
          edge.relationType === 'PARENT' // Main series when viewing a movie (e.g. One Piece TV from a movie page)
        ) {
          if (node.format === 'TV' || node.format === 'TV_SHORT') {
            const status = node.status;
            const isUpcoming = status === 'NOT_YET_RELEASED';
            const hasEpisodes = !!node.episodes && node.episodes > 0;
            if (!isUpcoming || hasEpisodes) {
              seasons.push(relation);
            }
          } else if (node.format === 'SPECIAL' || node.format === 'OVA' || node.format === 'ONA') {
            specials.push(relation);
          }
        }
      });
    }

    // Sort seasons by year
    seasons.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));
    movies.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

    return { main, seasons, movies, specials };
  } catch (error) {
    console.error('[AniList Relations Error]:', error);
    throw error;
  }
}

/**
 * Search for anime on Gogoanime using title
 */
export async function searchGogoAnime(title: string): Promise<string | null> {
  try {
    const searchQuery = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/season\s*\d+/gi, '')
      .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
      .trim();

    // Try Consumet Gogoanime search
    const response = await axiosInstance.get(
      `https://api.consumet.org/anime/gogoanime/${searchQuery}`,
      { timeout: 5000 }
    );

    if (response.data && response.data.results && response.data.results.length > 0) {
      // Return the first matching result's ID
      return response.data.results[0].id;
    }
  } catch (error) {
    console.log('[Gogoanime Search] Failed for:', title);
  }

  return null;
}

/**
 * Get the correct season number from title
 */
export function extractSeasonNumber(title: string): number {
  const patterns = [
    /season\s*(\d+)/i,
    /(\d+)(st|nd|rd|th)\s*season/i,
    /part\s*(\d+)/i,
    /cour\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return 1; // Default to season 1
}
