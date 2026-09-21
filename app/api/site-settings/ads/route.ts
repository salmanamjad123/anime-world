/**
 * GET /api/site-settings/ads — public ads on/off (default: enabled)
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { readSiteAdsSettings } from '@/lib/site-settings-ads';

export async function GET() {
  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json(
      { enabled: true },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  }

  try {
    const { enabled } = await readSiteAdsSettings(db);
    return NextResponse.json(
      { enabled },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (e) {
    console.error('[site-settings/ads]', e);
    return NextResponse.json(
      { enabled: true },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  }
}
