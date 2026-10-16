/**
 * Search API Route
 * GET /api/search - Search anime with filters
 */

import { NextRequest } from 'next/server';
import { cachedJson, uncachedJson } from '@/lib/http-cache';
import { searchAnime } from '@/lib/api/anilist';
import {
  attachSlugsToSearchResult,
  warmAnimeSlugsInBackground,
} from '@/lib/seo/enrich-slugs';
import type { AnimeFilters } from '@/types';

export async function GET(request: NextRequest) {
  try {
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

    const result = await searchAnime(filters, page, perPage);
    const enriched = await attachSlugsToSearchResult(result, {
      allowLookup: false,
    });
    warmAnimeSlugsInBackground(enriched.data?.Page?.media ?? []);

    return cachedJson(enriched, 60);
  } catch (error) {
    console.error('[API Error] /api/search:', error);
    return uncachedJson({ error: 'Failed to search anime' }, 500);
  }
}
