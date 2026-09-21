'use client';

import { useEffect, useState } from 'react';
import {
  AdsterraBanner,
  ADSTERRA_DISMISS_MANGA_320,
} from '@/components/ads/AdsterraBanner';

/** 320×50 strip above manga Synopsis; separate dismiss from home Trending strip. */
export function MangaSynopsisAd() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(ADSTERRA_DISMISS_MANGA_320) === '1') {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <AdsterraBanner
      variant="strip"
      size="320x50"
      dismissible
      dismissStorageKey={ADSTERRA_DISMISS_MANGA_320}
      onDismiss={() => setVisible(false)}
      className="mx-auto w-full max-w-[320px] sm:mx-0"
    />
  );
}
