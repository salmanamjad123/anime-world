/**
 * Video Proxy Route (Production Optimized)
 * Proxies HLS streams to bypass CORS restrictions
 * Features: Rate limiting, caching, compression, retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, getClientIdentifier } from '@/lib/utils/rate-limiter';
import { retry, isRetryableError } from '@/lib/utils/retry';

// Enable caching for video segments (not playlists)
const ENABLE_CACHE = process.env.ENABLE_PROXY_CACHE === 'true';
const CACHE_MAX_AGE = parseInt(process.env.PROXY_CACHE_MAX_AGE || '3600');

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    if (process.env.ENABLE_RATE_LIMITING === 'true') {
      const clientId = getClientIdentifier(request);
      const { allowed, remaining, resetTime } = rateLimiter.check(clientId);
      
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(resetTime).toISOString(),
              'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
            }
          }
        );
      }
    }

    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Fetch with retry logic
    const response = await retry(
      () => fetch(url, {
        headers: {
          'Referer': 'https://megacloud.blog/',
          'Origin': 'https://hianime.to',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(30000), // 30s timeout
      }),
      {
        maxAttempts: 2,
        delayMs: 500,
        shouldRetry: (error) => isRetryableError(error),
      }
    );

    if (!response.ok) {
      console.error('[Proxy Error] Failed to fetch:', url, response.status);
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
          // Short cache for playlists (they can change)
          'Cache-Control': ENABLE_CACHE ? 'public, max-age=30' : 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } else {
      // For non-playlist content (video segments), return as-is
      const data = await response.arrayBuffer();
      
      // Determine cache duration based on content type
      const isVideoSegment = url.includes('.ts') || url.includes('.m4s');
      const cacheControl = ENABLE_CACHE && isVideoSegment
        ? `public, max-age=${CACHE_MAX_AGE}, immutable`
        : 'no-cache';
      
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': cacheControl,
          'X-Content-Type-Options': 'nosniff',
          // Add content length
          'Content-Length': data.byteLength.toString(),
        },
      });
    }
  } catch (error: any) {
    console.error('[Proxy Error]:', error.message, error.stack);
    
    // Provide helpful error messages
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout. The video source is too slow.' },
        { status: 504 }
      );
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Cannot reach video source. It may be down.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Proxy request failed. Please try again.' },
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
