/**
 * GET /api/admin/ads — read ads settings (admin)
 * PATCH /api/admin/ads — { enabled: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { writeAdminAudit } from '@/lib/admin-audit';
import {
  SITE_SETTINGS_ADS_DOC,
  SITE_SETTINGS_COLLECTION,
  readSiteAdsSettings,
} from '@/lib/site-settings-ads';

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
    const settings = await readSiteAdsSettings(db);
    return NextResponse.json(settings);
  } catch (e) {
    console.error('[admin/ads GET]', e);
    return NextResponse.json({ error: 'Failed to load ads settings' }, { status: 500 });
  }
}

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
    const enabled = body.enabled === true;

    const ref = db.collection(SITE_SETTINGS_COLLECTION).doc(SITE_SETTINGS_ADS_DOC);
    await ref.set(
      {
        enabled,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.email,
      },
      { merge: true }
    );

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: 'set_ads_enabled',
      meta: { enabled },
    });

    const settings = await readSiteAdsSettings(db);
    return NextResponse.json(settings);
  } catch (e) {
    console.error('[admin/ads PATCH]', e);
    return NextResponse.json({ error: 'Failed to update ads settings' }, { status: 500 });
  }
}
