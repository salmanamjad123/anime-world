/**
 * HLS proxy helpers — Megaplay CDNs require Referer injection via proxy.
 *
 * Production: honor NEXT_PUBLIC_PROXY_URL (Cloudflare Worker) so video egress
 * stays off Railway. Railway streaming-api is only the catalog / sources API.
 * Localhost uses local streaming-api.
 */

/** Hosts that must go through proxy (browser Origin is blocked) */
const PROXY_REQUIRED_HOST_RE =
  /imgnex\.|nexabloom\.|megaplay\.|megacloud\.|norami\.|shiora\.|mikora\.|akirax\.|^megap\./i;

function railwayProxyFromHianime(hianimeUrl: string): string | null {
  if (!hianimeUrl.includes('railway.app')) return null;
  return `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy`;
}

function isLocalHost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Resolve proxy base URL for HLS.
 * Order: localhost streaming-api → explicit NEXT_PUBLIC_PROXY_URL → Railway (from HIANIME) → /api/proxy
 */
export function getHlsProxyBase(): string {
  const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL?.replace(/\/$/, '') || '';

  if (isLocalHost(hianimeUrl)) {
    if (explicit && isLocalHost(explicit)) return explicit;
    return `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy`;
  }

  if (explicit) return explicit;

  return railwayProxyFromHianime(hianimeUrl) || '/api/proxy';
}

export function wrapHlsUrl(streamUrl: string, viaProxy: boolean): string {
  if (!viaProxy) return streamUrl;
  const base = getHlsProxyBase().replace(/\/$/, '');
  return `${base}?url=${encodeURIComponent(streamUrl)}`;
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
      host.includes('pages.dev') || // CF Pages mirrors used as dead ends
      // bare cloudflarestream / r2 public often 403 without signed cookies
      host.endsWith('cloudflarestream.com')
    );
  } catch {
    return false;
  }
}
