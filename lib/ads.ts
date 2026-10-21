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
  process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_SRC ||
  'https://bauval.org/14/ac28d650f3fd8394f7cf51c6295e3500';

/** Social bar: once per 2 hours per scope (anime home+detail share one timer). */
export const SOCIAL_BAR_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export type SocialBarScope = 'manga' | 'anime';

const SOCIAL_BAR_KEYS: Record<SocialBarScope, string[]> = {
  manga: ['manga_social_bar_last', 'social_bar_last'],
  anime: ['anime_social_bar_last'],
};

export function canShowSocialBar(scope: SocialBarScope = 'manga'): boolean {
  if (typeof window === 'undefined') return false;
  if (!ADSTERRA_SOCIAL_SRC) return false;
  try {
    const last = SOCIAL_BAR_KEYS[scope].reduce(
      (max, key) => Math.max(max, Number(localStorage.getItem(key) || 0)),
      0
    );
    if (last && Date.now() - last < SOCIAL_BAR_COOLDOWN_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function markSocialBarShown(scope: SocialBarScope = 'manga'): void {
  try {
    const ts = String(Date.now());
    localStorage.setItem(SOCIAL_BAR_KEYS[scope][0], ts);
  } catch {
    /* private mode */
  }
}

/** @deprecated use canShowSocialBar('manga') */
export const canShowMangaSocialBar = () => canShowSocialBar('manga');
/** @deprecated use markSocialBarShown('manga') */
export const markMangaSocialBarShown = () => markSocialBarShown('manga');

export function isAdLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}
