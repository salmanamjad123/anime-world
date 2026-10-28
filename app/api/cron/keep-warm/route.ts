/**
 * Cron: Keep HiAnime API warm on Railway
 * Runs every 5 min to prevent cold starts
 */

import { NextResponse } from 'next/server';
import { HIANIME_API_URL } from '@/lib/hianime-url';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use /health (lightweight) - /home scrapes and can timeout
    const res = await fetch(`${HIANIME_API_URL}/health`, {
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      message: res.ok ? 'HiAnime warmed' : 'HiAnime returned error',
    });
  } catch (error) {
    console.error('[Cron] Keep-warm failed:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
