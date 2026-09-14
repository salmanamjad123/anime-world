/**
 * PATCH /api/admin/game-demo — grant or revoke Village Arena demo access
 * Body: { uid: string, access: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { writeAdminAudit } from '@/lib/admin-audit';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const access = body.access === true;

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ref.update({
      gameDemoAccess: access,
      gameDemoAccessUpdatedAt: FieldValue.serverTimestamp(),
      gameDemoAccessUpdatedBy: auth.email,
    });

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: access ? 'grant_game_demo' : 'revoke_game_demo',
      targetUid: uid,
      meta: {
        email: snap.data()?.email ?? null,
        access,
      },
    });

    return NextResponse.json({ ok: true, uid, access });
  } catch (e) {
    console.error('[admin/game-demo]', e);
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 });
  }
}
