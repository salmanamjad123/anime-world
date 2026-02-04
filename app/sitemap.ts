/**
 * Dynamic Sitemap for maximum SEO coverage
 * 500+ anime, all genres, search URLs for popular anime names
 */

import type { MetadataRoute } from 'next';
import { getTrendingAnime, getPopularAnime } from '@/lib/api/anilist';
import { getTrendingManga, getPopularManga } from '@/lib/api/anilist-manga';
import { SITE_URL } from '@/constants/site';
import { AZ_LETTERS } from '@/constants/routes';
import { GENRES } from '@/constants/genres';
import { genreToSlug } from '@/lib/utils/genre-slug';
import { POPULAR_ANIME_KEYWORDS } from '@/constants/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Static pages - highest priority
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/watchlist`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/history`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/manga`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  // Genre landing pages - high value for "action anime", "romance anime" etc
  const genrePages: MetadataRoute.Sitemap = GENRES.map((genre) => ({
    url: `${baseUrl}/genre/${genreToSlug(genre)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  // A-Z browse pages
  const azPages: MetadataRoute.Sitemap = AZ_LETTERS.map((letter) => ({
    url: `${baseUrl}/anime/az/${letter}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  // Search URLs for popular anime names - "one piece" -> /search?search=one+piece
  const searchPages: MetadataRoute.Sitemap = POPULAR_ANIME_KEYWORDS.slice(0, 60).map(
    (term) => ({
      url: `${baseUrl}/search?search=${encodeURIComponent(term)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })
  );

  // Anime detail pages - fetch 500+ from multiple pages
  let animePages: MetadataRoute.Sitemap = [];
  try {
    const pagesToFetch = 10; // 10 x 50 = 500 anime
    const promises: ReturnType<typeof getPopularAnime>[] = [];

    for (let p = 1; p <= pagesToFetch; p++) {
      promises.push(getPopularAnime(p, 50));
    }
    // Also get trending for freshness
    promises.push(getTrendingAnime(1, 50));
    promises.push(getTrendingAnime(2, 50));

    const results = await Promise.allSettled(promises);
    const seen = new Set<string>();
    const searchTermsFromAnime = new Set<string>();

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const media = r.value?.data?.Page?.media ?? [];
      for (const m of media) {
        const id = String(m.id);
        if (seen.has(id)) continue;
        seen.add(id);
        animePages.push({
          url: `${baseUrl}/anime/${id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.9,
        });
        // Extract titles for dynamic search URLs (trending + popular anime keywords)
        const eng = m.title?.english?.trim();
        const romaji = m.title?.romaji?.trim();
        if (eng) searchTermsFromAnime.add(eng.toLowerCase());
        if (romaji && romaji.toLowerCase() !== eng?.toLowerCase()) {
          searchTermsFromAnime.add(romaji.toLowerCase());
        }
      }
    }

    // Dynamic search URLs from AniList anime - auto-includes trending/popular
    const dynamicSearchPages: MetadataRoute.Sitemap = [...searchTermsFromAnime]
      .slice(0, 200)
      .map((term) => ({
        url: `${baseUrl}/search?search=${encodeURIComponent(term)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    // Merge static + dynamic search pages, dedupe by URL
    const searchUrlSet = new Set(searchPages.map((s) => s.url));
    for (const s of dynamicSearchPages) {
      if (!searchUrlSet.has(s.url)) {
        searchUrlSet.add(s.url);
        searchPages.push(s);
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch anime:', err);
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
