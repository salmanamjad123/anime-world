/**
 * GET /api/admin/users — list Firestore users (admin only)
 *
 * Query:
 *   page      1-based page (default 1)
 *   limit     page size 1–100 (default 20). Use limit=0 for all (email blast).
 *   q         search email / name / uid
 *   verified  all | yes | no
 *   sort      email | createdAt | lastLogin (default email)
 *   audit     set to 0 to skip audit log
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  FIRESTORE_QUOTA_MESSAGE,
  isFirestoreQuotaBlocked,
  noteFirestoreError,
} from '@/lib/firebase/quota';
import { writeAdminAudit } from '@/lib/admin-audit';
import { toIso } from '@/lib/admin-serialize';

type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  lastLogin: string | null;
  gameDemoAccess: boolean;
  adsHidden: boolean;
};

function parsePage(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function parseLimit(raw: string | null): number {
  if (raw === '0' || raw === 'all') return 0;
  const n = Number(raw ?? '20');
  if (!Number.isFinite(n)) return 20;
  if (n <= 0) return 0;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function timeMs(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (isFirestoreQuotaBlocked()) {
    return NextResponse.json({ error: FIRESTORE_QUOTA_MESSAGE }, { status: 503 });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const logView = sp.get('audit') !== '0';
  const page = parsePage(sp.get('page'), 1);
  const limit = parseLimit(sp.get('limit'));
  const q = (sp.get('q') || '').trim().toLowerCase();
  const verifiedFilter = (sp.get('verified') || 'all').toLowerCase();
  const sort = (sp.get('sort') || 'email').toLowerCase();

  const gameDemoFilter = (sp.get('gameDemo') || 'all').toLowerCase();
  const adsHiddenFilter = (sp.get('adsHidden') || 'all').toLowerCase();
  const needsFullScan =
    limit === 0 ||
    !!q ||
    verifiedFilter !== 'all' ||
    gameDemoFilter !== 'all' ||
    adsHiddenFilter !== 'all';

  try {
    // Overview / first page: do not read the entire users collection.
    if (!needsFullScan && page === 1 && limit > 0) {
      const pageSize = limit;
      const [countSnap, listSnap] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('users').limit(pageSize).get(),
      ]);
      const totalUsers = countSnap.data().count;
      const users: AdminUserRow[] = listSnap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: (data.email as string) || '',
          displayName: (data.displayName as string) || '',
          photoURL: (data.photoURL as string) || null,
          emailVerified: !!data.emailVerified,
          emailVerifiedAt: toIso(data.emailVerifiedAt),
          createdAt: toIso(data.createdAt),
          lastLogin: toIso(data.lastLogin),
          gameDemoAccess: data.gameDemoAccess === true,
          adsHidden: data.adsHidden === true,
        };
      });
      if (sort === 'createdat') {
        users.sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
      } else if (sort === 'lastlogin') {
        users.sort((a, b) => timeMs(b.lastLogin) - timeMs(a.lastLogin));
      } else {
        users.sort((a, b) =>
          a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
        );
      }
      return NextResponse.json({
        users,
        page: 1,
        pageSize,
        total: totalUsers,
        totalPages: Math.max(1, Math.ceil(totalUsers / pageSize)),
        stats: {
          totalUsers,
          verified: users.filter((u) => u.emailVerified).length,
          unverified: users.filter((u) => !u.emailVerified).length,
          recentSignups: users.filter(
            (u) => timeMs(u.createdAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000
          ).length,
          gameDemoAccess: users.filter((u) => u.gameDemoAccess).length,
          adsHidden: users.filter((u) => u.adsHidden).length,
        },
        statsPartial: true,
      });
    }

    const snap = await db.collection('users').get();
    let users: AdminUserRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: (data.email as string) || '',
        displayName: (data.displayName as string) || '',
        photoURL: (data.photoURL as string) || null,
        emailVerified: !!data.emailVerified,
        emailVerifiedAt: toIso(data.emailVerifiedAt),
        createdAt: toIso(data.createdAt),
        lastLogin: toIso(data.lastLogin),
        gameDemoAccess: data.gameDemoAccess === true,
        adsHidden: data.adsHidden === true,
      };
    });

    const totalUsers = users.length;
    const verifiedCount = users.filter((u) => u.emailVerified).length;
    const unverifiedCount = totalUsers - verifiedCount;
    const gameDemoCount = users.filter((u) => u.gameDemoAccess).length;
    const adsHiddenCount = users.filter((u) => u.adsHidden).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSignups = users.filter((u) => timeMs(u.createdAt) >= weekAgo).length;

    if (verifiedFilter === 'yes') {
      users = users.filter((u) => u.emailVerified);
    } else if (verifiedFilter === 'no') {
      users = users.filter((u) => !u.emailVerified);
    }

    if (gameDemoFilter === 'yes') {
      users = users.filter((u) => u.gameDemoAccess);
    } else if (gameDemoFilter === 'no') {
      users = users.filter((u) => !u.gameDemoAccess);
    }

    if (adsHiddenFilter === 'yes') {
      users = users.filter((u) => u.adsHidden);
    } else if (adsHiddenFilter === 'no') {
      users = users.filter((u) => !u.adsHidden);
    }

    if (q) {
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
      );
    }

    users.sort((a, b) => {
      if (sort === 'createdat') return timeMs(b.createdAt) - timeMs(a.createdAt);
      if (sort === 'lastlogin') return timeMs(b.lastLogin) - timeMs(a.lastLogin);
      return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
    });

    const filteredTotal = users.length;
    const pageSize = limit === 0 ? filteredTotal || 1 : limit;
    const totalPages =
      limit === 0 ? 1 : Math.max(1, Math.ceil(filteredTotal / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = limit === 0 ? 0 : (safePage - 1) * pageSize;
    const pageUsers = limit === 0 ? users : users.slice(start, start + pageSize);

    if (logView) {
      await writeAdminAudit(db, {
        actorUid: auth.uid,
        actorEmail: auth.email,
        action: 'view_users',
        meta: {
          totalUsers,
          filteredTotal,
          page: safePage,
          verifiedFilter,
          q: q || undefined,
        },
      });
    }

    return NextResponse.json({
      users: pageUsers,
      page: safePage,
      pageSize: limit === 0 ? filteredTotal : pageSize,
      total: filteredTotal,
      totalPages,
      stats: {
        totalUsers,
        verified: verifiedCount,
        unverified: unverifiedCount,
        recentSignups,
        gameDemoAccess: gameDemoCount,
        adsHidden: adsHiddenCount,
      },
    });
  } catch (e) {
    console.error('[admin/users]', e);
    if (noteFirestoreError(e)) {
      return NextResponse.json(
        { error: FIRESTORE_QUOTA_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}
