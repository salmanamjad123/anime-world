import { NextResponse } from 'next/server';

/** Vercel + Cloudflare honor s-maxage. Browser can revalidate sooner. */
export function cacheControl(sMaxAge: number, swr = sMaxAge * 4): string {
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}

export function cacheHeaders(sMaxAge: number, swr = sMaxAge * 4): Record<string, string> {
  const value = cacheControl(sMaxAge, swr);
  return {
    'Cache-Control': value,
    'CDN-Cache-Control': value,
    'Vercel-CDN-Cache-Control': value,
    'Cloudflare-CDN-Cache-Control': value,
  };
}

export function cachedJson(
  data: unknown,
  sMaxAge = 120,
  init?: { status?: number; swr?: number }
) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: cacheHeaders(sMaxAge, init?.swr),
  });
}

export function uncachedJson(data: unknown, status = 500) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
