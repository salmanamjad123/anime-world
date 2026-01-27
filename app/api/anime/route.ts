/**
 * Anime API Route
 * GET /api/anime - List anime (trending, popular, top-rated, by season)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTrendingAnime,
  getPopularAnime,
  getTopRatedAnime,
  getAnimeBySeason,
} from '@/lib/api/anilist';

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
          return NextResponse.json(
            { error: 'Season parameter is required for season type' },
            { status: 400 }
          );
        }
        
        result = await getAnimeBySeason(season, year, page, perPage);
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/anime:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime' },
      { status: 500 }
    );
  }
}
