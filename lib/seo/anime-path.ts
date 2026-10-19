/**
 * Client-safe anime URL helpers (no server/API imports).
 * Keep this module free of server-only imports so client pages can import it.
 */

export function isAniListNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * HiAnime public ids look like `arte-dug7c-2459` (title + short hash + number).
 * Do not treat the trailing number as an AniList id.
 */
export function looksLikeHiAnimeSlug(segment: string): boolean {
  if (!segment || isAniListNumericId(segment)) return false;
  const parts = segment.split('-').filter(Boolean);
  if (parts.length < 3) return false;
  const last = parts[parts.length - 1];
  const hash = parts[parts.length - 2];
  return /^\d+$/.test(last) && /^[a-z0-9]{4,6}$/i.test(hash) && /\d/.test(hash);
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

/**
 * HiAnime ids are `slug?ep=123`. Next.js puts `?ep=` on the query string
 * for direct visits, or `%3Fep%3D` in the path for in-app links. Merge both.
 */
export function resolveHiAnimeEpisodeId(
  pathEpisodeId: string | undefined,
  epQuery: string | null
): string {
  const decoded = decodeURIComponent(pathEpisodeId || '');
  if (decoded.includes('?ep=')) return decoded;
  if (epQuery) return `${decoded}?ep=${epQuery}`;
  return decoded;
}

