/**
 * A-Z List API Route
 * GET /api/azlist/[letter] - Get anime list by letter (0-9, A-Z, other)
 */

import { NextRequest } from 'next/server';
import { cachedJson, uncachedJson } from '@/lib/http-cache';
import { getHiAnimeAZList } from '@/lib/api/hianime';
import { getJikanAZList } from '@/lib/api/jikan';

export const maxDuration = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  const { letter } = await params;
  const sortOption = decodeURIComponent(letter || '');
  const page = parseInt(new URL(request.url).searchParams.get('page') || '1', 10);

  try {
    const data = await getHiAnimeAZList(sortOption, page);
    return cachedJson(data, 300);
  } catch (error: any) {
    try {
      const fallback = await getJikanAZList(sortOption.toLowerCase(), page);
      if (fallback.animes.length > 0) return cachedJson(fallback, 120);
    } catch {
      /* both sources failed */
    }
    console.error('[API Error] /api/azlist/[letter]:', error?.message);
    return uncachedJson(
      {
        error: 'Failed to fetch A-Z list',
        message: error?.message,
      },
      500
    );
  }
}
