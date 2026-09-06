/**
 * SEO slug resolution — HiAnime slug when available, title slug as fallback.
 * Cold slug URLs resolve via cache, embedded id, or AniList search (no cache required).
 */

import { saveStaleCache, getStaleCache } from '@/lib/cache/stale-cache';
import {
  findHiAnimeMatch,
  hiAnimeSlugMatchesTitle,
  searchHiAnime,
} from '@/lib/api/hianime';
import { getRequiredHiAnimeSearch } from '@/lib/api/hianime-required';
import { getAnimeById, searchAnilistMediaByTitle } from '@/lib/api/anilist';
import { SITE_URL } from '@/constants/site';
import {
  getPublicAnimeSegment,
  isAniListNumericId,
} from '@/lib/seo/anime-path';
import type { Anime } from '@/types';

export { getPublicAnimeSegment, isAniListNumericId } from '@/lib/seo/anime-path';
export { getAnimeDetailPath } from '@/lib/seo/anime-path';

const SLUG_CACHE_PREFIX = 'anilist:slugfor:';
const ID_FOR_PREFIX = 'anilist:idfor:';

export function buildAnimeDetailUrl(id: string, slug?: string | null): string {
  const segment = getPublicAnimeSegment(id, slug);
  return `${SITE_URL}/anime/${segment}`;
}

