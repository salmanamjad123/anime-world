/**
 * A-Z List API Route
 * GET /api/azlist/[letter] - Get anime list by letter (0-9, A-Z, other)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHiAnimeAZList } from '@/lib/api/hianime';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  try {
    const { letter } = await params;
    const sortOption = decodeURIComponent(letter || '');

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    const data = await getHiAnimeAZList(sortOption, page);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Error] /api/azlist/[letter]:', error?.message);
    return NextResponse.json(
      {
        error: 'Failed to fetch A-Z list',
        message: error?.message,
      },
      { status: 500 }
    );
  }
}
