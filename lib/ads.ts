export const ADSTERRA_BANNER_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY ||
  '75c80d90568a0501592e3b28771a6543';

/** 320x50 mobile leaderboard — create this unit in Adsterra (Banner → 320x50). */
export const ADSTERRA_BANNER_320_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_320_KEY ||
  'c87af8802edb6098ffb7523a2f01db11';

/** 160x300 skyscraper — Manga home trending grid (last two card slots). */
export const ADSTERRA_BANNER_160_300_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_160_300_KEY ||
  'e1dc99e198aa7ca41d54eac4bb9bbfa4';

export const ADSTERRA_NATIVE_SRC =
  process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC || '';
export const ADSTERRA_NATIVE_CONTAINER =
  process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_CONTAINER || '';

export const ADSTERRA_SOCIAL_SRC =
  process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_SRC || '';

export const ADSTERRA_SMARTLINK =
  process.env.NEXT_PUBLIC_ADSTERRA_SMARTLINK || '';

/** Home trending grid: `monetag` (default) or `adsterra`. */
export type HomeGridAdProvider = 'adsterra' | 'monetag';

export const HOME_GRID_AD_PROVIDER: HomeGridAdProvider =
  process.env.NEXT_PUBLIC_HOME_GRID_AD_PROVIDER === 'adsterra'
    ? 'adsterra'
    : 'monetag';

export const MONETAG_ZONE =
  process.env.NEXT_PUBLIC_MONETAG_ZONE || '11857007';

export const MONETAG_TAG_SRC =
  process.env.NEXT_PUBLIC_MONETAG_TAG_SRC || 'https://nap5k.com/tag.min.js';

export function isAdLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** Opens Adsterra smartlink in a new tab. No-op on localhost or if unset. */
export function openAdsterraSmartlink() {
  if (typeof window === 'undefined') return;
  if (isAdLocalHost() || !ADSTERRA_SMARTLINK) return;
  window.open(ADSTERRA_SMARTLINK, '_blank', 'noopener,noreferrer');
}
