/**
 * AniList IDs that need a forced HiAnime search term (short / ambiguous titles).
 */
export const HIANIME_REQUIRED_SEARCH: Record<string, string> = {
  '21': 'one piece',
  // Poisoned once to 365 Days to the Wedding via empty native-title match.
  '195516': 'kusuriya no hitorigoto 3rd season',
};

/**
 * Hard pin when search ranking is noisy (still validated against AniList titles).
 */
export const HIANIME_REQUIRED_SLUG: Record<string, string> = {
  '195516': 'kusuriya-no-hitorigoto-3rd-season-8838',
};

export function getRequiredHiAnimeSearch(anilistId: string): string | undefined {
  return HIANIME_REQUIRED_SEARCH[anilistId];
}

export function getRequiredHiAnimeSlug(anilistId: string): string | undefined {
  return HIANIME_REQUIRED_SLUG[anilistId];
}
