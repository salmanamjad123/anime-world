/**
 * AniList resilience — stale cache + Jikan fallback when AniList is down.
 */

import { getCached, CACHE_TTL } from '@/lib/cache';
import { getStaleCache, saveStaleCache } from '@/lib/cache/stale-cache';
import type { Anime, AnimeSearchResult } from '@/types';
import {
  getJikanTrending,
  getJikanPopular,
  getJikanTopRated,
  getJikanAnimeByMalId,
} from './jikan';
import { getHiAnimeBrowseList, searchHiAnimeAsList } from './hianime-fallback';

export function isAnilistOutage(error: unknown): boolean {
  const err = error as { response?: { status?: number }; request?: unknown };
  const status = err.response?.status;
  if (status === 403 || status === 429 || status === 502 || status === 503) return true;
  // AniList unreachable (timeout / no response)
  if (!err.response && err.request) return true;
  return false;
}

/** Save MAL ↔ AniList mapping from list/detail responses for future fallbacks. */
async function indexMalMappings(media: Anime[]): Promise<void> {
  await Promise.all(
    media.map(async (item) => {
      if (!item.malId || !item.id) return;
      await saveStaleCache(`anilist:malfor:${item.id}`, item.malId);
      await saveStaleCache(`anilist:malmap:${item.malId}`, item.id);
    })
  );
}

async function indexDetailMapping(media: Anime): Promise<void> {
  if (media.malId && media.id) {
    await saveStaleCache(`anilist:malfor:${media.id}`, media.malId);
    await saveStaleCache(`anilist:malmap:${media.malId}`, media.id);
  }
}

/**
 * Fetch AniList list data with stale + Jikan fallback.
 * Normal path unchanged when AniList is healthy.
 */
export async function fetchAnilistListWithFallback(
  cacheKey: string,
  fetchAnilist: () => Promise<AnimeSearchResult>,
  jikanFallback: (page: number, perPage: number) => Promise<AnimeSearchResult>,
  page: number,
  perPage: number,
  hianimeVariant: 'trending' | 'popular' = 'trending'
): Promise<AnimeSearchResult> {
  try {
    const data = await getCached(
      cacheKey,
      async () => {
        const fresh = await fetchAnilist();
        await saveStaleCache(cacheKey, fresh);
        const media = fresh?.data?.Page?.media ?? [];
        if (media.length) await indexMalMappings(media);
        return fresh;
      },
      CACHE_TTL.ANIME_LIST
    );
    return data;
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const stale = await getStaleCache<AnimeSearchResult>(cacheKey);
    if (stale?.data?.Page?.media?.length) {
      console.warn(`[AniList] Outage — serving stale cache for ${cacheKey}`);
      return stale;
    }

    console.warn(`[AniList] Outage — HiAnime browse fallback for ${cacheKey}`);
    const hianimeKey = `hianime:${cacheKey}`;
    try {
      return await getCached(
        hianimeKey,
        () => getHiAnimeBrowseList(page, perPage, hianimeVariant),
        CACHE_TTL.ANIME_LIST
      );
    } catch (hianimeError) {
      console.error(`[HiAnime] Fallback failed for ${cacheKey}:`, (hianimeError as Error).message);
    }

    console.warn(`[AniList] Outage — Jikan fallback for ${cacheKey}`);
    const jikanKey = `jikan:${cacheKey}`;
    return getCached(
      jikanKey,
      () => jikanFallback(page, perPage),
      CACHE_TTL.ANIME_LIST
    );
  }
}

/**
 * Fetch single anime by AniList id with stale + Jikan fallback.
 */
export async function fetchAnilistDetailWithFallback(
  anilistId: number,
  fetchAnilist: () => Promise<{ data: { Media: Anime } }>
): Promise<{ data: { Media: Anime } }> {
  const cacheKey = `anilist:anime:${anilistId}`;

  try {
    const data = await getCached(
      cacheKey,
      async () => {
        const fresh = await fetchAnilist();
        await saveStaleCache(cacheKey, fresh);
        if (fresh?.data?.Media) await indexDetailMapping(fresh.data.Media);
        return fresh;
      },
      CACHE_TTL.ANIME_INFO
    );
    return data;
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const stale = await getStaleCache<{ data: { Media: Anime } }>(cacheKey);
    if (stale?.data?.Media) {
      console.warn(`[AniList] Outage — stale detail for ${anilistId}`);
      return stale;
    }

    const malId =
      (await getStaleCache<number>(`anilist:malfor:${anilistId}`)) ?? anilistId;

    const fromJikan = await getJikanAnimeByMalId(malId, String(anilistId));
    if (fromJikan) {
      console.warn(`[AniList] Outage — Jikan detail for ${anilistId} (mal ${malId})`);
      return { data: { Media: fromJikan } };
    }

    throw error;
  }
}

export { getJikanTrending, getJikanPopular, getJikanTopRated };
