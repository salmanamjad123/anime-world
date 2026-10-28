/**
 * Manga Grid Component
 * Grid layout for displaying manga cards
 */

'use client';

import { MangaCard } from './MangaCard';
import type { Manga } from '@/types';

interface MangaGridProps {
  manga: Manga[];
  isLoading?: boolean;
}

export function MangaGrid({ manga, isLoading }: MangaGridProps) {
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

  if (!manga || manga.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No manga found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {manga.map((item) => (
        <MangaCard key={item.id} manga={item} />
      ))}
    </div>
  );
}
