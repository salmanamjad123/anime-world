/**
 * AniList manga resilience — stale cache + MangaDex/Jikan fallback when AniList is down.
 */

import { getCached, CACHE_TTL } from '@/lib/cache';
import { getStaleCache, saveStaleCache } from '@/lib/cache/stale-cache';
import type { Manga, MangaSearchResult } from '@/types';
import { isAnilistOutage } from './anilist-resilience';
import {
  getJikanTrendingManga,
  getJikanPopularManga,
  getJikanMangaByMalId,
} from './jikan-manga';
import { getMangaDexBrowseList } from './mangadex-fallback';

export { isAnilistOutage };

async function indexMalMappings(media: Manga[]): Promise<void> {
  await Promise.all(
    media.map(async (item) => {
      if (!item.malId || !item.id) return;
      await saveStaleCache(`manga:malfor:${item.id}`, item.malId);
      await saveStaleCache(`manga:malmap:${item.malId}`, item.id);
    })
  );
}

async function indexDetailMapping(media: Manga): Promise<void> {
  if (media.malId && media.id) {
    await saveStaleCache(`manga:malfor:${media.id}`, media.malId);
    await saveStaleCache(`manga:malmap:${media.malId}`, media.id);
  }
}

/**
 * Fetch AniList manga list data with stale + MangaDex + Jikan fallback.
 */
export async function fetchAnilistMangaListWithFallback(
  cacheKey: string,
  fetchAnilist: () => Promise<MangaSearchResult>,
  jikanFallback: (page: number, perPage: number) => Promise<MangaSearchResult>,
  page: number,
  perPage: number,
  mangadexVariant: 'trending' | 'popular' = 'trending'
): Promise<MangaSearchResult> {
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
      CACHE_TTL.MANGA_LIST
    );
    return data;
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const stale = await getStaleCache<MangaSearchResult>(cacheKey);
    if (stale?.data?.Page?.media?.length) {
      console.warn(`[AniList] Outage — serving stale manga cache for ${cacheKey}`);
      return stale;
    }

    console.warn(`[AniList] Outage — MangaDex browse fallback for ${cacheKey}`);
    const mangadexKey = `mangadex:${cacheKey}`;
    try {
      return await getCached(
        mangadexKey,
        () => getMangaDexBrowseList(page, perPage, mangadexVariant),
        CACHE_TTL.MANGA_LIST
      );
    } catch (mangadexError) {
      console.error(
        `[MangaDex] Fallback failed for ${cacheKey}:`,
        (mangadexError as Error).message
      );
    }

    console.warn(`[AniList] Outage — Jikan manga fallback for ${cacheKey}`);
    const jikanKey = `jikan:${cacheKey}`;
    return getCached(
      jikanKey,
      () => jikanFallback(page, perPage),
      CACHE_TTL.MANGA_LIST
    );
  }
}

/**
 * Fetch single manga by AniList id with stale + Jikan fallback.
 */
export async function fetchAnilistMangaDetailWithFallback(
  anilistId: number,
  fetchAnilist: () => Promise<{ data: { Media: Manga } }>
): Promise<{ data: { Media: Manga } }> {
  const cacheKey = `manga:detail:${anilistId}`;

  try {
    const data = await getCached(
      cacheKey,
      async () => {
        const fresh = await fetchAnilist();
        await saveStaleCache(cacheKey, fresh);
        if (fresh?.data?.Media) await indexDetailMapping(fresh.data.Media);
        return fresh;
      },
      CACHE_TTL.MANGA_INFO
    );
    return data;
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const stale = await getStaleCache<{ data: { Media: Manga } }>(cacheKey);
    if (stale?.data?.Media) {
      console.warn(`[AniList] Outage — stale manga detail for ${anilistId}`);
      return stale;
    }

    const malId =
      (await getStaleCache<number>(`manga:malfor:${anilistId}`)) ?? anilistId;

    const fromJikan = await getJikanMangaByMalId(malId, String(anilistId));
    if (fromJikan) {
      console.warn(`[AniList] Outage — Jikan manga detail for ${anilistId} (mal ${malId})`);
      return { data: { Media: fromJikan } };
    }

    throw error;
  }
}

export { getJikanTrendingManga, getJikanPopularManga };
