'use client';

import { useState } from 'react';
import { AdsterraBanner } from '@/components/ads/AdsterraBanner';

/** 320×50 strip above anime Synopsis (same unit as home trending strip). */
export function AnimeSynopsisAd() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AdsterraBanner
      placement="anime_synopsis_320"
      variant="strip"
      size="320x50"
      dismissible
      onDismiss={() => setVisible(false)}
      className="mx-auto w-full max-w-[320px] sm:mx-0"
    />
  );
}
