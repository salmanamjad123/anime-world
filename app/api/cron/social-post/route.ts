/**
 * Discord daily drafts are disabled on animevillage.my.
 * The .org site owns social posts. This route stays so an old cron
 * or a configured DISCORD_WEBHOOK_URL cannot publish from here.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextResponse } from 'next/server';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: 'Discord posts are disabled on animevillage.my',
  });
}
