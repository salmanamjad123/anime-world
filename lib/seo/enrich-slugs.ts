/**
 * Attach HiAnime slugs to anime list payloads (server-only).
 */

import type { Anime, AnimeSearchResult } from '@/types';
import { isAniListNumericId } from '@/lib/seo/anime-path';
import {
  getCachedAnimeSlug,
  isTrustedAnimeSlug,
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

function animeTitle(anime: Anime): string | undefined {
  return anime.title?.english || anime.title?.romaji || undefined;
}

/** Prefer a trusted slug; drop poisoned HiAnime mappings so links use /anime/{id}. */
function pickTrustedSlug(
  anime: Anime,
  candidate?: string | null
): string | undefined {
  if (!candidate) return undefined;
  if (isTrustedAnimeSlug(candidate, animeTitle(anime), anime.episodes)) {
    return candidate;
  }
  return undefined;
}

export async function attachSlugToAnime(
  anime: Anime,
  options?: { allowLookup?: boolean }
): Promise<Anime> {
  const id = String(anime.id);

  if (!isAniListNumericId(id)) {
    return { ...anime, slug: anime.slug ?? id };
  }

  const existing = pickTrustedSlug(anime, anime.slug);
  if (existing) return { ...anime, slug: existing };

  const cached = pickTrustedSlug(anime, await getCachedAnimeSlug(id));
  if (cached) return { ...anime, slug: cached };

  if (!options?.allowLookup) {
    return { ...anime, slug: undefined };
  }

  const title = animeTitle(anime);
  const slug = await resolveAnimeSlug(id, title, anime.episodes, {
    allowLookup: true,
  });
  return slug ? { ...anime, slug } : { ...anime, slug: undefined };
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

      const existing = pickTrustedSlug(item, item.slug);
      if (existing) return { ...item, slug: existing };

      const cached = pickTrustedSlug(item, await getCachedAnimeSlug(id));
      if (cached) return { ...item, slug: cached };

      // Drop poisoned slug so home/spotlight link with AniList id.
      return { ...item, slug: undefined };
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
    const title = animeTitle(item);
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
    .filter((item) => isAniListNumericId(String(item.id)))
    .filter((item) => {
      const title = animeTitle(item);
      // Warm missing or poisoned HiAnime slugs.
      if (!item.slug) return true;
      return !isTrustedAnimeSlug(item.slug, title, item.episodes);
    })
    .slice(0, limit);

  if (!candidates.length) return;

  void (async () => {
    for (const item of candidates) {
      const id = String(item.id);
      const title = animeTitle(item);
      if (!title?.trim()) continue;

      const cached = await getCachedAnimeSlug(id);
      if (cached && isTrustedAnimeSlug(cached, title, item.episodes)) continue;

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
      // No title here — only attach non-HiAnime SEO slugs; skip unverified HiAnime.
      if (cached && isTrustedAnimeSlug(cached)) {
        slugById.set(id, cached);
      }
    })
  );

  return rows.map((row) => {
    const slug = slugById.get(row.animeId);
    return slug ? { ...row, slug } : row;
  });
}
