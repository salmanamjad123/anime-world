/**
 * Product mode for this deploy/branch.
 * `game` = Village Arena only (no anime/manga surface).
 * `full` = Anime Village with optional game tab.
 */
export const SITE_MODE = 'game' as const;

export const IS_GAME_ARENA_ONLY = SITE_MODE === 'game';
