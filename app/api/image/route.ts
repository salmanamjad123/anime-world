/**
 * Image proxy — fetches hotlink-protected poster/banner URLs server-side.
 * GET /api/image?url=https://...
 *
 * Important: do NOT use Next fetch `next.revalidate` here — failed 403s get
 * cached by URL and poison later attempts with a correct Referer.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isImageProxyAllowed,
  normalizeImageUrl,
  getImageProxyReferers,
  isMangaDexChapterImageUrl,
  isMangaHereImageHost,
} from '@/lib/utils/image-url';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('url');
    const url = normalizeImageUrl(raw);
    const refererOverride = request.nextUrl.searchParams.get('referer');

    if (!url || !isImageProxyAllowed(url)) {
      return NextResponse.json({ error: 'Invalid or disallowed image URL' }, { status: 400 });
    }

    const referers = [
      ...(refererOverride ? [refererOverride] : []),
      ...getImageProxyReferers(url),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    let response: Response | null = null;
    for (const referer of referers) {
      try {
        const attempt = await fetch(url, {
          headers: {
            Referer: referer,
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': BROWSER_UA,
          },
          signal: AbortSignal.timeout(20_000),
          // Never cache upstream — a 403 with the wrong Referer would poison retries
          cache: 'no-store',
        });
        if (attempt.ok) {
          response = attempt;
          break;
        }
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
    // Some CDNs omit or send odd types; sniff jpeg/png from path if needed
    const typeOk =
      ALLOWED_TYPES.has(contentType) ||
      contentType === 'application/octet-stream' ||
      contentType === 'binary/octet-stream';
    if (!typeOk) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    const resolvedType = ALLOWED_TYPES.has(contentType)
      ? contentType
      : guessImageType(url) ?? 'image/jpeg';

    const cacheControl = isMangaDexChapterImageUrl(url)
      ? 'public, max-age=600, stale-while-revalidate=300'
      : isMangaHereImageHost(url)
        ? 'public, max-age=604800, stale-while-revalidate=86400'
        : 'public, max-age=86400, stale-while-revalidate=604800';

    if (response.body) {
      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': resolvedType,
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': resolvedType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Image Proxy]', error);
    return NextResponse.json({ error: 'Image proxy failed' }, { status: 500 });
  }
}

function guessImageType(url: string): string | null {
  const path = url.toLowerCase().split('?')[0] ?? '';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.avif')) return 'image/avif';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}
