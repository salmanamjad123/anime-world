/**
 * Manga Chapters API Route
 * GET /api/manga/[id]/chapters?provider=mangadex
 * MangaDex (readable) first → Consumet scrapers
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_CHAPTER_SOURCE,
  resolveMangaChapters,
} from '@/lib/api/manga-chapters';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mangaId } = await params;
    const provider =
      request.nextUrl.searchParams.get('provider') || DEFAULT_CHAPTER_SOURCE;
    const mangadexIdHint = request.nextUrl.searchParams.get('md') ?? undefined;

    const result = await resolveMangaChapters(
      mangaId,
      provider,
      null,
      mangadexIdHint
    );

    return NextResponse.json({
      chapters: result.chapters,
      provider: result.provider,
      mangadexId: result.mangadexId ?? undefined,
      source: result.source,
    });
  } catch (error) {
    console.error('[API Error] /api/manga/[id]/chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
