'use client';

import { useState } from 'react';
import { AdsterraBanner } from '@/components/ads/AdsterraBanner';

/** 320×50 strip above manga Synopsis; dismiss resets on full page refresh. */
export function MangaSynopsisAd() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AdsterraBanner
      placement="manga_synopsis_320"
      variant="strip"
      size="320x50"
      dismissible
      onDismiss={() => setVisible(false)}
      className="mx-auto w-full max-w-[320px] sm:mx-0"
    />
  );
}
