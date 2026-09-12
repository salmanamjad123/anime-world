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

/**
 * AniList numeric id for /watch/{id}/…
 * Never use HiAnime SEO slugs here — that causes watch remounts and broken episode fetches.
 */
export function getWatchAnimeId(
  anime: { id: string | number; slug?: string | null } | string | number
): string {
  if (typeof anime === 'string' || typeof anime === 'number') {
    return String(anime);
  }
  return String(anime.id);
}

/** True when segment is safe for watch routes (AniList numeric id). */
export function isWatchAnimeId(id: string): boolean {
  return isAniListNumericId(id);
}
