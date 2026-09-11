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
  MANGA: '/manga',
  MANGA_GENRE: (genre: string) => `/manga?genres=${encodeURIComponent(genre)}`,
  MANGA_DETAIL: (id: string, mangadexId?: string) => {
    const base = `/manga/${id}`;
    return mangadexId ? `${base}?md=${encodeURIComponent(mangadexId)}` : base;
  },
  MANGA_READ: (mangaId: string, chapterId: string, provider?: string, mangadexId?: string) => {
    const params = new URLSearchParams({ chapterId });
    if (provider) params.set('provider', provider);
    if (mangadexId) params.set('md', mangadexId);
    return `/manga/${mangaId}/read?${params.toString()}`;
  },
  MANGA_PROFILE: '/manga/profile',
  MANGA_PROFILE_SECTION: (section: string, tab?: string) =>
    tab ? `/manga/profile?section=${section}&tab=${tab}` : `/manga/profile?section=${section}`,
  GAME: '/game',
  GAME_BATTLE: '/game/battle',
  GAME_BATTLE_ROOM: (code: string) => `/game/battle?room=${encodeURIComponent(code)}`,
} as const;

export const AZ_LETTERS = [
  'all', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'other',
] as const;
