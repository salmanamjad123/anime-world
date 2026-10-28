/**
 * Media proxy helpers — Megaplay / manga CDNs need Referer injection.
 *
 * Production: Cloudflare Worker (HLS + images + subtitles). Never Vercel, never Railway video.
 * Localhost: local streaming-api for HLS, Next /api/image and /api/subtitles.
 */

/** Hosts that must go through proxy (browser Origin is blocked) */
const PROXY_REQUIRED_HOST_RE =
  /imgnex\.|nexabloom\.|megaplay\.|megacloud\.|norami\.|shiora\.|mikora\.|akirax\.|^megap\.|cloudflarestream\./i;

/** Deployed Worker — production media egress. */
export const CLOUDFLARE_WORKER_ORIGIN =
  'https://anime-world-proxy.animevillage-proxy.workers.dev';

const DEFAULT_WORKER_PROXY = `${CLOUDFLARE_WORKER_ORIGIN}/proxy`;
const DEFAULT_WORKER_IMAGE = `${CLOUDFLARE_WORKER_ORIGIN}/image`;
const DEFAULT_WORKER_SUBTITLES = `${CLOUDFLARE_WORKER_ORIGIN}/subtitles`;

function isLocalHost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

function isCloudflareWorkerProxy(url: string): boolean {
  return url.includes('workers.dev') && url.includes('/proxy');
}

/** Localhost / 127.0.0.1 only. Live site and Vercel always use the Worker. */
function useLocalMediaProxy(): boolean {
  if (process.env.VERCEL) return false;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL || '';
  return isLocalHost(explicit);
}

/**
 * HLS proxy. Worker wins whenever NEXT_PUBLIC_PROXY_URL is workers.dev
 * (including localhost). Local streaming-api proxy is 429-prone.
 * Never animevillage.org/api/proxy. Never expose Railway in the client.
 */
export function getHlsProxyBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';

  if (explicit && isCloudflareWorkerProxy(explicit)) return explicit;

  if (useLocalMediaProxy()) {
    if (explicit && isLocalHost(explicit)) return explicit;
    return 'http://localhost:4000/api/v2/proxy';
  }

  return DEFAULT_WORKER_PROXY;
}

/** Image proxy. Production: Worker /image. Local: Next /api/image. */
export function getImageProxyBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';

  if (useLocalMediaProxy()) {
    return '/api/image';
  }

  if (explicit && isCloudflareWorkerProxy(explicit)) {
    return explicit.replace(/\/proxy\/?$/, '/image');
  }

  return DEFAULT_WORKER_IMAGE;
}

export function wrapHlsUrl(
  streamUrl: string,
  viaProxy: boolean,
  referer?: string
): string {
  if (!viaProxy) return streamUrl;
  const base = getHlsProxyBase().replace(/\/$/, '');
  const params = new URLSearchParams({ url: streamUrl });
  if (referer) params.set('referer', referer);
  return `${base}?${params.toString()}`;
}

/** On Vercel, leftover /api/proxy, /api/image, /api/subtitles must 302 to the Worker. */
export function vercelMediaOffloadUrl(
  kind: 'proxy' | 'image' | 'subtitles',
  requestUrl: string
): string | null {
  if (useLocalMediaProxy()) return null;

  const incoming = new URL(requestUrl);
  const destBase =
    kind === 'proxy'
      ? DEFAULT_WORKER_PROXY
      : kind === 'image'
        ? DEFAULT_WORKER_IMAGE
        : DEFAULT_WORKER_SUBTITLES;
  return `${destBase}${incoming.search}`;
}

function getSubtitleProxyBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';
  if (explicit && isCloudflareWorkerProxy(explicit)) {
    return explicit.replace(/\/proxy\/?$/, '/subtitles');
  }
  if (useLocalMediaProxy()) return '/api/subtitles';
  return DEFAULT_WORKER_SUBTITLES;
}

/** Production: Worker /subtitles (ASS/SRT → VTT). Localhost: Next /api/subtitles. */
export function wrapSubtitleUrl(subtitleUrl: string, referer?: string): string {
  if (!subtitleUrl.startsWith('http')) return subtitleUrl;
  const params = new URLSearchParams({ url: subtitleUrl });
  if (referer) params.set('referer', referer);
  return `${getSubtitleProxyBase()}?${params.toString()}`;
}

export function wrapImageProxyUrl(imageUrl: string, referer?: string): string {
  const base = getImageProxyBase().replace(/\/$/, '');
  const params = new URLSearchParams({ url: imageUrl });
  if (referer) params.set('referer', referer);
  return `${base}?${params.toString()}`;
}

export function isMediaProxyUrl(src: string): boolean {
  return (
    src.includes('/api/image?') ||
    src.includes('/api/subtitles?') ||
    src.includes('/subtitles?url=') ||
    src.includes('/image?url=') ||
    src.includes('/proxy?url=')
  );
}

export function initialHlsViaProxy(_streamUrl: string): boolean {
  return process.env.NEXT_PUBLIC_USE_PROXY === 'true' || !useLocalMediaProxy();
}

export function shouldPreferDirectHls(streamUrl: string): boolean {
  try {
    return !PROXY_REQUIRED_HOST_RE.test(new URL(streamUrl).hostname);
  } catch {
    return false;
  }
}

/** CDN hosts known to fail playback / proxy often — trigger refresh or embed */
export function isFragileCdnHost(streamUrl: string): boolean {
  try {
    const host = new URL(streamUrl).hostname.toLowerCase();
    return host.includes('nexabloom') || host.includes('pages.dev');
  } catch {
    return false;
  }
}
