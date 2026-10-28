/**
 * GET/PATCH /api/admin/site-settings — general site flags (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { writeAdminAudit } from '@/lib/admin-audit';
import {
  SITE_SETTINGS_COLLECTION,
  SITE_SETTINGS_GENERAL_DOC,
  readSiteGeneralSettings,
  writeGeneralSettingsCache,
} from '@/lib/site-settings-general';

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
    const settings = await readSiteGeneralSettings(db);
    return NextResponse.json(settings);
  } catch (e) {
    console.error('[admin/site-settings GET]', e);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
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
    const current = await readSiteGeneralSettings(db);
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.email,
    };

    if (typeof body.showMirrorLink === 'boolean') {
      patch.showMirrorLink = body.showMirrorLink;
    }

    const ref = db
      .collection(SITE_SETTINGS_COLLECTION)
      .doc(SITE_SETTINGS_GENERAL_DOC);
    await ref.set(patch, { merge: true });

    const settings = {
      showMirrorLink:
        typeof body.showMirrorLink === 'boolean'
          ? body.showMirrorLink
          : current.showMirrorLink,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.email,
    };
    writeGeneralSettingsCache(settings);

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: 'set_site_settings',
      meta: { showMirrorLink: body.showMirrorLink },
    });

    return NextResponse.json(settings);
  } catch (e) {
    console.error('[admin/site-settings PATCH]', e);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
