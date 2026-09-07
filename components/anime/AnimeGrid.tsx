/**
 * Anime Grid Component
 * Grid layout for displaying multiple anime cards
 */

'use client';

import { AnimeCard } from './AnimeCard';
import { Button } from '@/components/ui/Button';
import type { Anime } from '@/types';

interface AnimeGridProps {
  anime: Anime[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  slowLoad?: boolean;
}

export function AnimeGrid({
  anime,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  slowLoad,
}: AnimeGridProps) {
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {anime.map((item) => (
        <AnimeCard key={item.id} anime={item} />
      ))}
    </div>
  );
}
