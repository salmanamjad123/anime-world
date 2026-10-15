/**
 * Media proxy helpers — Megaplay / manga CDNs need Referer injection.
 *
 * Production: Cloudflare Worker (HLS + images). Never Vercel, never Railway video.
 * Localhost: local streaming-api for HLS, Next /api/image for images.
 */

/** Hosts that must go through proxy (browser Origin is blocked) */
const PROXY_REQUIRED_HOST_RE =
  /imgnex\.|nexabloom\.|megaplay\.|megacloud\.|norami\.|shiora\.|mikora\.|akirax\.|^megap\./i;

/** Deployed Worker — production media egress. */
export const CLOUDFLARE_WORKER_ORIGIN =
  'https://anime-world-proxy.animevillage-proxy.workers.dev';

const DEFAULT_WORKER_PROXY = `${CLOUDFLARE_WORKER_ORIGIN}/proxy`;
const DEFAULT_WORKER_IMAGE = `${CLOUDFLARE_WORKER_ORIGIN}/image`;

function isLocalHost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

function isCloudflareWorkerProxy(url: string): boolean {
  return url.includes('workers.dev') && url.includes('/proxy');
}

/**
 * HLS / subtitle proxy. Production always uses the Cloudflare Worker.
 * Localhost uses streaming-api. Never animevillage.org/api/proxy.
 */
export function getHlsProxyBase(): string {
  const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';

  if (isLocalHost(hianimeUrl) || isLocalHost(explicit)) {
    if (explicit && isLocalHost(explicit)) return explicit;
    if (isLocalHost(hianimeUrl)) {
      return `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy`;
    }
  }

  if (explicit && isCloudflareWorkerProxy(explicit)) return explicit;
  return DEFAULT_WORKER_PROXY;
}

/** Image proxy. Production: Worker /image. Local: Next /api/image. */
export function getImageProxyBase(): string {
  const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';

  if (isLocalHost(hianimeUrl) || isLocalHost(explicit)) {
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

/** Production leftover /api/proxy|/api/image hits → Worker (no Vercel media egress). */
export function vercelMediaOffloadUrl(
  kind: 'proxy' | 'image',
  requestUrl: string
): string | null {
  const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL || '';
  if (isLocalHost(hianimeUrl) || isLocalHost(explicit)) return null;

  const incoming = new URL(requestUrl);
  const destBase =
    kind === 'proxy' ? getHlsProxyBase() : getImageProxyBase();
  return `${destBase.replace(/\/$/, '')}${incoming.search}`;
}

export function wrapSubtitleUrl(subtitleUrl: string, referer?: string): string {
  if (!subtitleUrl.startsWith('http')) return subtitleUrl;
  const base = getHlsProxyBase().replace(/\/$/, '');
  const params = new URLSearchParams({ url: subtitleUrl });
  if (referer) params.set('referer', referer);
  return `${base}?${params.toString()}`;
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
    src.includes('/image?url=') ||
    src.includes('/proxy?url=')
  );
}

export function initialHlsViaProxy(_streamUrl: string): boolean {
  return process.env.NEXT_PUBLIC_USE_PROXY === 'true';
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
    return (
      host.includes('nexabloom') ||
      host.includes('pages.dev') ||
      host.endsWith('cloudflarestream.com')
    );
  } catch {
    return false;
  }
}
