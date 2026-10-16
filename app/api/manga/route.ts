/**
 * Manga API Route
 * GET /api/manga - List manga (trending, popular)
 */

import { NextRequest } from 'next/server';
import { cachedJson, uncachedJson } from '@/lib/http-cache';
import { getTrendingManga, getPopularManga, getMangaByGenre } from '@/lib/api/anilist-manga';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'trending';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);
    const genresParam = searchParams.get('genres') || '';
    const genres = genresParam ? genresParam.split(',').map((g) => g.trim()).filter(Boolean) : [];
    const sort = searchParams.get('sort') || 'POPULARITY_DESC';

    let result;

    if (genres.length > 0) {
      result = await getMangaByGenre(
        genres,
        page,
        perPage,
        sort === 'TRENDING_DESC' ? 'TRENDING_DESC' : 'POPULARITY_DESC'
      );
    } else {
      switch (type) {
        case 'trending':
          result = await getTrendingManga(page, perPage);
          break;
        case 'popular':
          result = await getPopularManga(page, perPage);
          break;
        default:
          return uncachedJson(
            { error: 'Invalid type. Use trending or popular' },
            400
          );
      }
    }

    return cachedJson(result, 120);
  } catch (error) {
    console.error('[API Error] /api/manga:', error);
    return uncachedJson({ error: 'Failed to fetch manga' }, 500);
  }
}
