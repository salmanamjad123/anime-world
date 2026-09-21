'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MONETAG_TAG_SRC, MONETAG_ZONE } from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import type { AdPlacementId } from '@/lib/ads-placements';

export function MonetagGridBanner({
  placement,
  className,
}: {
  placement: AdPlacementId;
  className?: string;
}) {
  const mode = useAdMode();
  const { visible: adsVisible, isLoading: adsSettingsLoading } =
    useAdPlacementVisible(placement);
  const mountRef = useRef<HTMLDivElement>(null);
  const canFill = mode === 'live' && Boolean(MONETAG_ZONE);
  const devPreview = mode !== 'live';

  useEffect(() => {
    if (!canFill || !mountRef.current) return;
    const script = document.createElement('script');
    script.dataset.zone = MONETAG_ZONE;
    script.src = MONETAG_TAG_SRC;
    script.async = true;
    mountRef.current.appendChild(script);
    return () => {
      script.remove();
    };
  }, [canFill]);

  if (!devPreview && !adsSettingsLoading && !adsVisible) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'flex h-full min-h-[250px] flex-col items-center justify-center rounded-lg bg-gray-800/30 px-2 py-3',
        className
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
        Advertisement
      </p>
      {canFill ? (
        <div
          ref={mountRef}
          className="flex min-h-[250px] w-full max-w-[300px] items-center justify-center"
        />
      ) : (
        <div className="flex h-[250px] w-[300px] flex-col items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-800/50 px-4 text-center">
          <span className="text-sm font-medium text-gray-300">Monetag 300×250</span>
          <span className="mt-1 text-xs text-gray-500">
            {mode === 'loading'
              ? 'Loading…'
              : 'Placeholder on localhost. Live on animevillage.org'}
          </span>
        </div>
      )}
    </aside>
  );
}
