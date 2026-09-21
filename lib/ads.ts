export const ADSTERRA_BANNER_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY ||
  '75c80d90568a0501592e3b28771a6543';

/** 320x50 mobile leaderboard — create this unit in Adsterra (Banner → 320x50). */
export const ADSTERRA_BANNER_320_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_320_KEY ||
  'c87af8802edb6098ffb7523a2f01db11';

export const ADSTERRA_NATIVE_SRC =
  process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC || '';
export const ADSTERRA_NATIVE_CONTAINER =
  process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_CONTAINER || '';

export const ADSTERRA_SOCIAL_SRC =
  process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_SRC || '';

export const ADSTERRA_SMARTLINK =
  process.env.NEXT_PUBLIC_ADSTERRA_SMARTLINK || '';

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
