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

/** MangaHere CDN requires Referer: mangahere.cc — browsers cannot set that */
export function isMangaHereImageHost(url: string): boolean {
  try {
    return new URL(url).hostname.includes('mangahere');
  } catch {
    return false;
  }
}

/**
 * Hosts that 403 without a site-specific Referer.
 * Must go through /api/image; never fall back to a bare CDN URL in the browser.
 */
export function mangaPageRequiresProxy(url: unknown): boolean {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  try {
    const { hostname } = new URL(normalized);
    if (isMangaDexImageHost(hostname)) return true;
    if (hostname.includes('mangahere')) return true;
    return false;
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
    if (hostname.includes('mangahere')) {
      return [
        'https://www.mangahere.cc/',
        'http://www.mangahere.cc/',
        origin + '/',
      ];
    }
    // MangaPill / shared CDNs (e.g. cdn.readdetectiveconan.com)
    if (
      hostname.includes('readdetectiveconan') ||
      hostname.includes('mangapill') ||
      hostname.includes('mangap.')
    ) {
      return [
        'https://mangapill.com/',
        'https://www.mangapill.com/',
        origin + '/',
      ];
    }
    if (hostname.includes('mangareader') || hostname.includes('mrserver')) {
      return [
        'https://mangareader.to/',
        'https://www.mangareader.to/',
        origin + '/',
      ];
    }
    if (
      hostname.includes('mangakakalot') ||
      hostname.includes('manganato') ||
      hostname.includes('chapmanganato') ||
      hostname.includes('mkklcdnv6')
    ) {
      return [
        'https://www.mangakakalot.gg/',
        'https://chapmanganato.to/',
        'https://ww5.mangakakalot.tv/',
        origin + '/',
      ];
    }
    // Generic scraper CDNs — try common manga sites before the CDN origin
    // (CDN-as-Referer often 403s and must not be first)
    return [
      'https://mangapill.com/',
      'https://mangareader.to/',
      'https://www.mangahere.cc/',
      'https://chapmanganato.to/',
      origin + '/',
    ];
  } catch {
    /* fall through */
  }
  return [
    'https://mangapill.com/',
    'https://mangareader.to/',
    'https://www.mangahere.cc/',
    'https://mangadex.org/',
  ];
}

/** Serve through same-origin image proxy (adds Referer server-side). */
export function getProxiedImageUrl(url: string, referer?: string): string {
  const base = `/api/image?url=${encodeURIComponent(url)}`;
  if (referer) return `${base}&referer=${encodeURIComponent(referer)}`;
  return base;
}

/** Manga chapter page — always proxy hotlinked CDN URLs for reliable production loads */
export function getMangaPageImageUrl(url: unknown, referer?: string): string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return ANIME_PLACEHOLDER;
  if (isImageProxyAllowed(normalized)) return getProxiedImageUrl(normalized, referer);
  return normalized;
}

/**
 * Ordered display candidates for a chapter page.
 * Referer-locked CDNs: proxy only. Others: proxy then direct.
 */
export function getMangaPageImageCandidates(
  url: unknown,
  referer?: string
): string[] {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return [ANIME_PLACEHOLDER];
  if (mangaPageRequiresProxy(normalized)) {
    return [getProxiedImageUrl(normalized, referer)];
  }
  if (isImageProxyAllowed(normalized)) {
    return [getProxiedImageUrl(normalized, referer), normalized];
  }
  return [normalized];
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
