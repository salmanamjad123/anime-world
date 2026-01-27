/**
 * Video Proxy Route
 * Proxies HLS streams to bypass CORS restrictions
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Fetch the content with appropriate headers
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://megacloud.blog/',
        'Origin': 'https://hianime.to',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Check if this is an m3u8 playlist
    const isM3u8 = url.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL');

    if (isM3u8) {
      // For m3u8 playlists, rewrite relative URLs to go through proxy
      const text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      // Rewrite all relative URLs in the playlist
      const rewrittenPlaylist = text
        .split('\n')
        .map(line => {
          line = line.trim();
          
          // Skip empty lines, comments, and tags
          if (!line || line.startsWith('#')) {
            return line;
          }
          
          // This is a URL line - rewrite it
          let targetUrl = line;
          
          // Convert relative URLs to absolute
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = baseUrl + targetUrl;
          }
          
          // Proxy the URL
          return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
        })
        .join('\n');

      return new NextResponse(rewrittenPlaylist, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // For non-playlist content (video segments), return as-is
      const data = await response.arrayBuffer();
      
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (error: any) {
    console.error('[Proxy Error]:', error.message);
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
