/**
 * GET /api/admin/comments — latest episode comments (collection group) with cursor pagination
 *
 * Query: limit=15 (default), cursor=<firestore doc path>
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getAnimeByIds } from '@/lib/api/anilist';
import { toIso } from '@/lib/admin-serialize';
import { getPreferredTitle } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

export type AdminCommentRow = {
  id: string;
  path: string;
  animeId: string;
  episodeId: string;
  userId: string;
  displayName: string;
  text: string;
  parentId: string | null;
  likes: number;
  createdAt: string | null;
  animeTitle: string | null;
  watchPath: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT);
  const pageSize = Math.min(
    Math.max(1, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const cursor = request.nextUrl.searchParams.get('cursor')?.trim() || '';

  try {
    const rows: AdminCommentRow[] = [];
    let startAfterPath = cursor;
    // Over-fetch in batches; collectionGroup('comments') also hits root stubs.
    const BATCH = Math.max(pageSize + 1, 40);
    let exhausted = false;
    let rounds = 0;

    while (rows.length < pageSize + 1 && !exhausted && rounds < 5) {
      rounds += 1;
      let q = db
        .collectionGroup('comments')
        .orderBy('createdAt', 'desc')
        .limit(BATCH);

      if (startAfterPath) {
        const cursorSnap = await db.doc(startAfterPath).get();
        if (cursorSnap.exists) {
          q = q.startAfter(cursorSnap);
        }
      }

      const snap = await q.get();
      if (snap.empty || snap.docs.length < BATCH) exhausted = true;
      if (snap.empty) break;

      startAfterPath = snap.docs[snap.docs.length - 1]!.ref.path;

      for (const docSnap of snap.docs) {
        // Leaf path: comments/{animeId}/episodes/{epId}/comments/{commentId}
        const parts = docSnap.ref.path.split('/');
        if (parts.length !== 6 || parts[0] !== 'comments' || parts[2] !== 'episodes') {
          continue;
        }

        const data = docSnap.data() as Record<string, unknown>;
        if (typeof data.text !== 'string' || typeof data.userId !== 'string') continue;

        const animeId =
          typeof data.animeId === 'string' ? data.animeId : parts[1]!;
        const episodeId =
          typeof data.episodeId === 'string' ? data.episodeId : parts[3]!;

        rows.push({
          id: docSnap.id,
          path: docSnap.ref.path,
          animeId,
          episodeId,
          userId: data.userId,
          displayName:
            typeof data.displayName === 'string' && data.displayName.trim()
              ? data.displayName
              : 'Anonymous',
          text: data.text,
          parentId: typeof data.parentId === 'string' ? data.parentId : null,
          likes: typeof data.likes === 'number' ? data.likes : 0,
          createdAt: toIso(data.createdAt),
          animeTitle: null,
          watchPath: ROUTES.WATCH(animeId, episodeId),
        });
        if (rows.length >= pageSize + 1) break;
      }
    }

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.path ?? null : null;

    const uniqueAnimeIds = [...new Set(page.map((r) => r.animeId))];
    const titleById = new Map<string, string>();
    if (uniqueAnimeIds.length > 0) {
      try {
        const media = await getAnimeByIds(uniqueAnimeIds);
        for (const anime of media) {
          if (anime?.id == null) continue;
          titleById.set(String(anime.id), getPreferredTitle(anime.title) || String(anime.id));
        }
      } catch (err) {
        console.warn('[admin/comments] title lookup failed:', err);
      }
    }

    for (const row of page) {
      row.animeTitle = titleById.get(row.animeId) ?? null;
    }

    return NextResponse.json({
      comments: page,
      nextCursor,
      hasMore,
      limit: pageSize,
    });
  } catch (e) {
    console.error('[admin/comments]', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error:
          message.includes('index') || message.includes('FAILED_PRECONDITION')
            ? 'Firestore needs a collection-group index on comments.createdAt. Open the error link in server logs to create it, then retry.'
            : 'Failed to list comments',
        detail: message,
      },
      { status: 500 }
    );
  }
}
