/**
 * Route Constants
 * Application route paths
 */

export const ROUTES = {
  HOME: '/',
  ANIME_DETAIL: (id: string) => `/anime/${id}`,
  ANIME_AZ: (letter: string) => `/anime/az/${letter}`,
  GENRE: (slug: string) => `/genre/${slug}`,
  SEARCH: '/search',
  SEARCH_GENRE: (genre: string) => `/search?genres=${encodeURIComponent(genre)}`,
  WATCH: (animeId: string, episodeId: string) => `/watch/${animeId}/${encodeURIComponent(episodeId)}`,
  WATCHLIST: '/watchlist',
  HISTORY: '/history',
  SETTINGS: '/settings',
  MANGA: '/manga',
  MANGA_GENRE: (genre: string) => `/manga?genres=${encodeURIComponent(genre)}`,
  MANGA_DETAIL: (id: string) => `/manga/${id}`,
  MANGA_READ: (mangaId: string, chapterId: string, provider?: string) => {
    const params = new URLSearchParams({ chapterId });
    if (provider) params.set('provider', provider);
    return `/manga/${mangaId}/read?${params.toString()}`;
  },
} as const;

export const AZ_LETTERS = [
  'all', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'other',
] as const;
