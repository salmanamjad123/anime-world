/**
 * Cloudflare Worker: HLS, subtitle, and image proxy for anime-world
 *
 * GET /proxy?url=<encoded-url>[&referer=]
 * GET /image?url=<encoded-url>[&referer=]
 * GET /subtitles?url=<encoded-url>[&referer=]  ASS/SRT → WebVTT
 *
 * Video + manga egress stays on Cloudflare. Railway is catalog JSON only.
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

const HLS_HEADER_SETS = [
  { Referer: 'https://megaplay.buzz/', Origin: 'https://megaplay.buzz' },
  { Referer: 'https://megaplay.buzz/' },
  { Referer: 'https://megacloud.blog/', Origin: 'https://megacloud.blog' },
  { Referer: 'https://anikototv.to/', Origin: 'https://anikototv.to' },
  { Referer: 'https://hianime.to/', Origin: 'https://hianime.to' },
  { Referer: 'https://megap.norami.top/', Origin: 'https://megap.norami.top' },
  { Referer: 'https://ncdn.imgnex.top/', Origin: 'https://ncdn.imgnex.top' },
  { Referer: 'https://bb.akirax.buzz/', Origin: 'https://bb.akirax.buzz' },
  {},
];

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'application/octet-stream',
  'binary/octet-stream',
]);

const RETRY_STATUSES = new Set([403, 429, 500, 502, 503]);

function withUa(headers, accept) {
  return {
    ...headers,
    Accept: accept || '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': UA,
  };
}

function isBlockedTarget(targetUrl) {
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return true;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host.endsWith('.local')) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

function parseTarget(raw) {
  if (!raw) return null;
  try {
    const targetUrl = decodeURIComponent(raw);
    // eslint-disable-next-line no-new
    new URL(targetUrl);
    if (isBlockedTarget(targetUrl)) return null;
    return targetUrl;
  } catch {
    return null;
  }
}

function imageReferers(targetUrl, override) {
  const list = [];
  if (override) list.push(override);
  try {
    const { hostname, origin } = new URL(targetUrl);
    const h = hostname.toLowerCase();
    if (h.includes('mangadex')) {
      list.push('https://mangadex.org/', 'https://www.mangadex.org/');
    } else if (h.includes('mangahere')) {
      list.push('https://www.mangahere.cc/', 'http://www.mangahere.cc/', origin + '/');
    } else if (
      h.includes('readdetectiveconan') ||
      h.includes('mangapill') ||
      h.includes('mangap.')
    ) {
      list.push('https://mangapill.com/', 'https://www.mangapill.com/', origin + '/');
    } else if (h.includes('mangareader') || h.includes('mrserver')) {
      list.push('https://mangareader.to/', origin + '/');
    } else if (h.includes('mangapark') || h.includes('parkmanga')) {
      list.push('https://mangapark.net/', origin + '/');
    } else if (
      h.includes('mangasee') ||
      h.includes('asuracomic') ||
      h.includes('asurascans')
    ) {
      list.push('https://mangasee123.com/', 'https://asuracomic.net/', origin + '/');
    } else if (
      h.includes('mangakakalot') ||
      h.includes('manganato') ||
      h.includes('mkklcdnv6')
    ) {
      list.push(
        'https://www.mangakakalot.gg/',
        'https://chapmanganato.to/',
        origin + '/'
      );
    } else {
      list.push(
        'https://mangapark.net/',
        'https://mangasee123.com/',
        'https://mangapill.com/',
        'https://www.mangahere.cc/',
        origin + '/'
      );
    }
  } catch {
    list.push('https://www.mangahere.cc/', 'https://mangadex.org/');
  }
  return [...new Set(list.filter(Boolean))];
}

async function fetchWithHeaderSets(targetUrl, headerSets, rangeHeader, accept) {
  let last = null;
  for (const set of headerSets) {
    const headers = withUa(set, accept);
    if (rangeHeader) headers.Range = rangeHeader;
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });
      last = res;
      if (res.ok || res.status === 206) return res;
      if (!RETRY_STATUSES.has(res.status)) return res;
    } catch (e) {
      last = e;
    }
  }
  if (last instanceof Response) return last;
  throw last || new Error('Upstream fetch failed');
}

function rewriteM3u8(text, targetUrl, proxyBase, referer) {
  const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

  const absUrl = (u) => {
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    try {
      return new URL(u, base).href;
    } catch {
      return base + u;
    }
  };

  const viaProxy = (u) => {
    const params = new URLSearchParams({ url: absUrl(u) });
    if (referer) params.set('referer', referer);
    return `${proxyBase}?${params.toString()}`;
  };

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

function guessImageType(url) {
  const path = url.toLowerCase().split('?')[0] ?? '';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.avif')) return 'image/avif';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

async function handleProxy(request, url) {
  const targetUrl = parseTarget(url.searchParams.get('url'));
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Invalid or missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const preferredReferer = url.searchParams.get('referer') || '';
  const headerSets = preferredReferer
    ? [{ Referer: preferredReferer }, ...HLS_HEADER_SETS]
    : HLS_HEADER_SETS;

  const proxyBase = `${url.origin}/proxy`;
  const rangeHeader = request.headers.get('Range');
  const response = await fetchWithHeaderSets(
    targetUrl,
    headerSets,
    rangeHeader
  );

  if (!response.ok && response.status !== 206) {
    return new Response(JSON.stringify({ error: `Upstream ${response.status}` }), {
      status: response.status === 403 ? 502 : response.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
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
    const rewritten = rewriteM3u8(
      text,
      targetUrl,
      proxyBase,
      preferredReferer || 'https://megaplay.buzz/'
    );
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=60',
        ...CORS,
      },
    });
  }

  const disguisedSegment =
    /seg-/i.test(targetUrl) ||
    /\.(jpg|jpeg|png|html|js|css|txt|webp|ico|gif)(\?|$)/i.test(targetUrl);
  const outHeaders = {
    'Content-Type': disguisedSegment ? 'video/mp2t' : contentType,
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
}

function convertAssTime(assTime) {
  const parts = String(assTime || '').split(':');
  if (parts.length < 3) return '00:00:00.000';
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  const secondsParts = parts[2].split('.');
  const seconds = (secondsParts[0] || '00').padStart(2, '0');
  const milliseconds = (secondsParts[1] || '00').padEnd(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function convertAssToVtt(assContent) {
  let vtt = 'WEBVTT\n\n';
  for (const line of String(assContent).split('\n')) {
    if (!line.startsWith('Dialogue:')) continue;
    const parts = line.split(',');
    if (parts.length < 10) continue;
    const start = convertAssTime(parts[1]);
    const end = convertAssTime(parts[2]);
    const text = parts
      .slice(9)
      .join(',')
      .replace(/\\N/g, '\n')
      .replace(/\{[^}]*\}/g, '')
      .trim();
    if (!text) continue;
    vtt += `${start} --> ${end}\n${text}\n\n`;
  }
  return vtt;
}

function convertSrtToVtt(srtContent) {
  return (
    'WEBVTT\n\n' +
    String(srtContent).replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

function ensureWebVtt(content, urlHint = '') {
  const trimmed = String(content || '').replace(/^\uFEFF/, '');
  const lowerUrl = String(urlHint).toLowerCase();
  if (
    lowerUrl.includes('.ass') ||
    lowerUrl.includes('.ssa') ||
    trimmed.includes('[Script Info]') ||
    /Dialogue:/m.test(trimmed)
  ) {
    return convertAssToVtt(trimmed);
  }
  if (
    lowerUrl.includes('.srt') ||
    (trimmed.includes('-->') &&
      trimmed.includes(',') &&
      !trimmed.trimStart().startsWith('WEBVTT'))
  ) {
    return convertSrtToVtt(trimmed);
  }
  if (trimmed.trimStart().startsWith('WEBVTT')) return trimmed;
  if (trimmed.includes('-->')) return convertSrtToVtt(trimmed);
  return trimmed;
}

const SUBTITLE_VIDEO_RE = /\.(m3u8|ts|m4s|mp4|mkv|webm|jpg|jpeg|png|webp|gif)(\?|$)/i;

async function handleSubtitles(request, url) {
  const targetUrl = parseTarget(url.searchParams.get('url'));
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Invalid or missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
  if (SUBTITLE_VIDEO_RE.test(targetUrl)) {
    return new Response(JSON.stringify({ error: 'Not a subtitle URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const preferredReferer = url.searchParams.get('referer') || '';
  const headerSets = [];
  if (preferredReferer) {
    try {
      headerSets.push({
        Referer: preferredReferer,
        Origin: new URL(preferredReferer).origin,
      });
    } catch {
      headerSets.push({ Referer: preferredReferer });
    }
  }
  headerSets.push(
    { Referer: 'https://megaplay.buzz/', Origin: 'https://megaplay.buzz' },
    { Referer: 'https://megacloud.blog/', Origin: 'https://megacloud.blog' },
    { Referer: 'https://hianime.to/', Origin: 'https://hianime.to' }
  );

  const response = await fetchWithHeaderSets(
    targetUrl,
    headerSets,
    null,
    'text/vtt,text/plain,*/*'
  );
  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream ${response.status}` }),
      {
        status: response.status === 403 ? 502 : response.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      }
    );
  }

  const raw = await response.text();
  if (raw.length > 2_000_000) {
    return new Response(JSON.stringify({ error: 'Subtitle too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const vtt = ensureWebVtt(raw, targetUrl);
  return new Response(vtt, {
    status: 200,
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...CORS,
    },
  });
}

async function handleImage(request, url) {
  const targetUrl = parseTarget(url.searchParams.get('url'));
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Invalid or missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const override = url.searchParams.get('referer') || '';
  const headerSets = imageReferers(targetUrl, override).map((Referer) => ({
    Referer,
  }));

  const response = await fetchWithHeaderSets(
    targetUrl,
    headerSets,
    null,
    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  );

  if (!response.ok) {
    return new Response(JSON.stringify({ error: `Upstream ${response.status}` }), {
      status: response.status === 403 ? 502 : response.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() || '';
  const typeOk = !contentType || IMAGE_TYPES.has(contentType);
  if (!typeOk) {
    return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const resolvedType = IMAGE_TYPES.has(contentType) && contentType.startsWith('image/')
    ? contentType
    : guessImageType(targetUrl);

  const host = new URL(targetUrl).hostname.toLowerCase();
  const cacheControl = host.includes('mangadex')
    ? 'public, max-age=600, stale-while-revalidate=300'
    : host.includes('mangahere')
      ? 'public, max-age=604800, stale-while-revalidate=86400'
      : 'public, max-age=86400, stale-while-revalidate=604800';

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': resolvedType,
      'Cache-Control': cacheControl,
      ...CORS,
    },
  });
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

    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'anime-world-proxy',
          usage: {
            hls: 'GET /proxy?url=<encoded-https-url>',
            image: 'GET /image?url=<encoded-https-url>',
            subtitles: 'GET /subtitles?url=<encoded-https-url>',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS },
        }
      );
    }

    const path = url.pathname.replace(/\/$/, '') || '/proxy';

    try {
      if (path.endsWith('/image')) return await handleImage(request, url);
      if (path.endsWith('/subtitles')) return await handleSubtitles(request, url);
      if (path.endsWith('/proxy')) return await handleProxy(request, url);
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e?.message || e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Not found. Use /proxy?url=, /image?url=, or /subtitles?url=',
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS },
      }
    );
  },
};
