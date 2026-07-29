/**
 * GET /api/admin/users — list Firestore users (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const snap = await db.collection('users').orderBy('email').get();
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: (data.email as string) || '',
        displayName: (data.displayName as string) || '',
        emailVerified: !!data.emailVerified,
      };
    });

    return NextResponse.json({ users, total: users.length });
  } catch (e) {
    console.error('[admin/users]', e);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}
