/**
 * PATCH /api/admin/ads-user — hide or show ads for a specific user
 * Body: { uid: string, adsHidden: boolean }
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
    const adsHidden = body.adsHidden === true;

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ref.update({
      adsHidden,
      adsHiddenUpdatedAt: FieldValue.serverTimestamp(),
      adsHiddenUpdatedBy: auth.email,
    });

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: adsHidden ? 'hide_ads_user' : 'show_ads_user',
      targetUid: uid,
      meta: {
        email: snap.data()?.email ?? null,
        adsHidden,
      },
    });

    return NextResponse.json({ ok: true, uid, adsHidden });
  } catch (e) {
    console.error('[admin/ads-user]', e);
    return NextResponse.json({ error: 'Failed to update user ads setting' }, { status: 500 });
  }
}
