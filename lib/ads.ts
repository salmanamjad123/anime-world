/**
 * HilltopAds — banner, MultiTag, and popunder.
 * Script hosts come from env (NEXT_PUBLIC_HILLTOP_*).
 */

function normalizeScriptSrc(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

/** In-content banner (300×250 MultiTag banner unit). */
export const HILLTOP_BANNER_SRC = normalizeScriptSrc(
  process.env.NEXT_PUBLIC_HILLTOP_BANNER_SRC || ''
);

/** Site-wide MultiTag (banner + pops combo). Inject once. */
export const HILLTOP_MULTITAG_SRC = normalizeScriptSrc(
  process.env.NEXT_PUBLIC_HILLTOP_MULTITAG_SRC || ''
);

/** Popunder script — inject once when placement is on. */
export const HILLTOP_POPUNDER_SRC = normalizeScriptSrc(
  process.env.NEXT_PUBLIC_HILLTOP_POPUNDER_SRC || ''
);

/** Direct-link / click popunder URL (optional; used with cooldown). */
export const HILLTOP_POPUNDER_URL = (process.env.NEXT_PUBLIC_HILLTOP_POPUNDER_URL || '').trim();

/** After a popunder URL opens, do not open another for this long. */
export const POPUNDER_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const POPUNDER_LAST_OPEN_KEY = 'hilltop_popunder_last_open';
const POPUNDER_COOKIE = 'av_popunder_cd';

function readPopunderCooldownTs(): number {
  try {
    const fromLs = Number(localStorage.getItem(POPUNDER_LAST_OPEN_KEY) || 0);
    if (fromLs) return fromLs;
  } catch {
    /* private mode */
  }
  try {
    const match = document.cookie.match(/(?:^|; )av_popunder_cd=(\d+)/);
    if (match) return Number(match[1]) || 0;
  } catch {
    /* cookies blocked */
  }
  return 0;
}

function writePopunderCooldownTs(ts: number) {
  try {
    localStorage.setItem(POPUNDER_LAST_OPEN_KEY, String(ts));
  } catch {
    /* private mode */
  }
  try {
    const maxAge = Math.floor(POPUNDER_COOLDOWN_MS / 1000);
    document.cookie = `${POPUNDER_COOKIE}=${ts}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch {
    /* cookies blocked */
  }
}

export function isAdLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Inject a HilltopAds loader script into `parent`.
 * Mirrors their snippet: script.settings + async + referrerPolicy.
 */
export function injectHilltopScript(
  parent: HTMLElement,
  src: string,
  settings: Record<string, unknown> = {}
): HTMLScriptElement | null {
  if (!src || !parent) return null;
  const s = document.createElement('script');
  (s as HTMLScriptElement & { settings?: Record<string, unknown> }).settings =
    settings;
  s.src = src;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  parent.appendChild(s);
  return s;
}

/** Opens the popunder URL in a new tab. No-op if unset. */
export function openHilltopPopunderUrl() {
  if (typeof window === 'undefined') return;
  if (!HILLTOP_POPUNDER_URL) return;
  window.open(HILLTOP_POPUNDER_URL, '_blank', 'noopener,noreferrer');
}

/**
 * On the first eligible click, open the popunder URL in a new tab.
 * After that, no-op for 2 hours (localStorage + cookie).
 */
export function trackPopunderClick(enabled: boolean): boolean {
  if (typeof window === 'undefined') return false;
  if (!enabled || !HILLTOP_POPUNDER_URL) return false;

  const last = readPopunderCooldownTs();
  if (last && Date.now() - last < POPUNDER_COOLDOWN_MS) return false;

  writePopunderCooldownTs(Date.now());
  openHilltopPopunderUrl();
  return true;
}

const POPUNDER_SCRIPT_SESSION_KEY = 'hilltop_popunder_script_session';

/** Inject popunder script at most once per browser tab session. */
export function canInjectPopunderScript(): boolean {
  if (typeof window === 'undefined') return false;
  if (!HILLTOP_POPUNDER_SRC) return false;
  try {
    return sessionStorage.getItem(POPUNDER_SCRIPT_SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markPopunderScriptInjected(): void {
  try {
    sessionStorage.setItem(POPUNDER_SCRIPT_SESSION_KEY, '1');
  } catch {
    /* private mode */
  }
}
