'use client';

import { useEffect, useRef } from 'react';
import {
  HILLTOP_POPUNDER_SRC,
  canInjectPopunderScript,
  injectHilltopScript,
  markPopunderScriptInjected,
  trackPopunderClick,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import { useUserStore } from '@/store/useUserStore';

/**
 * Site-wide Hilltop popunder:
 * 1) Injects the popunder script once per tab session.
 * 2) On first guest click outside home/admin, opens the direct URL (2h cooldown).
 */
export function HilltopPopunder() {
  const mode = useAdMode();
  const user = useUserStore((s) => s.user);
  const { visible } = useAdPlacementVisible('home_smartlink');
  const mountRef = useRef<HTMLDivElement>(null);
  const enabled = visible && !user && mode === 'live';

  useEffect(() => {
    if (!enabled || !HILLTOP_POPUNDER_SRC || !mountRef.current) return;
    if (!canInjectPopunderScript()) return;
    injectHilltopScript(mountRef.current, HILLTOP_POPUNDER_SRC);
    markPopunderScriptInjected();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onClick = () => {
      const path = window.location.pathname;
      if (path === '/' || path.startsWith('/admin')) return;
      trackPopunderClick(true);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled]);

  if (!enabled || !HILLTOP_POPUNDER_SRC) return null;

  return (
    <div
      ref={mountRef}
      className="sr-only"
      aria-hidden
      data-hilltop="popunder"
    />
  );
}
