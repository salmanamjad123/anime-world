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

/** Guest home clicks before opening the smartlink once per session. */
export const HOME_SMARTLINK_CLICK_THRESHOLD = 3;

const HOME_SMARTLINK_DONE_KEY = 'home_smartlink_done';
const HOME_SMARTLINK_CLICKS_KEY = 'home_smartlink_clicks';

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
 * Count a home-page guest click. On the Nth click in this browser session,
 * open the smartlink once. No-op if already fired this session.
 * Returns true if the smartlink was opened.
 */
export function trackHomeSmartlinkClick(
  enabled: boolean,
  threshold = HOME_SMARTLINK_CLICK_THRESHOLD
): boolean {
  if (typeof window === 'undefined') return false;
  if (!enabled || !ADSTERRA_SMARTLINK) return false;

  try {
    if (sessionStorage.getItem(HOME_SMARTLINK_DONE_KEY) === '1') return false;

    const next = Number(sessionStorage.getItem(HOME_SMARTLINK_CLICKS_KEY) || 0) + 1;
    sessionStorage.setItem(HOME_SMARTLINK_CLICKS_KEY, String(next));

    if (next < threshold) return false;

    sessionStorage.setItem(HOME_SMARTLINK_DONE_KEY, '1');
    openAdsterraSmartlink();
    return true;
  } catch {
    return false;
  }
}
