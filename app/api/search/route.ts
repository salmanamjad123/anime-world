/**
 * Search API Route
 * GET /api/search - Search anime with filters
 */

import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/http-cache';
import { getPopularAnime, searchAnime } from '@/lib/api/anilist';
import { indexAnimeDetailsFromList } from '@/lib/api/anilist-resilience';
import {
  attachSlugsToSearchResult,
  warmAnimeSlugsInBackground,
} from '@/lib/seo/enrich-slugs';
import type { AnimeFilters, AnimeSearchResult } from '@/types';

export const maxDuration = 12;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters: AnimeFilters = {
    search: searchParams.get('search') || undefined,
    genres: searchParams.get('genres')?.split(',').filter(Boolean),
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined,
    season: searchParams.get('season') as any,
    format: searchParams.get('format') as any,
    status: searchParams.get('status') as any,
    sort: searchParams.get('sort') as any,
  };

  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '20', 10);

  let result: AnimeSearchResult;
  try {
    result = await searchAnime(filters, page, perPage);
  } catch (error) {
    console.error('[API Error] /api/search:', error);
    if (filters.search?.trim()) {
      result = {
        data: {
          Page: {
            pageInfo: { total: 0, currentPage: page, lastPage: 1, hasNextPage: false, perPage },
            media: [],
          },
        },
      };
    } else {
      try {
        result = await getPopularAnime(page, perPage);
      } catch {
        result = {
          data: {
            Page: {
              pageInfo: { total: 0, currentPage: page, lastPage: 1, hasNextPage: false, perPage },
              media: [],
            },
          },
        };
      }
    }
  }

  try {
    const enriched = await attachSlugsToSearchResult(result, { allowLookup: false });
    const media = enriched.data?.Page?.media ?? [];
    void indexAnimeDetailsFromList(media);
    if (!filters.search?.trim()) {
      warmAnimeSlugsInBackground(media);
    }
    const ttl = filters.search?.trim() ? (media.length ? 120 : 10) : 60;
    return cachedJson(enriched, ttl);
  } catch {
    const mediaCount = result?.data?.Page?.media?.length ?? 0;
    return cachedJson(result, filters.search?.trim() && !mediaCount ? 10 : 60);
  }
}
