'use client';

import { useState } from 'react';
import { HilltopBanner } from '@/components/ads/HilltopBanner';

/** 300×250 above anime Synopsis. */
export function AnimeSynopsisAd() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <HilltopBanner
      placement="anime_synopsis_320"
      variant="strip"
      dismissible
      onDismiss={() => setVisible(false)}
      className="mx-auto w-full max-w-[300px] sm:mx-0"
    />
  );
}
