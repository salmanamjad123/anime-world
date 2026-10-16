/**
 * Anime API Route
 * GET /api/anime - List anime (trending, popular, top-rated, by season)
 */

import { NextRequest } from 'next/server';
import { cachedJson, uncachedJson } from '@/lib/http-cache';
import {
  getTrendingAnime,
  getPopularAnime,
  getTopRatedAnime,
  getAnimeBySeason,
} from '@/lib/api/anilist';
import {
  attachSlugsToSearchResult,
  warmAnimeSlugsInBackground,
} from '@/lib/seo/enrich-slugs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'trending';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);

    let result;

    switch (type) {
      case 'trending':
        result = await getTrendingAnime(page, perPage);
        break;
      
      case 'popular':
        result = await getPopularAnime(page, perPage);
        break;
      
      case 'top-rated':
        result = await getTopRatedAnime(page, perPage);
        break;
      
      case 'season':
        const season = searchParams.get('season');
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
        
        if (!season) {
          return uncachedJson(
            { error: 'Season parameter is required for season type' },
            400
          );
        }
        
        result = await getAnimeBySeason(season, year, page, perPage);
        break;
      
      default:
        return uncachedJson({ error: 'Invalid type parameter' }, 400);
    }

    // Cache-only slugs — respond fast; warm missing slugs in background
    const enriched = await attachSlugsToSearchResult(result, {
      allowLookup: false,
    });
    warmAnimeSlugsInBackground(enriched.data?.Page?.media ?? []);

    return cachedJson(enriched, 120);
  } catch (error) {
    console.error('[API Error] /api/anime:', error);
    return uncachedJson({ error: 'Failed to fetch anime' }, 500);
  }
}
