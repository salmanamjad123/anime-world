/**
 * Manga Chapters API Route
 * GET /api/manga/[id]/chapters?provider=mangadex&page=1&limit=60
 * Optional: all=1 — return full cached list (reader navigation)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_CHAPTER_SOURCE,
  DEFAULT_CHAPTER_PAGE_SIZE,
  resolveMangaChapters,
} from '@/lib/api/manga-chapters';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mangaId } = await params;
    const sp = request.nextUrl.searchParams;
    const provider = sp.get('provider') || DEFAULT_CHAPTER_SOURCE;
    const mangadexIdHint = sp.get('md') ?? undefined;
    const all = sp.get('all') === '1' || sp.get('all') === 'true';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const limitRaw = sp.get('limit');
    const limit = limitRaw
      ? parseInt(limitRaw, 10) || DEFAULT_CHAPTER_PAGE_SIZE
      : DEFAULT_CHAPTER_PAGE_SIZE;

    const result = await resolveMangaChapters(
      mangaId,
      provider,
      null,
      mangadexIdHint,
      { page, limit, all }
    );

    return NextResponse.json({
      chapters: result.chapters,
      provider: result.provider,
      mode: result.mode,
      mangadexId: result.mangadexId ?? undefined,
      source: result.source,
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore,
      unavailableReason: result.unavailableReason,
      pageRanges: result.pageRanges ?? [],
      firstChapter: result.firstChapter ?? null,
    });
  } catch (error) {
    console.error('[API Error] /api/manga/[id]/chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
