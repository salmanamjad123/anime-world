/**
 * Client-safe anime URL helpers (no server/API imports).
 */

export function isAniListNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/** Public path segment for /anime/{segment} */
export function getPublicAnimeSegment(id: string, slug?: string | null): string {
  if (slug && slug !== id) return slug;
  return id;
}

/** Browser path for an anime detail page */
export function getAnimeDetailPath(
  anime: { id: string; slug?: string | null } | string
): string {
  if (typeof anime === 'string') return `/anime/${anime}`;
  return `/anime/${getPublicAnimeSegment(String(anime.id), anime.slug)}`;
}

/** Use AniList id for /watch/{id}/… — episodes API maps to HiAnime reliably from numeric ids */
export function getWatchAnimeId(anime: { id: string; slug?: string | null } | string): string {
  if (typeof anime === 'string') return anime;
  return String(anime.id);
}
