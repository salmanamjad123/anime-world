'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import { HilltopBanner } from './HilltopBanner';

/** Banner under the video player. */
export function WatchPlayerAd() {
  const mode = useAdMode();
  const { visible: adsVisible, isLoading: adsSettingsLoading } =
    useAdPlacementVisible('watch_player');
  const [visible, setVisible] = useState(true);

  if (!visible || mode === 'loading') return null;
  if (!adsSettingsLoading && !adsVisible) return null;

  const closeButton = (
    <button
      type="button"
      onClick={() => setVisible(false)}
      className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1 text-gray-300 hover:bg-black/80 hover:text-white"
      aria-label="Close advertisement"
    >
      <X className="h-4 w-4" />
    </button>
  );

  if (mode === 'local') {
    return (
      <aside
        aria-label="Advertisement"
        className="relative mt-4 flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800/30 px-4 py-6"
      >
        {closeButton}
        <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
          Advertisement
        </p>
        <p className="text-sm font-medium text-gray-300">Ad under player</p>
        <p className="mt-1 text-center text-xs text-gray-500">
          Placeholder on localhost. Does not cover the video.
        </p>
      </aside>
    );
  }

  return (
    <div className="relative mt-4">
      {closeButton}
      <HilltopBanner placement="watch_player" variant="inline" />
    </div>
  );
}
