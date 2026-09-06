/**
 * Attach HiAnime slugs to anime list payloads (server-only).
 */

import type { Anime, AnimeSearchResult } from '@/types';
import { isAniListNumericId } from '@/lib/seo/anime-path';
import {
  getCachedAnimeSlug,
  resolveAnimeSlug,
  saveAnimeSlugMapping,
} from '@/lib/seo/anime-slug';

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (!items.length) return;

  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });

  await Promise.all(workers);
}

export async function attachSlugToAnime(
  anime: Anime,
  options?: { allowLookup?: boolean }
): Promise<Anime> {
  const id = String(anime.id);

  if (!isAniListNumericId(id)) {
    return { ...anime, slug: anime.slug ?? id };
  }

  if (anime.slug) return anime;

  const cached = await getCachedAnimeSlug(id);
  if (cached) return { ...anime, slug: cached };

  if (!options?.allowLookup) return anime;

  const title = anime.title?.english || anime.title?.romaji;
  const slug = await resolveAnimeSlug(id, title, anime.episodes, {
    allowLookup: true,
  });
  return slug ? { ...anime, slug } : anime;
}

/** Cache reads in parallel; optional bounded live HiAnime lookups for missing slugs. */
export async function attachSlugsToMedia(
  media: Anime[],
  options?: { allowLookup?: boolean; maxLookups?: number; lookupConcurrency?: number }
): Promise<Anime[]> {
  const enriched = await Promise.all(
    media.map(async (item) => {
      const id = String(item.id);

      if (!isAniListNumericId(id)) {
        return { ...item, slug: item.slug ?? id };
      }

      if (item.slug) return item;

      const cached = await getCachedAnimeSlug(id);
      if (cached) return { ...item, slug: cached };

      return item;
    })
  );

  if (!options?.allowLookup) return enriched;

  const misses = enriched.filter(
    (item) => isAniListNumericId(String(item.id)) && !item.slug
  );
  const maxLookups = options.maxLookups ?? misses.length;
  const toLookup = misses.slice(0, maxLookups);
  const concurrency = options.lookupConcurrency ?? 4;
  const slugById = new Map<string, string>();

  await runWithConcurrency(toLookup, concurrency, async (item) => {
    const id = String(item.id);
    const title = item.title?.english || item.title?.romaji;
    const slug = await resolveAnimeSlug(id, title, item.episodes, {
      allowLookup: true,
    });
    if (slug) slugById.set(id, slug);
  });

  if (!slugById.size) return enriched;

  return enriched.map((item) => {
    const slug = slugById.get(String(item.id));
    return slug ? { ...item, slug } : item;
  });
}

export async function attachSlugsToSearchResult(
  result: AnimeSearchResult,
  options?: { allowLookup?: boolean; maxLookups?: number; lookupConcurrency?: number }
): Promise<AnimeSearchResult> {
  const media = result?.data?.Page?.media;
  if (!media?.length) return result;

  const enriched = await attachSlugsToMedia(media, options);
  return {
    ...result,
    data: {
      ...result.data,
      Page: {
        ...result.data.Page,
        media: enriched,
      },
    },
  };
}

/** Fire-and-forget slug warming for list responses (does not block the HTTP response). */
export function warmAnimeSlugsInBackground(media: Anime[], limit = 12): void {
  const candidates = media
    .filter((item) => isAniListNumericId(String(item.id)) && !item.slug)
    .slice(0, limit);

  if (!candidates.length) return;

  void (async () => {
    for (const item of candidates) {
      const id = String(item.id);
      const cached = await getCachedAnimeSlug(id);
      if (cached) continue;

      const title = item.title?.english || item.title?.romaji;
      if (!title?.trim()) continue;

      try {
        const slug = await resolveAnimeSlug(id, title, item.episodes, {
          allowLookup: true,
        });
        if (slug) await saveAnimeSlugMapping(id, slug);
      } catch {
        /* optional warm-up */
      }
    }
  })();
}

/** Batch read cached slugs for schedule / watchlist-style payloads. */
export async function attachSlugsToIdRows<T extends { animeId: string; slug?: string }>(
  rows: T[]
): Promise<T[]> {
  const uniqueIds = [...new Set(rows.map((row) => row.animeId))];
  const slugById = new Map<string, string>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      if (!isAniListNumericId(id)) {
        slugById.set(id, id);
        return;
      }
      const cached = await getCachedAnimeSlug(id);
      if (cached) slugById.set(id, cached);
    })
  );

  return rows.map((row) => {
    const slug = slugById.get(row.animeId);
    return slug ? { ...row, slug } : row;
  });
}
