/**
 * Manga Chapters API Route
 * GET /api/manga/[id]/chapters?provider=mangapill
 * Returns chapters only (Consumet or MangaDex fallback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMangaInfo } from '@/lib/api/consumet-manga';
import {
  findMangaDexByAnilistId,
  getMangaDexChapters,
} from '@/lib/api/mangadex';
import { getMangaById } from '@/lib/api/anilist-manga';
import { getStaleCache } from '@/lib/cache/stale-cache';
import { getPreferredTitle } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mangaId } = await params;
    const provider = request.nextUrl.searchParams.get('provider') || 'mangapill';
    const mangadexIdHint = request.nextUrl.searchParams.get('md') ?? undefined;

    let chapters = (await getMangaInfo(mangaId, provider))?.chapters || [];
    let resolvedProvider = provider;

    if (chapters.length === 0) {
      const providersToTry = ['mangapill', 'mangadex', 'mangareader'].filter((p) => p !== provider);
      for (const p of providersToTry) {
        const info = await getMangaInfo(mangaId, p);
        if (info?.chapters?.length) {
          chapters = info.chapters;
          resolvedProvider = p;
          break;
        }
      }
    }

    if (chapters.length === 0) {
      const anilistRes = await getMangaById(
        mangaId,
        mangadexIdHint ? { mangadexId: mangadexIdHint } : undefined
      );
      const manga = anilistRes?.data?.Media;
      const mdId =
        mangadexIdHint ??
        manga?.mangadexId ??
        (await getStaleCache<string>(`mangadex:uuid:${mangaId}`));

      if (mdId) {
        const mdChapters = await getMangaDexChapters(mdId);
        if (mdChapters.length > 0) {
          chapters = mdChapters;
          resolvedProvider = 'mangadex';
        }
      }

      if (chapters.length === 0 && manga) {
        const title = getPreferredTitle(manga.title);
        const foundId = await findMangaDexByAnilistId(mangaId, title);
        if (foundId && foundId !== mdId) {
          const mdChapters = await getMangaDexChapters(foundId);
          if (mdChapters.length > 0) {
            chapters = mdChapters;
            resolvedProvider = 'mangadex';
          }
        }
      }
    }

    return NextResponse.json({ chapters, provider: resolvedProvider });
  } catch (error) {
    console.error('[API Error] /api/manga/[id]/chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
