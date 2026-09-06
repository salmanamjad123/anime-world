/** Local SVG — never depends on AniList or external CDNs */
export const ANIME_PLACEHOLDER = '/images/anime-placeholder.svg';

/** Scraped streaming CDNs — often blocked in browsers; proxy via /api/image */
const UNRELIABLE_IMAGE_HOSTS = new Set([
  'cdn.anipixcdn.co',
  'cdn.noitatnemucod.net',
  'gogocdn.net',
]);

export function isUnreliableImageCdn(url: unknown): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  try {
    return UNRELIABLE_IMAGE_HOSTS.has(new URL(normalized).hostname);
  } catch {
    return false;
  }
}

/** Serve through same-origin image proxy (adds Referer server-side). */
export function getProxiedImageUrl(url: string): string {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

/**
 * Best URL for <img> — proxy unreliable CDNs; keep AniList/MAL direct.
 */
export function getDisplayImageUrl(url: unknown): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return ANIME_PLACEHOLDER;
  if (isUnreliableImageCdn(normalized)) return getProxiedImageUrl(normalized);
  return normalized;
}

/**
 * Normalize scraped or API poster URLs for browser use.
 * Handles protocol-relative (`//cdn...`) and trims whitespace.
 */
export function normalizeImageUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  return undefined;
}

/** Resolve to a usable image URL, falling back to the local placeholder. */
export function resolveAnimeImageUrl(
  url: unknown,
  fallback: string = ANIME_PLACEHOLDER
): string {
  return normalizeImageUrl(url) ?? fallback;
}
