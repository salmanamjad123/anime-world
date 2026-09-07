/**
 * Manga Detail API Route
 * GET /api/manga/[id] - Manga metadata (AniList) + chapters (Consumet or MangaDex fallback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMangaById } from '@/lib/api/anilist-manga';
import { getMangaInfo } from '@/lib/api/consumet-manga';
import {
  findMangaDexByAnilistId,
  getMangaDexChapters,
} from '@/lib/api/mangadex';
import { getPreferredTitle } from '@/lib/utils';
import { getStaleCache } from '@/lib/cache/stale-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mangaId } = await params;
    const provider = request.nextUrl.searchParams.get('provider') || 'mangapill';
    const mangadexId = request.nextUrl.searchParams.get('md') ?? undefined;

    const [anilistRes, consumetInfo] = await Promise.all([
      getMangaById(mangaId, mangadexId ? { mangadexId } : undefined),
      getMangaInfo(mangaId, provider),
    ]);

    const manga = anilistRes?.data?.Media;
    if (!manga) {
      return NextResponse.json({ error: 'Manga not found' }, { status: 404 });
    }

    let chapters = consumetInfo?.chapters || [];
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
      const mdId =
        mangadexId ??
        manga.mangadexId ??
        (await getStaleCache<string>(`mangadex:uuid:${mangaId}`));

      if (mdId) {
        const mdChapters = await getMangaDexChapters(mdId);
        if (mdChapters.length > 0) {
          chapters = mdChapters;
          resolvedProvider = 'mangadex';
        }
      }

      if (chapters.length === 0) {
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

    return NextResponse.json({
      manga,
      chapters,
      provider: resolvedProvider,
    });
  } catch (error) {
    console.error('[API Error] /api/manga/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manga' },
      { status: 500 }
    );
  }
}
