'use client';

import { useEffect, useRef } from 'react';
import { HILLTOP_MULTITAG_SRC, injectHilltopScript } from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdsSettings } from '@/hooks/useAdsSettings';
import { useUserStore } from '@/store/useUserStore';

/**
 * Injects the Hilltop MultiTag script once (site-wide).
 * Respects global ads enabled + hide-for-logged-in / per-user adsHidden.
 */
export function HilltopMultitag() {
  const mode = useAdMode();
  const { settings, isLoading } = useAdsSettings();
  const user = useUserStore((s) => s.user);
  const authLoading = useUserStore((s) => s.isLoading);
  const mountRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  const allowed =
    !isLoading &&
    !authLoading &&
    settings.enabled &&
    mode === 'live' &&
    Boolean(HILLTOP_MULTITAG_SRC) &&
    !(settings.hideForLoggedInUsers && user) &&
    user?.adsHidden !== true;

  useEffect(() => {
    if (!allowed || !mountRef.current || injected.current) return;
    injectHilltopScript(mountRef.current, HILLTOP_MULTITAG_SRC);
    injected.current = true;
  }, [allowed]);

  if (!allowed) return null;

  return (
    <div
      ref={mountRef}
      className="sr-only"
      aria-hidden
      data-hilltop="multitag"
    />
  );
}
