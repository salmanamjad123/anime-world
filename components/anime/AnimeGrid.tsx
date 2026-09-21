/**
 * Anime Grid Component
 * Grid layout for displaying multiple anime cards
 */

'use client';

import { useEffect, useState } from 'react';
import { AnimeCard } from './AnimeCard';
import { AdsterraBanner } from '@/components/ads/AdsterraBanner';
import { Button } from '@/components/ui/Button';
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

function visibleCountForAdRow(available: number, cols: number) {
  const maxCards = Math.max(0, available - 2);
  if (cols <= 2) return maxCards;
  const wantRemainder = cols - 2;
  const extra = (maxCards - wantRemainder + cols * 10) % cols;
  return Math.max(0, maxCards - extra);
}

interface AnimeGridProps {
  anime: Anime[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  slowLoad?: boolean;
  /** Place a 300x250 ad in the last two card slots so the grid stays even. */
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

  const showAd = adSlot && anime.length >= 2;
  const items = showAd
    ? anime.slice(0, visibleCountForAdRow(anime.length, cols))
    : anime;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <AnimeCard key={item.id} anime={item} />
      ))}
      {showAd && (
        <div className="col-span-2">
          <AdsterraBanner placement="home_grid_300" variant="grid" />
        </div>
      )}
    </div>
  );
}
