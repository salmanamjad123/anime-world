/**
 * GET /api/site-settings/ads — public ads policy (default: all on)
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { defaultAdPlacements } from '@/lib/ads-placements';
import { readSiteAdsSettings, toPublicAdsSettings } from '@/lib/site-settings-ads';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
};

function defaultPublicSettings() {
  return toPublicAdsSettings({
    enabled: true,
    hideForLoggedInUsers: false,
    placements: defaultAdPlacements(),
    updatedAt: null,
    updatedBy: null,
  });
}

export async function GET() {
  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(defaultPublicSettings(), { headers: CACHE_HEADERS });
  }

  try {
    const settings = await readSiteAdsSettings(db);
    return NextResponse.json(toPublicAdsSettings(settings), {
      headers: CACHE_HEADERS,
    });
  } catch (e) {
    console.error('[site-settings/ads]', e);
    return NextResponse.json(defaultPublicSettings(), {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  }
}
