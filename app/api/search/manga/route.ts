/**
 * Manga Search API Route
 * GET /api/search/manga?search=xxx&page=1&perPage=25
 */

import { NextRequest } from 'next/server';
import { cachedJson, uncachedJson } from '@/lib/http-cache';
import { searchManga } from '@/lib/api/anilist-manga';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '25', 10);

    const result = await searchManga(search, page, perPage);
    return cachedJson(result, 60);
  } catch (error) {
    console.error('[API Error] /api/search/manga:', error);
    return uncachedJson({ error: 'Failed to search manga' }, 500);
  }
}
