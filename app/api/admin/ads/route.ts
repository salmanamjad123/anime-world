/**
 * GET /api/admin/ads — read ads settings + placement catalog (admin)
 * PATCH /api/admin/ads — partial update
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { writeAdminAudit } from '@/lib/admin-audit';
import {
  AD_PLACEMENTS,
  AD_PLACEMENT_IDS,
  countActiveAdUnits,
  normalizeAdPlacements,
  type AdPlacementId,
} from '@/lib/ads-placements';
import {
  SITE_SETTINGS_ADS_DOC,
  SITE_SETTINGS_COLLECTION,
  readSiteAdsSettings,
} from '@/lib/site-settings-ads';

function isPlacementId(value: string): value is AdPlacementId {
  return (AD_PLACEMENT_IDS as string[]).includes(value);
}

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
    const counts = countActiveAdUnits(settings);
    return NextResponse.json({
      ...settings,
      placementsCatalog: AD_PLACEMENTS,
      counts,
    });
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
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.email,
    };

    if (typeof body.enabled === 'boolean') {
      patch.enabled = body.enabled;
    }
    if (typeof body.hideForLoggedInUsers === 'boolean') {
      patch.hideForLoggedInUsers = body.hideForLoggedInUsers;
    }

    if (body.placements && typeof body.placements === 'object') {
      const current = await readSiteAdsSettings(db);
      const next = normalizeAdPlacements(current.placements);
      for (const [key, value] of Object.entries(body.placements)) {
        if (isPlacementId(key) && typeof value === 'boolean') {
          next[key] = value;
        }
      }
      patch.placements = next;
    }

    const ref = db.collection(SITE_SETTINGS_COLLECTION).doc(SITE_SETTINGS_ADS_DOC);
    await ref.set(patch, { merge: true });

    await writeAdminAudit(db, {
      actorUid: auth.uid,
      actorEmail: auth.email,
      action: 'set_ads_settings',
      meta: {
        enabled: body.enabled,
        hideForLoggedInUsers: body.hideForLoggedInUsers,
        placements: body.placements,
      },
    });

    const settings = await readSiteAdsSettings(db);
    return NextResponse.json({
      ...settings,
      placementsCatalog: AD_PLACEMENTS,
      counts: countActiveAdUnits(settings),
    });
  } catch (e) {
    console.error('[admin/ads PATCH]', e);
    return NextResponse.json({ error: 'Failed to update ads settings' }, { status: 500 });
  }
}
