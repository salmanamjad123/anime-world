/**
 * GET /api/site-settings/ads — public ads policy.
 * Never CDN-cache: admin hide/show must apply on the next home load.
 */

import { uncachedJson } from '@/lib/http-cache';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { defaultAdPlacements } from '@/lib/ads-placements';
import { readSiteAdsSettings, toPublicAdsSettings } from '@/lib/site-settings-ads';
import { noteFirestoreError } from '@/lib/firebase/quota';

function defaultPublicSettings() {
  return toPublicAdsSettings({
    enabled: true,
    hideForLoggedInUsers: true,
    showAdFreeLoginBanner: false,
    placements: defaultAdPlacements(),
    updatedAt: null,
    updatedBy: null,
  });
}

export async function GET() {
  const db = getAdminFirestore();
  if (!db) {
    return uncachedJson(defaultPublicSettings(), 200);
  }

  try {
    const settings = await readSiteAdsSettings(db);
    return uncachedJson(toPublicAdsSettings(settings), 200);
  } catch (e) {
    noteFirestoreError(e);
    console.error('[site-settings/ads]', e);
    const fallback = await readSiteAdsSettings(db).catch(() => null);
    return uncachedJson(fallback ? toPublicAdsSettings(fallback) : defaultPublicSettings(), 200);
  }
}
