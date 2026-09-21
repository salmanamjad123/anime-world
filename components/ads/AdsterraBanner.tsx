'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_320_KEY,
  ADSTERRA_BANNER_160_300_KEY,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import type { AdPlacementId } from '@/lib/ads-placements';

const SIZES = {
  '300x250': { width: 300, height: 250, key: ADSTERRA_BANNER_KEY },
  '320x50': { width: 320, height: 50, key: ADSTERRA_BANNER_320_KEY },
  '160x300': { width: 160, height: 300, key: ADSTERRA_BANNER_160_300_KEY },
} as const;

export const ADSTERRA_DISMISS_HOME_320 = 'av-banner-320-dismissed';
export const ADSTERRA_DISMISS_MANGA_320 = 'av-banner-320-manga-dismissed';

export function AdsterraBanner({
  placement,
  variant = 'section',
  size = '300x250',
  dismissible = false,
  dismissStorageKey = ADSTERRA_DISMISS_HOME_320,
  onDismiss,
  className,
}: {
  placement: AdPlacementId;
  variant?: 'section' | 'grid' | 'inline' | 'strip';
  size?: keyof typeof SIZES;
  dismissible?: boolean;
  dismissStorageKey?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const mode = useAdMode();
  const { visible: adsVisible, isLoading: adsSettingsLoading } =
    useAdPlacementVisible(placement);
  const { width, height, key } = SIZES[size];
  const liveRef = useRef<HTMLIFrameElement>(null);
  const [hidden, setHidden] = useState(false);
  const canFill = mode === 'live' && Boolean(key);

  useEffect(() => {
    if (dismissible && sessionStorage.getItem(dismissStorageKey) === '1') {
      setHidden(true);
    }
  }, [dismissible, dismissStorageKey]);

  useEffect(() => {
    if (!canFill || !liveRef.current) return;
    liveRef.current.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head><body>
<script>atOptions = { 'key' : '${key}', 'format' : 'iframe', 'height' : ${height}, 'width' : ${width}, 'params' : {} };</script>
<script src="https://www.highrevenueformat.com/${key}/invoke.js"></script>
</body></html>`;
  }, [canFill, key, width, height]);

  if (hidden) return null;
  if (!adsSettingsLoading && !adsVisible) return null;

  const frameClass = cn(
    'overflow-hidden rounded-md border-0 bg-gray-800/40',
    size === '320x50' && 'h-[50px] w-[320px] max-w-full',
    size === '300x250' && 'h-[250px] w-[300px]',
    size === '160x300' && 'h-[300px] w-[160px] max-w-full'
  );

  const slot = canFill ? (
    <iframe
      ref={liveRef}
      title="Advertisement"
      width={width}
      height={height}
      scrolling="no"
      className={frameClass}
    />
  ) : (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-800/50 text-center',
        size === '320x50' && 'h-[50px] w-[320px] max-w-full px-2',
        size === '300x250' && 'h-[250px] w-[300px] px-4',
        size === '160x300' && 'h-[300px] w-[160px] max-w-full px-2'
      )}
    >
      <span
        className={cn(
          'font-medium text-gray-300',
          size === '320x50' ? 'text-[11px]' : 'text-sm'
        )}
      >
        Ad {width}×{height}
      </span>
      {size !== '320x50' && (
        <span className="mt-1 text-xs text-gray-500">
          {mode === 'loading'
            ? 'Loading…'
            : 'Placeholder on localhost. Live ads show on animevillage.org'}
        </span>
      )}
    </div>
  );

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'flex flex-col items-center justify-center',
        variant === 'section' && 'my-10',
        variant === 'inline' && 'my-0',
        variant === 'strip' &&
          'relative mx-auto my-0 h-[50px] w-[320px] max-w-full shrink-0 overflow-hidden sm:mx-0 sm:ml-auto',
        variant === 'grid' &&
          (size === '160x300'
            ? 'h-full min-h-[300px] rounded-lg bg-gray-800/30 px-2 py-3'
            : 'h-full min-h-[250px] rounded-lg bg-gray-800/30 px-2 py-3'),
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
            sessionStorage.setItem(dismissStorageKey, '1');
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
