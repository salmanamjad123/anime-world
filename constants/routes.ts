/**
 * Route Constants
 * Application route paths
 */

export const ROUTES = {
  HOME: '/',
  ANIME_DETAIL: (id: string) => `/anime/${id}`,
  ANIME_AZ: (letter: string) => `/anime/az/${letter}`,
  WATCH: (animeId: string, episodeId: string) => `/watch/${animeId}/${encodeURIComponent(episodeId)}`,
  SEARCH: '/search',
  WATCHLIST: '/watchlist',
  HISTORY: '/history',
  SETTINGS: '/settings',
} as const;

export const AZ_LETTERS = [
  'all', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'other',
] as const;
