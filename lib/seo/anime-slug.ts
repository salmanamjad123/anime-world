/**
 * SEO slug resolution — public URLs use HiAnime slug, AniList id stored in cache.
 */

import { saveStaleCache, getStaleCache } from '@/lib/cache/stale-cache';
import {
  findHiAnimeMatch,
  hiAnimeSlugMatchesTitle,
} from '@/lib/api/hianime';
import { SITE_URL } from '@/constants/site';

const SLUG_CACHE_PREFIX = 'anilist:slugfor:';

export function isAniListNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/** Public path segment for /anime/{segment} */
export function getPublicAnimeSegment(id: string, slug?: string | null): string {
  if (slug && slug !== id) return slug;
  if (!isAniListNumericId(id)) return id;
  return id;
}

export function buildAnimeDetailUrl(id: string, slug?: string | null): string {
  const segment = getPublicAnimeSegment(id, slug);
  return `${SITE_URL}/anime/${segment}`;
}

export async function saveAnimeSlugMapping(
  anilistId: string,
  slug: string
): Promise<void> {
  if (!anilistId || !slug || anilistId === slug) return;
  await saveStaleCache(`${SLUG_CACHE_PREFIX}${anilistId}`, slug);
}

export async function getCachedAnimeSlug(anilistId: string): Promise<string | null> {
  return getStaleCache<string>(`${SLUG_CACHE_PREFIX}${anilistId}`);
}

/**
 * Resolve HiAnime slug for an AniList id (cache → optional live lookup).
 */
export async function resolveAnimeSlug(
  anilistId: string,
  title?: string,
  episodeCount?: number,
  options?: { allowLookup?: boolean }
): Promise<string | null> {
  if (!isAniListNumericId(anilistId)) return anilistId;

  const cached = await getCachedAnimeSlug(anilistId);
  if (cached) return cached;

  if (!options?.allowLookup || !title?.trim()) return null;

  try {
    const match = await findHiAnimeMatch(title.trim(), false, episodeCount ?? 0);
    if (match?.id && hiAnimeSlugMatchesTitle(title, match.id)) {
      await saveAnimeSlugMapping(anilistId, match.id);
      return match.id;
    }
  } catch {
    // lookup optional
  }

  return null;
}
