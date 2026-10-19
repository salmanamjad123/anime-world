/**
 * A-Z List API Route
 * Always 200 with titles so Cloudflare cannot cache a 500/504 empty page.
 */

import { NextRequest } from 'next/server';
import { cachedJson } from '@/lib/http-cache';
import { getAzListForLetter } from '@/lib/api/az-list';

export const maxDuration = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  const { letter } = await params;
  const sortOption = decodeURIComponent(letter || 'a');
  const page = parseInt(new URL(request.url).searchParams.get('page') || '1', 10);
  const data = await getAzListForLetter(sortOption, page);
  return cachedJson(data, 120);
}
