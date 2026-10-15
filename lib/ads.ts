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

export const ADSTERRA_SMARTLINK =
  process.env.NEXT_PUBLIC_ADSTERRA_SMARTLINK ||
  'https://araplhn.org/4/f7182aedea42dbf055578f0d0cfc0498';

/** After a smartlink opens, do not open another for this long. */
export const SMARTLINK_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const SMARTLINK_LAST_OPEN_KEY = 'smartlink_last_open';

/** Manga social bar: show at most once every 2 hours. */
export const SOCIAL_BAR_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const SOCIAL_BAR_LAST_SHOWN_KEY = 'manga_social_bar_last';

export function canShowMangaSocialBar(): boolean {
  if (typeof window === 'undefined') return false;
  if (!ADSTERRA_SOCIAL_SRC) return false;
  try {
    const last = Number(localStorage.getItem(SOCIAL_BAR_LAST_SHOWN_KEY) || 0);
    if (last && Date.now() - last < SOCIAL_BAR_COOLDOWN_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function markMangaSocialBarShown(): void {
  try {
    localStorage.setItem(SOCIAL_BAR_LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function isAdLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** Opens Adsterra smartlink in a new tab. No-op if unset. */
export function openAdsterraSmartlink() {
  if (typeof window === 'undefined') return;
  if (!ADSTERRA_SMARTLINK) return;
  window.open(ADSTERRA_SMARTLINK, '_blank', 'noopener,noreferrer');
}

/**
 * On the first eligible click, open the smartlink in a new tab.
 * After that, no-op until the 2-hour cooldown expires (localStorage).
 * Returns true if the smartlink was opened.
 */
export function trackHomeSmartlinkClick(enabled: boolean): boolean {
  if (typeof window === 'undefined') return false;
  if (!enabled || !ADSTERRA_SMARTLINK) return false;

  try {
    const last = Number(localStorage.getItem(SMARTLINK_LAST_OPEN_KEY) || 0);
    if (last && Date.now() - last < SMARTLINK_COOLDOWN_MS) return false;

    localStorage.setItem(SMARTLINK_LAST_OPEN_KEY, String(Date.now()));
    openAdsterraSmartlink();
    return true;
  } catch {
    return false;
  }
}
