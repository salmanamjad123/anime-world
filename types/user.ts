/**
 * User Types
 * Types for user data and preferences
 */

import { Anime } from './anime';
import { EpisodeProgress } from './episode';
import { PlayerConfig } from './stream';

/**
 * User profile
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  lastLogin?: Date;
}

/**
 * Watchlist item
 */
export interface WatchlistItem {
  animeId: string;
  title: string;
  image: string;
  addedAt: Date;
  anime?: Anime;
}

/**
 * Watch history item
 */
export interface HistoryItem extends EpisodeProgress {
  animeTitle: string;
  animeImage: string;
  episodeTitle?: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ur' | 'ja';
  playerConfig: PlayerConfig;
  notifications: {
    newEpisodes: boolean;
    recommendations: boolean;
  };
}

/**
 * Complete user data
 */
export interface UserData extends User {
  preferences: UserPreferences;
  watchlist: WatchlistItem[];
  history: HistoryItem[];
}
