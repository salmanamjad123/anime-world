/**
 * Image proxy — fetches hotlink-protected poster/banner URLs server-side.
 * GET /api/image?url=https://cdn.anipixcdn.co/...
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUnreliableImageCdn, normalizeImageUrl, getImageProxyReferers } from '@/lib/utils/image-url';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('url');
    const url = normalizeImageUrl(raw);

    if (!url || !isUnreliableImageCdn(url)) {
      return NextResponse.json({ error: 'Invalid or disallowed image URL' }, { status: 400 });
    }

    const referers = getImageProxyReferers(url);

    let response: Response | null = null;
    for (const referer of referers) {
      try {
        response = await fetch(url, {
          headers: {
            Referer: referer,
            Origin: referer.replace(/\/$/, ''),
            Accept: 'image/*,*/*',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (response.ok) break;
      } catch {
        /* try next referer */
      }
    }

    if (!response?.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response?.status ?? 502 }
      );
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg';
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Image Proxy]', error);
    return NextResponse.json({ error: 'Image proxy failed' }, { status: 500 });
  }
}
