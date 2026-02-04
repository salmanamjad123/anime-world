/**
 * Manga Info API Route
 * GET /api/manga/[id]/info - Manga metadata only (AniList, fast)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMangaById } from '@/lib/api/anilist-manga';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mangaId } = await params;
    const res = await getMangaById(mangaId);
    const manga = res?.data?.Media;

    if (!manga) {
      return NextResponse.json({ error: 'Manga not found' }, { status: 404 });
    }

    return NextResponse.json({ manga });
  } catch (error) {
    console.error('[API Error] /api/manga/[id]/info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manga' },
      { status: 500 }
    );
  }
}
