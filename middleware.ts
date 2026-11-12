import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Village Arena only (`feat/game-arena`).
 * Blocks anime/manga pages and catalog APIs so they never hit Vercel Functions.
 * `matcher` must be a static string/array (Next.js build requirement).
 */

function isAllowedPage(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/game')) return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/profile')) return true;
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }
  if (pathname.startsWith('/opengraph-image') || pathname.startsWith('/twitter-image')) {
    return true;
  }
  return false;
}

/** APIs the arena product actually needs (auth, admin, profile). Everything else 404s. */
function isAllowedApi(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname.startsWith('/api/admin')) return true;
  if (pathname.startsWith('/api/profile')) return true;
  if (pathname === '/api/health') return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (isAllowedApi(pathname)) return NextResponse.next();
    return NextResponse.json({ error: 'Not available on Village Arena' }, { status: 404 });
  }

  // Lobby lives at /
  if (pathname === '/game') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (isAllowedPage(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
