/**
 * HLS proxy helpers.
 *
 * - nexabloom: often 403 in browser AND on proxies → prefer other CDNs upstream
 * - imgnex / most hosts: need Megaplay Referer → must go through proxy
 */

/** Hosts that bot-block most server proxies AND reject our page Origin — avoid direct */
const PROXY_REQUIRED_HOST_RE =
  /imgnex\.|nexabloom\.|megaplay\.|megacloud\./i;

/** Prefer skipping broken CF worker in local/dev when HIANIME is localhost */
export function getHlsProxyBase(): string {
  const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
  const explicit = process.env.NEXT_PUBLIC_PROXY_URL;

  // Local streaming-api: always use its proxy (injects Megaplay Referer)
  if (hianimeUrl.includes('localhost') || hianimeUrl.includes('127.0.0.1')) {
    return (
      explicit ||
      `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy`
    );
  }

  if (explicit) return explicit;

  if (hianimeUrl.includes('railway')) {
    return `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy`;
  }

  return '/api/proxy';
}

export function wrapHlsUrl(streamUrl: string, viaProxy: boolean): string {
  if (!viaProxy) return streamUrl;
  const base = getHlsProxyBase().replace(/\/$/, '');
  return `${base}?url=${encodeURIComponent(streamUrl)}`;
}

/**
 * When USE_PROXY is on, almost always proxy — CDN needs Megaplay Referer.
 * Only skip proxy if explicitly disabled.
 */
export function initialHlsViaProxy(_streamUrl: string): boolean {
  return process.env.NEXT_PUBLIC_USE_PROXY === 'true';
}

export function shouldPreferDirectHls(streamUrl: string): boolean {
  // Direct from our origin fails (no Megaplay Referer) for these CDNs
  try {
    return !PROXY_REQUIRED_HOST_RE.test(new URL(streamUrl).hostname);
  } catch {
    return false;
  }
}
