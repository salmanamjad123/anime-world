/** Local SVG — never depends on AniList or external CDNs */
export const ANIME_PLACEHOLDER = '/images/anime-placeholder.svg';

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
