/**
 * Anime Types
 * Shared types for anime data across the application
 */

export type AnimeStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED';
export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

/**
 * Core Anime interface from AniList
 */
export interface Anime {
  id: string;
  malId?: number;
  title: {
    romaji: string;
    english?: string;
    native?: string;
  };
  description?: string;
  coverImage: {
    large: string;
    medium: string;
    extraLarge?: string;
  };
  bannerImage?: string;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  status?: AnimeStatus;
  format?: AnimeFormat;
  episodes?: number;
  duration?: number;
  season?: AnimeSeason;
  seasonYear?: number;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  studios?: {
    nodes: Array<{
      name: string;
      isAnimationStudio: boolean;
    }>;
  };
  trailer?: {
    id: string;
    site: string;
  };
  tags?: Array<{
    id: number;
    name: string;
    rank: number;
  }>;
}

/**
 * Simplified anime card data for listings
 */
export interface AnimeCard {
  id: string;
  title: string;
  image: string;
  score?: number;
  episodes?: number;
  format?: AnimeFormat;
  status?: AnimeStatus;
}

/**
 * Anime with streaming metadata
 */
export interface AnimeWithStreaming extends Anime {
  streamingId?: string;
  hasDub: boolean;
  hasSub: boolean;
  totalEpisodesSub?: number;
  totalEpisodesDub?: number;
}

/**
 * Search result from AniList
 */
export interface AnimeSearchResult {
  data: {
    Page: {
      pageInfo: {
        total: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
        perPage: number;
      };
      media: Anime[];
    };
  };
}

/**
 * Filters for anime search
 */
export interface AnimeFilters {
  search?: string;
  genres?: string[];
  year?: number;
  season?: AnimeSeason;
  format?: AnimeFormat;
  status?: AnimeStatus;
  sort?: 'POPULARITY_DESC' | 'SCORE_DESC' | 'TRENDING_DESC' | 'UPDATED_AT_DESC';
}
