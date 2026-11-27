'use client';

import { useState } from 'react';
import { HilltopBanner } from '@/components/ads/HilltopBanner';

/** 300×250 above manga Synopsis; dismiss resets on full page refresh. */
export function MangaSynopsisAd() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <HilltopBanner
      placement="manga_synopsis_320"
      variant="strip"
      dismissible
      onDismiss={() => setVisible(false)}
      className="mx-auto w-full max-w-[300px] sm:mx-0"
    />
  );
}
