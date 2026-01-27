/**
 * Route Constants
 * Application route paths
 */

export const ROUTES = {
  HOME: '/',
  ANIME_DETAIL: (id: string) => `/anime/${id}`,
  WATCH: (animeId: string, episodeId: string) => `/watch/${animeId}/${episodeId}`,
  SEARCH: '/search',
  WATCHLIST: '/watchlist',
  HISTORY: '/history',
  SETTINGS: '/settings',
} as const;
