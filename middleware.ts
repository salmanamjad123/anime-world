import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * `/watch/{id}/{slug}?ep=123` must not be a unique uncached HTML key.
 * Encode `?ep=` into the path (same as in-app links) so Cloudflare can HIT
 * `/watch/:path*` without a query-string cache bust.
 */
export function middleware(request: NextRequest) {
  const ep = request.nextUrl.searchParams.get('ep');
  if (!ep) return NextResponse.next();

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'watch') return NextResponse.next();

  const animeId = segments[1];
  const decodedEpisode = decodeURIComponent(segments[2]);
  const url = request.nextUrl.clone();
  url.searchParams.delete('ep');

  if (decodedEpisode.includes('?ep=')) {
    return NextResponse.redirect(url, 308);
  }

  url.pathname = `/watch/${animeId}/${encodeURIComponent(`${decodedEpisode}?ep=${ep}`)}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/watch/:animeId/:episodeId*'],
};
