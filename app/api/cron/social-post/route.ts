/**
 * Cron: Daily Instagram / TikTok draft → Discord webhook
 * Schedule: once per day (see vercel.json)
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextResponse } from 'next/server';
import { createDailySocialPost } from '@/lib/social/daily-post';
import { sendDailySocialPostToDiscord } from '@/lib/social/discord';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.DISCORD_WEBHOOK_URL) {
    return NextResponse.json(
      { error: 'DISCORD_WEBHOOK_URL is not configured' },
      { status: 500 }
    );
  }

  try {
    const post = await createDailySocialPost();
    await sendDailySocialPostToDiscord(post);

    return NextResponse.json({
      ok: true,
      animeId: post.animeId,
      title: post.title,
      pageUrl: post.pageUrl,
    });
  } catch (error) {
    console.error('[Cron] social-post failed:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
