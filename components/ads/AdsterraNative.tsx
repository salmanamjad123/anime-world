'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  ADSTERRA_NATIVE_CONTAINER,
  ADSTERRA_NATIVE_SRC,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdsEnabled } from '@/hooks/useAdsEnabled';
import { AdsterraBanner } from './AdsterraBanner';

const DISMISS_KEY = 'av-watch-player-ad-dismissed';

/**
 * Non-intrusive slot under the video player.
 * Uses an Adsterra native unit when env is set; otherwise the 300x250 banner.
 */
export function AdsterraNative() {
  const mode = useAdMode();
  const { enabled: adsEnabled, isLoading: adsSettingsLoading } = useAdsEnabled();
  const mountRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const hasNativeUnit = Boolean(ADSTERRA_NATIVE_SRC && ADSTERRA_NATIVE_CONTAINER);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    if (
      !adsEnabled ||
      mode !== 'live' ||
      !hasNativeUnit ||
      !mountRef.current ||
      !visible
    ) {
      return;
    }
    const el = mountRef.current;
    el.innerHTML = '';

    const box = document.createElement('div');
    box.id = ADSTERRA_NATIVE_CONTAINER;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cfasync = 'false';
    script.src = ADSTERRA_NATIVE_SRC;
    el.append(script, box);

    return () => {
      el.innerHTML = '';
    };
  }, [adsEnabled, mode, hasNativeUnit, visible]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible || mode === 'loading') return null;
  if (!adsSettingsLoading && !adsEnabled) return null;

  const closeButton = (
    <button
      type="button"
      onClick={dismiss}
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
        <p className="text-sm font-medium text-gray-300">Native ad under player</p>
        <p className="mt-1 text-center text-xs text-gray-500">
          Placeholder on localhost. Does not cover the video.
        </p>
      </aside>
    );
  }

  if (hasNativeUnit) {
    return (
      <aside aria-label="Advertisement" className="relative mt-4 min-h-[120px]">
        {closeButton}
        <p className="mb-2 text-center text-[10px] uppercase tracking-wider text-gray-500">
          Advertisement
        </p>
        <div ref={mountRef} className="flex justify-center overflow-hidden rounded-lg" />
      </aside>
    );
  }

  return (
    <div className="relative mt-4">
      {closeButton}
      <AdsterraBanner variant="inline" />
    </div>
  );
}
