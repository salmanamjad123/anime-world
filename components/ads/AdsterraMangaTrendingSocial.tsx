'use client';

import { useEffect, useRef } from 'react';
import { ADSTERRA_MANGA_TRENDING_SOCIAL_SRC } from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';

/** Inline social bar under manga trending 160×300 (card footer height). */
export function AdsterraMangaTrendingSocial() {
  const mode = useAdMode();
  const { visible, isLoading: adsSettingsLoading } = useAdPlacementVisible(
    'manga_trending_grid_160'
  );
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      mode !== 'live' ||
      !visible ||
      !ADSTERRA_MANGA_TRENDING_SOCIAL_SRC ||
      !mountRef.current
    ) {
      return;
    }
    const el = mountRef.current;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = ADSTERRA_MANGA_TRENDING_SOCIAL_SRC;
    el.append(script);
    return () => {
      el.innerHTML = '';
    };
  }, [mode, visible]);

  if (!adsSettingsLoading && !visible) return null;

  if (mode === 'local' || mode === 'loading') {
    return (
      <div
        className="flex min-h-[4.5rem] flex-col items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-800/40 px-2 py-2 text-center"
        aria-label="Advertisement"
      >
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          Social bar
        </span>
        <span className="mt-0.5 text-[11px] text-gray-400">
          {mode === 'loading' ? 'Loading…' : 'Placeholder on localhost'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="relative min-h-[4.5rem] w-full overflow-hidden rounded-md"
      aria-label="Advertisement"
    />
  );
}
