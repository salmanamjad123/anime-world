import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cachedRedirect } from '@/lib/http-cache';

/**
 * `/watch/{id}/{slug}?ep=123` must not be a unique uncached HTML key.
 * Encode `?ep=` into the path (same as in-app links) so Cloudflare can HIT
 * `/watch/:path*` without a query-string cache bust.
 */
const WATCH_HTML_CDN = 'public, s-maxage=60, stale-while-revalidate=300';

function withWatchHtmlCache(response: NextResponse) {
  response.headers.set('Cache-Control', WATCH_HTML_CDN);
  response.headers.set('CDN-Cache-Control', WATCH_HTML_CDN);
  response.headers.set('Vercel-CDN-Cache-Control', WATCH_HTML_CDN);
  response.headers.set('Cloudflare-CDN-Cache-Control', WATCH_HTML_CDN);
  return response;
}

export function middleware(request: NextRequest) {
  const ep = request.nextUrl.searchParams.get('ep');
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'watch') {
    return NextResponse.next();
  }

  if (!ep) return withWatchHtmlCache(NextResponse.next());

  const animeId = segments[1];
  const decodedEpisode = decodeURIComponent(segments[2]);
  const url = request.nextUrl.clone();
  url.searchParams.delete('ep');

  if (decodedEpisode.includes('?ep=')) {
    return cachedRedirect(url, 308, 86400);
  }

  url.pathname = `/watch/${animeId}/${encodeURIComponent(`${decodedEpisode}?ep=${ep}`)}`;
  return cachedRedirect(url, 308, 86400);
}

export const config = {
  matcher: ['/watch/:animeId/:episodeId*'],
};
