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
import { getMangaDexBrowseList, getMangaDexByAnilistId, getMangaDexByMalId, getMangaDexMangaByUuid } from './mangadex-fallback';
import { getConsumetMangaMetadata } from './consumet-manga';

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

/** Persist list items so detail pages work after browse/search fallback */
export async function indexMangaListResults(media: Manga[]): Promise<void> {
  await indexMalMappings(media);
  await Promise.all(
    media.map(async (item) => {
      if (!item.id) return;
      await saveStaleCache(`manga:detail:${item.id}`, { data: { Media: item } });
      if (item.mangadexId) {
        await saveStaleCache(`mangadex:uuid:${item.id}`, item.mangadexId);
      }
    })
  );
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
        if (media.length) await indexMangaListResults(media);
        return fresh;
      },
      CACHE_TTL.MANGA_LIST
    );
    const listedMedia = data?.data?.Page?.media ?? [];
    if (listedMedia.length) void indexMangaListResults(listedMedia);
    return data;
  } catch (error) {
    if (!isAnilistOutage(error)) throw error;

    const stale = await getStaleCache<MangaSearchResult>(cacheKey);
    if (stale?.data?.Page?.media?.length) {
      console.warn(`[AniList] Outage — serving stale manga cache for ${cacheKey}`);
      void indexMangaListResults(stale.data.Page.media);
      return stale;
    }

    console.warn(`[AniList] Outage — MangaDex browse fallback for ${cacheKey}`);
    const mangadexKey = `mangadex:${cacheKey}`;
    try {
      const result = await getCached(
        mangadexKey,
        () => getMangaDexBrowseList(page, perPage, mangadexVariant),
        CACHE_TTL.MANGA_LIST
      );
      const media = result?.data?.Page?.media ?? [];
      if (media.length) await indexMangaListResults(media);
      return result;
    } catch (mangadexError) {
      console.error(
        `[MangaDex] Fallback failed for ${cacheKey}:`,
        (mangadexError as Error).message
      );
    }

    console.warn(`[AniList] Outage — Jikan manga fallback for ${cacheKey}`);
    const jikanKey = `jikan:${cacheKey}`;
    const result = await getCached(
      jikanKey,
      () => jikanFallback(page, perPage),
      CACHE_TTL.MANGA_LIST
    );
    const media = result?.data?.Page?.media ?? [];
    if (media.length) await indexMangaListResults(media);
    return result;
  }
}

/**
 * Fetch single manga by AniList id with stale + MangaDex + Consumet + Jikan fallback.
 */
export async function fetchAnilistMangaDetailWithFallback(
  anilistId: number,
  fetchAnilist: () => Promise<{ data: { Media: Manga } }>,
  mangadexIdHint?: string
): Promise<{ data: { Media: Manga } }> {
  const cacheKey = `manga:detail:${anilistId}`;

  if (mangadexIdHint) {
    const fromHint = await getMangaDexMangaByUuid(mangadexIdHint);
    if (fromHint) {
      const payload = { data: { Media: fromHint } };
      await saveStaleCache(cacheKey, payload);
      await saveStaleCache(`mangadex:uuid:${anilistId}`, mangadexIdHint);
      await indexDetailMapping(fromHint);
      return payload;
    }
  }

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
    if (data?.data?.Media) return data;
    throw new Error('[AniList] Empty manga detail response');
  } catch (error) {
    if (!isAnilistOutage(error) && !(error as Error).message.includes('Empty manga detail')) {
      throw error;
    }

    const stale = await getStaleCache<{ data: { Media: Manga } }>(cacheKey);
    if (stale?.data?.Media) {
      console.warn(`[AniList] Outage — stale manga detail for ${anilistId}`);
      return stale;
    }

    const cachedUuid = await getStaleCache<string>(`mangadex:uuid:${anilistId}`);
    if (cachedUuid) {
      const fromUuid = await getMangaDexMangaByUuid(cachedUuid);
      if (fromUuid) {
        console.warn(`[AniList] Outage — MangaDex UUID detail for ${anilistId}`);
        const payload = { data: { Media: fromUuid } };
        await saveStaleCache(cacheKey, payload);
        await indexDetailMapping(fromUuid);
        return payload;
      }
    }

    const fromMangaDex = await getMangaDexByAnilistId(String(anilistId));
    if (fromMangaDex) {
      console.warn(`[AniList] Outage — MangaDex detail for ${anilistId}`);
      const payload = { data: { Media: fromMangaDex } };
      await saveStaleCache(cacheKey, payload);
      await indexDetailMapping(fromMangaDex);
      return payload;
    }

    const mappedMalId = await getStaleCache<number>(`manga:malfor:${anilistId}`);
    const malIdsToTry = [
      ...(mappedMalId ? [mappedMalId] : []),
      anilistId,
    ];

    for (const malId of malIdsToTry) {
      const fromMangaDexMal = await getMangaDexByMalId(String(malId));
      if (fromMangaDexMal) {
        console.warn(`[AniList] Outage — MangaDex MAL detail for ${anilistId} (mal ${malId})`);
        const payload = { data: { Media: fromMangaDexMal } };
        await saveStaleCache(cacheKey, payload);
        await indexDetailMapping(fromMangaDexMal);
        return payload;
      }
    }

    const fromConsumet = await getConsumetMangaMetadata(String(anilistId));
    if (fromConsumet) {
      console.warn(`[AniList] Outage — Consumet detail for ${anilistId}`);
      const payload = { data: { Media: fromConsumet } };
      await saveStaleCache(cacheKey, payload);
      await indexDetailMapping(fromConsumet);
      return payload;
    }

    const malId =
      mappedMalId ?? anilistId;

    const fromJikan = await getJikanMangaByMalId(malId, String(anilistId));
    if (fromJikan) {
      console.warn(`[AniList] Outage — Jikan manga detail for ${anilistId} (mal ${malId})`);
      const payload = { data: { Media: fromJikan } };
      await saveStaleCache(cacheKey, payload);
      await indexDetailMapping(fromJikan);
      return payload;
    }

    throw error;
  }
}

export { getJikanTrendingManga, getJikanPopularManga };
