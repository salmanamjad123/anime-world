/**
 * Episode Types
 * Types for anime episodes and playback
 */

export type LanguageCategory = 'sub' | 'dub' | 'raw';

/**
 * Episode information
 */
export interface Episode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  image?: string;
  airDate?: string;
}

/**
 * Episode with language information
 */
export interface EpisodeWithLanguage extends Episode {
  language: LanguageCategory;
  isFiller?: boolean;
}

/**
 * Episode list response from streaming API
 */
export interface EpisodeListResponse {
  animeId: string;
  totalEpisodes: number;
  episodes: Episode[];
}

/**
 * Episode progress/history
 */
export interface EpisodeProgress {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  timestamp: number; // Current playback position in seconds
  duration: number; // Total episode duration
  percentage: number; // Watch percentage (0-100)
  lastWatched: Date;
  completed: boolean;
}
