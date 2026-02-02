/**
 * Anime Relations and Seasons Handler
 * Fetches related anime (seasons, sequels, movies)
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import { getPreferredTitle } from '@/lib/utils';

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

/**
 * Get all seasons and related content for an anime
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
