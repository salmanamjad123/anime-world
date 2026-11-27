/**
 * Anime Grid Component
 * Grid layout for displaying multiple anime cards
 */

'use client';

import { useEffect, useState } from 'react';
import { AnimeCard } from './AnimeCard';
import { HilltopBanner } from '@/components/ads/HilltopBanner';
import { Button } from '@/components/ui/Button';
import { useReserveAdSlot } from '@/hooks/useAdsSettings';
import type { Anime } from '@/types';

/** Matches AnimeGrid Tailwind breakpoints: 2 / sm:3 / md:4 / lg:5 / xl:6 */
function useGridColumns() {
  const [cols, setCols] = useState(6);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCols(6);
      else if (w >= 1024) setCols(5);
      else if (w >= 768) setCols(4);
      else if (w >= 640) setCols(3);
      else setCols(2);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

/** Cards before the ad so the banner (col-span-2) finishes the first row. */
function cardsBeforeFirstRowAd(cols: number) {
  return Math.max(0, cols - 2);
}

interface AnimeGridProps {
  anime: Anime[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  slowLoad?: boolean;
  /** Place a 300x250 ad in the first row (last two columns). */
  adSlot?: boolean;
}

export function AnimeGrid({
  anime,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  slowLoad,
  adSlot = false,
}: AnimeGridProps) {
  const cols = useGridColumns();
  const showAd = useReserveAdSlot(
    'home_grid_300',
    adSlot && (anime?.length ?? 0) >= 2
  );
  const showSkeleton = isLoading && (!anime || anime.length === 0);

  if (showSkeleton) {
    return (
      <div>
        {slowLoad && (
          <p className="text-center text-gray-400 text-sm mb-4">
            Loading is taking longer than usual — the catalog may be rate-limited.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] bg-gray-800 rounded-lg" />
              <div className="mt-2 h-4 bg-gray-800 rounded w-3/4" />
              <div className="mt-2 h-3 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
        {onRetry && slowLoad && (
          <div className="flex justify-center mt-4">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry now
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isError && (!anime || anime.length === 0)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-300 font-medium mb-1">Couldn&apos;t load anime</p>
        <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
          {errorMessage || 'The catalog API may be slow or rate-limited. Please try again.'}
        </p>
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (!anime || anime.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No anime found</p>
      </div>
    );
  }

  /** Drop a short last row so the grid ends evenly. */
  function trimToFullRows(list: Anime[], columns: number) {
    if (columns <= 0 || list.length < columns) return list;
    const full = Math.floor(list.length / columns) * columns;
    return list.slice(0, full);
  }

  if (!showAd) {
    const items = trimToFullRows(anime, cols);
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <AnimeCard key={item.id} anime={item} />
        ))}
      </div>
    );
  }

  const before = cardsBeforeFirstRowAd(cols);
  const head = anime.slice(0, before);
  const tail = trimToFullRows(anime.slice(before), cols);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {head.map((item) => (
        <AnimeCard key={item.id} anime={item} />
      ))}
      <div className="col-span-2">
        <HilltopBanner placement="home_grid_300" variant="grid" />
      </div>
      {tail.map((item) => (
        <AnimeCard key={item.id} anime={item} />
      ))}
    </div>
  );
}
