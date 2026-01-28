/**
 * HiAnime Search API Route
 * GET /api/search/hianime - Search anime on HiAnime (aniwatch-api)
 * Returns anime that exist on the site and can be watched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchHiAnime } from '@/lib/api/hianime';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!q) {
      return NextResponse.json(
        { success: true, data: { animes: [], currentPage: 1, totalPages: 0, hasNextPage: false } },
        { status: 200 }
      );
    }

    const animes = await searchHiAnime(q, page);
    return NextResponse.json({
      success: true,
      data: {
        animes,
        currentPage: page,
        totalPages: animes.length > 0 ? page : 0,
        hasNextPage: animes.length >= 15,
      },
    });
  } catch (error) {
    console.error('[API Error] /api/search/hianime:', error);
    return NextResponse.json(
      { success: false, error: 'HiAnime search failed', data: { animes: [] } },
      { status: 503 }
    );
  }
}
