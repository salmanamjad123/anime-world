/**
 * Route Constants
 * Application route paths
 */

import { getAnimeDetailPath, getWatchAnimeId } from '@/lib/seo/anime-path';

export const ROUTES = {
  HOME: '/',
  ANIME_DETAIL: (idOrAnime: string | { id: string; slug?: string | null }) =>
    getAnimeDetailPath(idOrAnime),
  ANIME_AZ: (letter: string) => `/anime/az/${letter}`,
  GENRE: (slug: string) => `/genre/${slug}`,
  SEARCH: '/search',
  SEARCH_GENRE: (genre: string) => `/search?genres=${encodeURIComponent(genre)}`,
  WATCH: (animeId: string | { id: string; slug?: string | null }, episodeId: string) =>
    `/watch/${getWatchAnimeId(animeId)}/${encodeURIComponent(episodeId)}`,
  WATCHLIST: '/watchlist',
  HISTORY: '/history',
  PROFILE: '/profile',
  PROFILE_TAB: (tab: string) => `/profile?tab=${tab}`,
  PROFILE_SECTION: (section: string, tab?: string) =>
    tab ? `/profile?section=${section}&tab=${tab}` : `/profile?section=${section}`,
  SETTINGS: '/settings',
  ADMIN: '/admin',
} as const;

export const AZ_LETTERS = [
  'all', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'other',
] as const;
