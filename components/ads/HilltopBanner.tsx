'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HILLTOP_BANNER_SRC, injectHilltopScript } from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import type { AdPlacementId } from '@/lib/ads-placements';

const WIDTH = 300;
const HEIGHT = 250;

export function HilltopBanner({
  placement,
  variant = 'section',
  dismissible = false,
  onDismiss,
  className,
}: {
  placement: AdPlacementId;
  variant?: 'section' | 'grid' | 'inline' | 'strip';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  const mode = useAdMode();
  const { visible: adsVisible, isLoading: adsSettingsLoading } =
    useAdPlacementVisible(placement);
  const mountRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const canFill = mode === 'live' && Boolean(HILLTOP_BANNER_SRC);
  const devPreview = mode !== 'live';

  useEffect(() => {
    if (!canFill || !mountRef.current || hidden) return;
    const el = mountRef.current;
    el.innerHTML = '';
    injectHilltopScript(el, HILLTOP_BANNER_SRC);
    return () => {
      el.innerHTML = '';
    };
  }, [canFill, hidden]);

  if (hidden) return null;
  if (!devPreview && !adsSettingsLoading && !adsVisible) return null;

  const slot = canFill ? (
    <div
      ref={mountRef}
      className="max-w-full overflow-hidden rounded-md bg-gray-800/40"
      style={{ width: WIDTH, minHeight: HEIGHT }}
    />
  ) : (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-800/50 px-4 text-center"
      style={{ width: WIDTH, height: HEIGHT, maxWidth: '100%' }}
    >
      <span className="text-sm font-medium text-gray-300">
        Ad {WIDTH}×{HEIGHT}
      </span>
      <span className="mt-1 text-xs text-gray-500">
        {mode === 'loading'
          ? 'Loading…'
          : 'Add HilltopAds banner env to fill this unit'}
      </span>
    </div>
  );

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'relative flex flex-col items-center justify-center',
        variant === 'section' && 'my-10',
        variant === 'inline' && 'my-0',
        variant === 'strip' &&
          'mx-auto my-0 w-[300px] max-w-full shrink-0 overflow-hidden sm:mx-0 sm:ml-auto',
        variant === 'grid' &&
          'h-full min-h-[250px] rounded-lg bg-gray-800/30 px-2 py-3',
        className
      )}
    >
      {variant !== 'strip' && (
        <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
          Advertisement
        </p>
      )}
      {slot}
      {dismissible && (
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            onDismiss?.();
          }}
          className="absolute right-0.5 top-0.5 z-10 rounded bg-black/60 p-0.5 text-gray-300 hover:bg-black/80 hover:text-white"
          aria-label="Close advertisement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </aside>
  );
}
