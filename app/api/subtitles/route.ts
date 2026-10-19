/**
 * Local subtitle proxy (ASS/SRT → WebVTT). Production 302s to the Worker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { vercelMediaOffloadUrl } from '@/lib/hls-proxy';
import { cachedRedirect } from '@/lib/http-cache';
import { ensureWebVtt } from '@/lib/utils/subtitle-scraper';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const VIDEO_RE = /\.(m3u8|ts|m4s|mp4|mkv|webm|jpg|jpeg|png|webp|gif)(\?|$)/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const offload = vercelMediaOffloadUrl('subtitles', request.url);
  if (offload) {
    return cachedRedirect(offload, 308, 86400);
  }

  const url = request.nextUrl.searchParams.get('url');
  const preferredReferer = request.nextUrl.searchParams.get('referer') || '';

  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  if (VIDEO_RE.test(url)) {
    return NextResponse.json({ error: 'Not a subtitle URL' }, { status: 400 });
  }

  const headerSets: Record<string, string>[] = [];
  if (preferredReferer) {
    try {
      headerSets.push({
        Referer: preferredReferer,
        Origin: new URL(preferredReferer).origin,
      });
    } catch {
      headerSets.push({ Referer: preferredReferer });
    }
  }
  headerSets.push(
    { Referer: 'https://megaplay.buzz/', Origin: 'https://megaplay.buzz' },
    { Referer: 'https://megacloud.blog/', Origin: 'https://megacloud.blog' },
    { Referer: 'https://hianime.to/', Origin: 'https://hianime.to' }
  );

  try {
    let response: Response | null = null;
    for (const extra of headerSets) {
      const attempt = await fetch(url, {
        headers: {
          ...extra,
          Accept: 'text/vtt,text/plain,*/*',
          'User-Agent': UA,
        },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      });
      if (attempt.ok) {
        response = attempt;
        break;
      }
      if (attempt.status !== 403 && attempt.status !== 429) break;
    }

    if (!response?.ok) {
      return NextResponse.json(
        { error: `Failed to fetch subtitle (${response?.status ?? 502})` },
        { status: response?.status === 403 ? 502 : response?.status ?? 502 }
      );
    }

    const raw = await response.text();
    if (raw.length > 2_000_000) {
      return NextResponse.json({ error: 'Subtitle too large' }, { status: 413 });
    }

    const vtt = ensureWebVtt(raw, url);
    return new NextResponse(vtt, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        ...CORS,
      },
    });
  } catch (error) {
    console.error('[Subtitles]', error);
    const timeout = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: timeout ? 'Subtitle fetch timeout' : 'Subtitle proxy failed' },
      { status: timeout ? 504 : 500 }
    );
  }
}
