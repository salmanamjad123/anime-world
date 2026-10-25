'use client';

import { useEffect } from 'react';
import { trackHomeSmartlinkClick } from '@/lib/ads';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import { useUserStore } from '@/store/useUserStore';

/**
 * Site-wide: first guest click opens the Adsterra smartlink, then 2h cooldown.
 * Skipped when logged in, placement is off, or the user is in /admin.
 */
export function HomeSmartlinkTracker() {
  const user = useUserStore((s) => s.user);
  const { visible } = useAdPlacementVisible('home_smartlink');
  const enabled = visible && !user;

  useEffect(() => {
    if (!enabled) return;

    const onClick = () => {
      const path = window.location.pathname;
      if (path === '/' || path.startsWith('/admin')) return;
      trackHomeSmartlinkClick(true);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled]);

  return null;
}