/** URL-safe slug from display title (fallback when HiAnime has no match). */
export function titleToSeoSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Convert public slug to AniList search words. */
export function slugToSearchQuery(slug: string): string {
  const withoutId = slug.replace(/-\d+$/, '');
  return withoutId.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function saveAnimeSlugMapping(
  anilistId: string,
  slug: string
): Promise<void> {
  if (!anilistId || !slug || anilistId === slug) return;
  await saveStaleCache(`${SLUG_CACHE_PREFIX}${anilistId}`, slug);
  await saveStaleCache(`${ID_FOR_PREFIX}${slug}`, anilistId);
}

export async function getCachedAnimeSlug(anilistId: string): Promise<string | null> {
  return getStaleCache<string>(`${SLUG_CACHE_PREFIX}${anilistId}`);
}

function collectPublicSlugsForAnime(anime: Pick<Anime, 'id' | 'title'>): string[] {
  const titles = [anime.title.english, anime.title.romaji, anime.title.native].filter(
    (t): t is string => Boolean(t?.trim())
  );
  const slugs = new Set<string>();
  for (const title of titles) {
    const base = titleToSeoSlug(title);
    if (!base) continue;
    slugs.add(base);
    slugs.add(`${base}-${anime.id}`);
  }
  return [...slugs];
}

function animeMatchesPublicSlug(
  anime: Pick<Anime, 'id' | 'title'>,
  segment: string
): boolean {
  return collectPublicSlugsForAnime(anime).includes(segment);
}

/** Verify trailing `-{id}` suffix and match title prefix. */
async function tryResolveEmbeddedAnilistId(segment: string): Promise<string | null> {
  const match = segment.match(/-(\d+)$/);
  if (!match) return null;

  const anilistId = match[1];
  if (!isAniListNumericId(anilistId)) return null;

  const prefix = segment.slice(0, -match[0].length);
  if (!prefix) return null;

  try {
    const result = await getAnimeById(anilistId);
    const media = result?.data?.Media;
    if (!media) return null;

    if (animeMatchesPublicSlug(media, segment) || animeMatchesPublicSlug(media, prefix)) {
      await saveAnimeSlugMapping(anilistId, segment);
      await saveStaleCache(`${ID_FOR_PREFIX}${prefix}`, anilistId);
      return anilistId;
    }
  } catch {
    /* optional */
  }

  return null;
}

/** AniList title search when slug is not in cache (cold direct links). */
async function lookupAnilistIdBySlug(segment: string): Promise<string | null> {
  const query = slugToSearchQuery(segment);
  if (query.length < 3) return null;

  const results = await searchAnilistMediaByTitle(query, 10);
  if (results.length) {
    for (const anime of results) {
      if (animeMatchesPublicSlug(anime, segment)) {
        const id = String(anime.id);
        await saveAnimeSlugMapping(id, segment);
        return id;
      }
    }

    const baseSegment = segment.replace(/-\d+$/, '');
    if (baseSegment !== segment) {
      for (const anime of results) {
        if (animeMatchesPublicSlug(anime, baseSegment)) {
          const id = String(anime.id);
          await saveAnimeSlugMapping(id, segment);
          await saveAnimeSlugMapping(id, baseSegment);
          return id;
        }
      }
    }
  }

  // AniList down: Jikan title match + cached MAL→AniList map (never use raw MAL id as AniList id)
  try {
    const { searchJikanAnime } = await import('@/lib/api/jikan');
    const jikan = await searchJikanAnime(query, 1, 10);
    const candidates = jikan?.data?.Page?.media ?? [];
    const baseSegment = segment.replace(/-\d+$/, '');

    for (const anime of candidates) {
      const matchesSlug =
        animeMatchesPublicSlug(anime, segment) ||
        (baseSegment !== segment && animeMatchesPublicSlug(anime, baseSegment));
      if (!matchesSlug || !anime.malId) continue;

      const mapped = await getStaleCache<string>(`anilist:malmap:${anime.malId}`);
      if (mapped) {
        await saveAnimeSlugMapping(mapped, segment);
        if (baseSegment !== segment) {
          await saveAnimeSlugMapping(mapped, baseSegment);
        }
        return mapped;
      }
    }
  } catch {
    /* optional */
  }

  return null;
}

/**
 * Map public URL segment back to AniList id.
 * Order: numeric → cache → embedded id → AniList search.
 */
export async function resolveAnilistIdFromSegment(
  segment: string,
  options?: { allowLookup?: boolean }
): Promise<string | null> {
  if (isAniListNumericId(segment)) return segment;

  const cached = await getStaleCache<string>(`${ID_FOR_PREFIX}${segment}`);
  if (cached) return cached;

  if (options?.allowLookup === false) return null;

  const fromEmbedded = await tryResolveEmbeddedAnilistId(segment);
  if (fromEmbedded) return fromEmbedded;

  const fromSearch = await lookupAnilistIdBySlug(segment);
  if (fromSearch) return fromSearch;

  return null;
}

export type AnimeRouteTarget =
  | { type: 'anilist'; anilistId: string }
  | { type: 'hianime'; slug: string };

/** Resolve /anime/{segment} to AniList id or HiAnime slug. */
export async function resolveAnimeRouteTarget(
  segment: string
): Promise<AnimeRouteTarget> {
  const anilistId = await resolveAnilistIdFromSegment(segment, { allowLookup: true });
  if (anilistId) return { type: 'anilist', anilistId };
  return { type: 'hianime', slug: segment };
}

async function createTitleSeoSlug(anilistId: string, title: string): Promise<string> {
  const base = titleToSeoSlug(title) || 'anime';
  const slug = `${base}-${anilistId}`;

  await saveAnimeSlugMapping(anilistId, slug);
  await saveStaleCache(`${ID_FOR_PREFIX}${base}`, anilistId);

  return slug;
}

/**
 * Resolve public slug for an AniList id (cache → HiAnime → title fallback).
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

  const requiredSearch = getRequiredHiAnimeSearch(anilistId);
  if (requiredSearch) {
    try {
      const results = await searchHiAnime(requiredSearch, 1);
      const filtered = results.filter(
        (r) => !r.id.includes('-dub') && !r.name?.toLowerCase().includes('dub')
      );
      const candidates = filtered.length > 0 ? filtered : results;
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) => {
          const aCount = Math.max(a.episodes?.sub ?? 0, a.episodes?.dub ?? 0);
          const bCount = Math.max(b.episodes?.sub ?? 0, b.episodes?.dub ?? 0);
          return aCount >= bCount ? a : b;
        });
        if (best?.id) {
          await saveAnimeSlugMapping(anilistId, best.id);
          return best.id;
        }
      }
    } catch {
      /* fall through to title search */
    }
  }

  try {
    const match = await findHiAnimeMatch(title.trim(), false, episodeCount ?? 0);
    if (
      match?.id &&
      hiAnimeSlugMatchesTitle(title, match.id, { episodeCount: episodeCount ?? 0 })
    ) {
      await saveAnimeSlugMapping(anilistId, match.id);
      return match.id;
    }
  } catch {
    /* HiAnime optional */
  }

  return createTitleSeoSlug(anilistId, title.trim());
}
