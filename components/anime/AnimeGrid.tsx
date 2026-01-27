/**
 * Anime Grid Component
 * Grid layout for displaying multiple anime cards
 */

'use client';

import { AnimeCard } from './AnimeCard';
import type { Anime } from '@/types';

interface AnimeGridProps {
  anime: Anime[];
  isLoading?: boolean;
}

export function AnimeGrid({ anime, isLoading }: AnimeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] bg-gray-800 rounded-lg" />
            <div className="mt-2 h-4 bg-gray-800 rounded w-3/4" />
            <div className="mt-2 h-3 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
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
