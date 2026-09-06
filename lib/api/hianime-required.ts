/**
 * AniList IDs that need a forced HiAnime search term (short / ambiguous titles).
 */
export const HIANIME_REQUIRED_SEARCH: Record<string, string> = {
  '21': 'one piece',
};

export function getRequiredHiAnimeSearch(anilistId: string): string | undefined {
  return HIANIME_REQUIRED_SEARCH[anilistId];
}
