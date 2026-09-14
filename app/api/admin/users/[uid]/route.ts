/**
 * GET /api/admin/users/[uid] — user profile + activity summary (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { writeAdminAudit } from '@/lib/admin-audit';
import { toIso } from '@/lib/admin-serialize';

type RouteContext = { params: Promise<{ uid: string }> };

async function countCollection(db: Firestore, path: string): Promise<number> {
  const snap = await db.collection(path).count().get();
  return snap.data().count;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { uid } = await context.params;
  if (!uid || uid.length > 128) {
    return NextResponse.json({ error: 'Invalid uid' }, { status: 400 });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = userSnap.data() || {};
    const user = {
      uid,
      email: String(data.email || ''),
      displayName: String(data.displayName || ''),
      photoURL: (data.photoURL as string) || null,
      emailVerified: !!data.emailVerified,
      emailVerifiedAt: toIso(data.emailVerifiedAt),
      createdAt: toIso(data.createdAt),
      lastLogin: toIso(data.lastLogin),
    };

    const [watchlistCount, historyCount, mangaListCount, readingCount] =
      await Promise.all([
        countCollection(db, `watchlist/${uid}/anime`),
        countCollection(db, `history/${uid}/watching`),
        countCollection(db, `mangaWatchlist/${uid}/manga`),
        countCollection(db, `mangaHistory/${uid}/reading`),
      ]);

    const [historySnap, watchlistSnap] = await Promise.all([
      db
        .collection(`history/${uid}/watching`)
        .orderBy('lastWatched', 'desc')
        .limit(15)
        .get()
        .catch(() => null),
      db
        .collection(`watchlist/${uid}/anime`)
        .orderBy('addedAt', 'desc')
        .limit(15)
        .get()
        .catch(() => null),
    ]);

    const recentHistory = (historySnap?.docs || []).map((d) => {
      const h = d.data();
      return {
        animeId: String(h.animeId || d.id),
        animeTitle: String(h.animeTitle || h.title || ''),
        episodeId: h.episodeId ? String(h.episodeId) : null,
        percentage: typeof h.percentage === 'number' ? h.percentage : null,
        completed: !!h.completed,
        lastWatched: toIso(h.lastWatched),
      };
    });

    const recentWatchlist = (watchlistSnap?.docs || []).map((d) => {
      const w = d.data();
      return {
        animeId: String(w.animeId || d.id),
        title: String(w.title || ''),
        status: String(w.status || 'plan-to-watch'),
        addedAt: toIso(w.addedAt),
      };
    });

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: 'view_user',
      targetUid: uid,
      meta: { email: user.email },
    });

    return NextResponse.json({
      user,
      stats: {
        watchlistCount,
        historyCount,
        mangaListCount,
        readingHistoryCount: readingCount,
      },
      recentHistory,
      recentWatchlist,
    });
  } catch (e) {
    console.error('[admin/users/[uid]]', e);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}
