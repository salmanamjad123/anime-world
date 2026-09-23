'use client';

import { useEffect } from 'react';
import { trackHomeSmartlinkClick } from '@/lib/ads';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import { useUserStore } from '@/store/useUserStore';

/**
 * On the home page, opens the Adsterra smartlink once on the 3rd guest click
 * in the current browser session. Skipped when logged in or placement is off.
 */
export function HomeSmartlinkTracker() {
  const user = useUserStore((s) => s.user);
  const { visible } = useAdPlacementVisible('home_smartlink');
  const enabled = visible && !user;

  useEffect(() => {
    if (!enabled) return;

    const onClick = () => {
      trackHomeSmartlinkClick(true);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [enabled]);

  return null;
}
