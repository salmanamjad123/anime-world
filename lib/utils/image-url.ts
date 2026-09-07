/** Local SVG — never depends on AniList or external CDNs */
export const ANIME_PLACEHOLDER = '/images/anime-placeholder.svg';

/** Scraped streaming CDNs — often blocked in browsers; proxy via /api/image */
const UNRELIABLE_IMAGE_HOSTS = new Set([
  'cdn.anipixcdn.co',
  'cdn.noitatnemucod.net',
  'gogocdn.net',
]);

/** Hosts that should load directly (no proxy) */
const DIRECT_IMAGE_HOSTS = new Set([
  's4.anilist.co',
  'res.cloudinary.com',
  'firebasestorage.googleapis.com',
  'lh3.googleusercontent.com',
  'cdn.myanimelist.net',
]);

/** MangaDex covers — proxy without Referer */
const MANGADEX_COVER_HOSTS = new Set(['uploads.mangadex.org']);

function isMangaDexImageHost(hostname: string): boolean {
  if (MANGADEX_COVER_HOSTS.has(hostname)) return true;
  if (hostname.endsWith('.mangadex.network')) return true;
  if (hostname.endsWith('.mangadex.org') && hostname !== 'api.mangadex.org') return true;
  return false;
}

/** Poster/banner CDNs for anime + MangaDex covers (SafeImage) */
export function isUnreliableImageCdn(url: unknown): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  try {
    const hostname = new URL(normalized).hostname;
    return UNRELIABLE_IMAGE_HOSTS.has(hostname) || MANGADEX_COVER_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

/** Chapter pages + hotlinked manga images allowed through /api/image */
export function isImageProxyAllowed(url: unknown): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized?.startsWith('https://')) return false;
  try {
    const { hostname } = new URL(normalized);
    if (DIRECT_IMAGE_HOSTS.has(hostname)) return false;
    if (UNRELIABLE_IMAGE_HOSTS.has(hostname)) return true;
    if (isMangaDexImageHost(hostname)) return true;
    // Consumet / scraper chapter images — proxy external https
    return hostname.includes('.');
  } catch {
    return false;
  }
}

export function isMangaDexChapterImageUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname.endsWith('.mangadex.network') ||
      (hostname.endsWith('.mangadex.org') &&
        hostname !== 'uploads.mangadex.org' &&
        (pathname.includes('/data/') || pathname.includes('/data-saver/')))
    );
  } catch {
    return false;
  }
}

export function getImageProxyReferers(url: string): string[] {
  try {
    const { hostname, origin } = new URL(url);
    if (isMangaDexImageHost(hostname)) {
      return ['https://mangadex.org/', 'https://www.mangadex.org/'];
    }
    return [origin + '/', 'https://mangadex.org/', 'https://hianime.to/'];
  } catch {
    /* fall through */
  }
  return [
    'https://mangadex.org/',
    'https://hianime.to/',
    'https://megaplay.buzz/',
    'https://megacloud.blog/',
  ];
}

/** Serve through same-origin image proxy (adds Referer server-side). */
export function getProxiedImageUrl(url: string): string {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

/** Manga chapter page — always proxy hotlinked CDN URLs for reliable production loads */
export function getMangaPageImageUrl(url: unknown): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return ANIME_PLACEHOLDER;
  if (isImageProxyAllowed(normalized)) return getProxiedImageUrl(normalized);
  return normalized;
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
