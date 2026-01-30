/**
 * Cloudflare Worker: HLS/Video proxy for anime-world
 * Same API as Next.js /api/proxy: GET /proxy?url=<encoded-url>
 * Tries embedding-site headers first (hianime.to), then target-origin on 403 retry.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const EMBED_REFERER = 'https://hianime.to/';
const EMBED_ORIGIN = 'https://hianime.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function headersEmbed() {
  return {
    'User-Agent': UA,
    'Referer': EMBED_REFERER,
    'Origin': EMBED_ORIGIN,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

function headersForTarget(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const origin = `${u.protocol}//${u.host}`;
    return {
      'User-Agent': UA,
      'Referer': origin + '/',
      'Origin': origin,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  } catch {
    return headersEmbed();
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    const path = url.pathname.replace(/\/$/, '') || '/proxy';
    const proxyBase = `${url.origin}${path}`;

    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    try {
      // Try embedding-site headers first (hianime.to) - many CDNs expect this
      let response = await fetch(targetUrl, {
        method: 'GET',
        headers: headersEmbed(),
        cf: { cacheTtl: 0 },
      });
      // On 403, retry once with target-origin Referer/Origin
      if (response.status === 403) {
        response = await fetch(targetUrl, {
          method: 'GET',
          headers: headersForTarget(targetUrl),
          cf: { cacheTtl: 0 },
        });
      }
      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Upstream: ${response.statusText}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const isM3u8 =
        targetUrl.includes('.m3u8') ||
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('mpegurl');

      if (isM3u8) {
        const text = await response.text();
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const rewritten = text
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            let segmentUrl = trimmed;
            if (!segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
              segmentUrl = baseUrl + segmentUrl;
            }
            return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}`;
          })
          .join('\n');

        return new Response(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            ...CORS,
          },
        });
      }

      const body = await response.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          ...CORS,
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e.message || e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  },
};
