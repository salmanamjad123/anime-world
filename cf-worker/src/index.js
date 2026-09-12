/**
 * Cloudflare Worker: HLS / subtitle proxy for anime-world
 *
 * GET /proxy?url=<encoded-url>
 *
 * Moves video egress off Railway (API stays on Railway).
 * Tries Megaplay / Megacloud / Anikoto referers so CDN segments work.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
  'Access-Control-Expose-Headers':
    'Content-Length, Content-Range, Accept-Ranges',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADER_SETS = [
  {
    Referer: 'https://megaplay.buzz/',
    Origin: 'https://megaplay.buzz',
  },
  {
    Referer: 'https://megaplay.buzz/',
  },
  {
    Referer: 'https://megacloud.blog/',
    Origin: 'https://megacloud.blog',
  },
  {
    Referer: 'https://anikototv.to/',
    Origin: 'https://anikototv.to',
  },
  {
    Referer: 'https://hianime.to/',
    Origin: 'https://hianime.to',
  },
  {},
];

function withUa(headers) {
  return {
    ...headers,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': UA,
  };
}

async function fetchUpstream(targetUrl, rangeHeader) {
  let last = null;
  for (const set of HEADER_SETS) {
    const headers = withUa(set);
    if (rangeHeader) headers.Range = rangeHeader;
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });
      last = res;
      if (res.ok || res.status === 206) return res;
      if (res.status !== 403) return res;
    } catch (e) {
      last = e;
    }
  }
  if (last instanceof Response) return last;
  throw last || new Error('Upstream fetch failed');
}

function rewriteM3u8(text, targetUrl, proxyBase) {
  const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

  const absUrl = (u) => {
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    try {
      return new URL(u, base).href;
    } catch {
      return base + u;
    }
  };

  const viaProxy = (u) => `${proxyBase}?url=${encodeURIComponent(absUrl(u))}`;

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${viaProxy(u)}"`);
      }

      return viaProxy(trimmed);
    })
    .join('\n');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    // Health / info
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'anime-world-proxy',
          usage: 'GET /proxy?url=<encoded-https-url>',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS },
        }
      );
    }

    const path = url.pathname.replace(/\/$/, '') || '/proxy';
    if (!path.endsWith('/proxy') && path !== '/proxy') {
      return new Response(JSON.stringify({ error: 'Not found. Use /proxy?url=' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Workers are always HTTPS publicly — never rewrite as http://
    const proxyBase = `${url.origin}/proxy`;

    let targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    try {
      targetUrl = decodeURIComponent(targetUrl);
      // eslint-disable-next-line no-new
      new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    try {
      const rangeHeader = request.headers.get('Range');
      const response = await fetchUpstream(targetUrl, rangeHeader);

      if (!response.ok && response.status !== 206) {
        return new Response(
          JSON.stringify({ error: `Upstream ${response.status}` }),
          {
            status: response.status === 403 ? 502 : response.status,
            headers: { 'Content-Type': 'application/json', ...CORS },
          }
        );
      }

      const contentType =
        response.headers.get('content-type') || 'application/octet-stream';
      const isM3u8 =
        targetUrl.includes('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegURL');

      if (isM3u8) {
        const text = await response.text();
        const rewritten = rewriteM3u8(text, targetUrl, proxyBase);
        return new Response(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'public, max-age=60',
            ...CORS,
          },
        });
      }

      // Stream segments / VTT (avoid buffering whole video in Worker memory)
      const outHeaders = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        ...CORS,
      };
      const cl = response.headers.get('content-length');
      const cr = response.headers.get('content-range');
      const ar = response.headers.get('accept-ranges');
      if (cl) outHeaders['Content-Length'] = cl;
      if (cr) outHeaders['Content-Range'] = cr;
      if (ar) outHeaders['Accept-Ranges'] = ar;

      return new Response(response.body, {
        status: response.status,
        headers: outHeaders,
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e?.message || e) }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...CORS },
        }
      );
    }
  },
};
