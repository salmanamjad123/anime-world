/**
 * Manga Search API Route
 * GET /api/search/manga?search=xxx&page=1&perPage=25
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchManga } from '@/lib/api/anilist-manga';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '25', 10);

    const result = await searchManga(search, page, perPage);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] /api/search/manga:', error);
    return NextResponse.json(
      { error: 'Failed to search manga' },
      { status: 500 }
    );
  }
}
