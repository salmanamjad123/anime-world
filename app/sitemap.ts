/**
 * Dynamic Sitemap for SEO coverage.
 * Must never fail the Vercel build — AniList 429 / HiAnime 502 are common at deploy time.
 */

import type { MetadataRoute } from 'next';
import { getTrendingAnime, getPopularAnime } from '@/lib/api/anilist';
import { getHiAnimeBrowseList } from '@/lib/api/hianime-fallback';
import { getTrendingManga, getPopularManga } from '@/lib/api/anilist-manga';
import { SITE_URL } from '@/constants/site';
import { AZ_LETTERS } from '@/constants/routes';
import { GENRES } from '@/constants/genres';
import { genreToSlug } from '@/lib/utils/genre-slug';
import { getPreferredTitle } from '@/lib/utils';
import {
  getPublicAnimeSegment,
  getCachedAnimeSlug,
  resolveAnimeSlug,
  isAniListNumericId,
} from '@/lib/seo/anime-slug';
import type { Anime } from '@/types';

/** Skip static prerender at build — generate on demand so deploy isn't blocked by AniList 429 */
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * Only high-value indexable URLs. Query-param search pages, watchlist, and
 * history inflate "Discovered – not indexed" without helping rankings.
 */
function staticSitemap(baseUrl: string): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/manga`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  const genrePages: MetadataRoute.Sitemap = GENRES.map((genre) => ({
    url: `${baseUrl}/genre/${genreToSlug(genre)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const azPages: MetadataRoute.Sitemap = AZ_LETTERS.map((letter) => ({
    url: `${baseUrl}/anime/az/${letter}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  return [...staticPages, ...genrePages, ...azPages];
}

async function publicSegmentForAnime(
  anime: Anime,
  lookupBudget: { remaining: number }
): Promise<string> {
  const id = String(anime.id);

  if (!isAniListNumericId(id)) return id;

  try {
    const cached = await getCachedAnimeSlug(id);
    if (cached) return getPublicAnimeSegment(id, cached);

    if (lookupBudget.remaining > 0) {
      lookupBudget.remaining -= 1;
      const title = getPreferredTitle(anime.title);
      const slug = await resolveAnimeSlug(id, title, anime.episodes, {
        allowLookup: true,
      });
      if (slug) return getPublicAnimeSegment(id, slug);
    }
  } catch (err) {
    console.warn('[sitemap] slug resolve failed for', id, err);
  }

  return id;
}

async function collectAnimeFromLists(
  baseUrl: string,
  lookupBudget: { remaining: number }
): Promise<MetadataRoute.Sitemap> {
  // Keep request volume low — parallel storms trigger AniList 429 during deploy
  const pagesToFetch = 3;
  const promises: ReturnType<typeof getPopularAnime>[] = [];

  for (let p = 1; p <= pagesToFetch; p++) {
    promises.push(getPopularAnime(p, 50));
  }
  promises.push(getTrendingAnime(1, 50));

  const results = await Promise.allSettled(promises);
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const media = r.value?.data?.Page?.media ?? [];
    for (const m of media) {
      const segment = await publicSegmentForAnime(m, lookupBudget);
      const url = `${baseUrl}/anime/${segment}`;
      if (seen.has(url)) continue;
      seen.add(url);
      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      });
    }
  }

  return entries;
}

async function collectAnimeFromHiAnimeFallback(
  baseUrl: string
): Promise<MetadataRoute.Sitemap> {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  for (let page = 1; page <= 2; page++) {
    try {
      const [trending, popular] = await Promise.all([
        getHiAnimeBrowseList(page, 30, 'trending'),
        getHiAnimeBrowseList(page, 30, 'popular'),
      ]);

      for (const list of [trending, popular]) {
        for (const m of list.data?.Page?.media ?? []) {
          const segment = String(m.id);
          const url = `${baseUrl}/anime/${segment}`;
          if (seen.has(url)) continue;
          seen.add(url);
          entries.push({
            url,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.88,
          });
        }
      }
    } catch (err) {
      console.warn(`[sitemap] HiAnime fallback page ${page} failed:`, err);
    }
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const base = staticSitemap(baseUrl);

  try {
    let animePages: MetadataRoute.Sitemap = [];
    // Cache-only segments — live HiAnime slug search storms the API and fails deploys
    const lookupBudget = { remaining: 0 };

    try {
      animePages = await collectAnimeFromLists(baseUrl, lookupBudget);
    } catch (err) {
      console.error('[sitemap] Failed to fetch anime lists:', err);
    }

    if (animePages.length < 40) {
      try {
        const fallbackPages = await collectAnimeFromHiAnimeFallback(baseUrl);
        const existing = new Set(animePages.map((p) => p.url));
        for (const entry of fallbackPages) {
          if (!existing.has(entry.url)) {
            animePages.push(entry);
            existing.add(entry.url);
          }
        }
      } catch (err) {
        console.warn('[sitemap] HiAnime fallback skipped:', err);
      }
    }

    let mangaPages: MetadataRoute.Sitemap = [];
    try {
      const settled = await Promise.allSettled([
        getTrendingManga(1, 25),
        getPopularManga(1, 25),
      ]);
      const seen = new Set<string>();
      for (const r of settled) {
        if (r.status !== 'fulfilled') continue;
        for (const m of r.value?.data?.Page?.media ?? []) {
          const id = String(m.id);
          if (seen.has(id)) continue;
          seen.add(id);
          mangaPages.push({
            url: `${baseUrl}/manga/${id}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.85,
          });
        }
      }
    } catch (err) {
      console.error('[sitemap] Failed to fetch manga:', err);
    }

    return [...base, ...animePages, ...mangaPages];
  } catch (err) {
    console.error('[sitemap] Fatal — returning static routes only:', err);
    return base;
  }
}
