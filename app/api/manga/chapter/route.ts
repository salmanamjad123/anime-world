/**
 * Manga Chapter API Route
 * GET /api/manga/chapter?chapterId=xxx&provider=mangapill
 * Returns chapter page images - MangaDex or Consumet (both use Redis → Firestore → API cache)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChapterPages } from '@/lib/api/consumet-manga';
import {
  isMangaDexChapterId,
  getMangaDexChapterPagesCached,
} from '@/lib/api/mangadex';

export async function GET(request: NextRequest) {
  try {
    const chapterId = request.nextUrl.searchParams.get('chapterId');
    const provider = request.nextUrl.searchParams.get('provider') || 'mangapill';
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (!chapterId) {
      return NextResponse.json(
        { error: 'chapterId is required' },
        { status: 400 }
      );
    }

    let pages;

    if (isMangaDexChapterId(chapterId) || provider === 'mangadex') {
      pages = await getMangaDexChapterPagesCached(chapterId, refresh);
    } else {
      pages = await getChapterPages(chapterId, provider, refresh);
    }

    if (!pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'Chapter not found or no pages available' },
        { status: 404 }
      );
    }

    return NextResponse.json({ pages });
  } catch (error) {
    const err = error as Error;
    console.error('[API Error] /api/manga/chapter:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    );
  }
}
