/**
 * Dynamic Sitemap for maximum SEO coverage
 * Uses slug URLs when available; HiAnime fallback when AniList is down.
 */

import type { MetadataRoute } from 'next';
import { getTrendingAnime, getPopularAnime } from '@/lib/api/anilist';
import { getHiAnimeBrowseList } from '@/lib/api/hianime-fallback';
import { getTrendingManga, getPopularManga } from '@/lib/api/anilist-manga';
import { SITE_URL } from '@/constants/site';
import { AZ_LETTERS } from '@/constants/routes';
import { GENRES } from '@/constants/genres';
import { genreToSlug } from '@/lib/utils/genre-slug';
import { POPULAR_ANIME_KEYWORDS } from '@/constants/seo';
import { getPreferredTitle } from '@/lib/utils';
import {
  getPublicAnimeSegment,
  getCachedAnimeSlug,
  resolveAnimeSlug,
  isAniListNumericId,
} from '@/lib/seo/anime-slug';
import type { Anime } from '@/types';

async function publicSegmentForAnime(
  anime: Anime,
  lookupBudget: { remaining: number }
): Promise<string> {
  const id = String(anime.id);

  if (!isAniListNumericId(id)) return id;

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

  return id;
}

async function collectAnimeFromLists(
  baseUrl: string,
  lookupBudget: { remaining: number }
): Promise<MetadataRoute.Sitemap> {
  const pagesToFetch = 10;
  const promises: ReturnType<typeof getPopularAnime>[] = [];

  for (let p = 1; p <= pagesToFetch; p++) {
    promises.push(getPopularAnime(p, 50));
  }
  promises.push(getTrendingAnime(1, 50));
  promises.push(getTrendingAnime(2, 50));

  const results = await Promise.allSettled(promises);
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];
  const searchTermsFromAnime = new Set<string>();

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

      const eng = m.title?.english?.trim();
      const romaji = m.title?.romaji?.trim();
      if (eng) searchTermsFromAnime.add(eng.toLowerCase());
      if (romaji && romaji.toLowerCase() !== eng?.toLowerCase()) {
        searchTermsFromAnime.add(romaji.toLowerCase());
      }
    }
  }

  return entries;
}

async function collectAnimeFromHiAnimeFallback(
  baseUrl: string
): Promise<MetadataRoute.Sitemap> {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  for (let page = 1; page <= 4; page++) {
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

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/watchlist`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/history`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
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

  const searchPages: MetadataRoute.Sitemap = POPULAR_ANIME_KEYWORDS.slice(0, 60).map(
    (term) => ({
      url: `${baseUrl}/search?search=${encodeURIComponent(term)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })
  );

  let animePages: MetadataRoute.Sitemap = [];
  const lookupBudget = { remaining: 40 };

  try {
    animePages = await collectAnimeFromLists(baseUrl, lookupBudget);
  } catch (err) {
    console.error('[sitemap] Failed to fetch anime lists:', err);
  }

  if (animePages.length < 80) {
    const fallbackPages = await collectAnimeFromHiAnimeFallback(baseUrl);
    const existing = new Set(animePages.map((p) => p.url));
    for (const entry of fallbackPages) {
      if (!existing.has(entry.url)) {
        animePages.push(entry);
        existing.add(entry.url);
      }
    }
  }

  // Manga detail pages
  let mangaPages: MetadataRoute.Sitemap = [];
  try {
    const [trending, popular] = await Promise.all([
      getTrendingManga(1, 50),
      getPopularManga(1, 50),
    ]);
    const seen = new Set<string>();
    const media = [
      ...(trending?.data?.Page?.media ?? []),
      ...(popular?.data?.Page?.media ?? []),
    ];
    for (const m of media) {
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
  } catch (err) {
    console.error('[sitemap] Failed to fetch manga:', err);
  }

  return [...staticPages, ...genrePages, ...azPages, ...searchPages, ...animePages, ...mangaPages];
}
