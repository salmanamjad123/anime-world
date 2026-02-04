/**
 * Manga API Route
 * GET /api/manga - List manga (trending, popular)
 */

import { NextRequest, NextResponse } from 'next/server';
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
          return NextResponse.json(
            { error: 'Invalid type. Use trending or popular' },
            { status: 400 }
          );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/manga:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manga' },
      { status: 500 }
    );
  }
}
