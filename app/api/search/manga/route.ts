/**
 * Manga Search API Route
 * GET /api/search/manga?search=xxx&page=1&perPage=25
 */

import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/http-cache';
import { searchManga } from '@/lib/api/anilist-manga';

export const maxDuration = 12;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '25', 10);

  try {
    const result = await searchManga(search, page, perPage);
    const mediaCount = result?.data?.Page?.media?.length ?? 0;
    return cachedJson(result, search.trim() ? (mediaCount ? 120 : 10) : 60);
  } catch (error) {
    console.error('[API Error] /api/search/manga:', error);
    return cachedJson(
      {
        data: {
          Page: {
            pageInfo: { total: 0, currentPage: page, lastPage: 1, hasNextPage: false, perPage },
            media: [],
          },
        },
      },
      15
    );
  }
}
