/**
 * Manga Grid Component
 * Grid layout for displaying manga cards
 */

'use client';

import { useEffect, useState } from 'react';
import { MangaCard } from './MangaCard';
import { AdsterraBanner } from '@/components/ads/AdsterraBanner';
import { AdsterraMangaTrendingSocial } from '@/components/ads/AdsterraMangaTrendingSocial';
import type { Manga } from '@/types';

/** Matches grid Tailwind breakpoints: 2 / sm:3 / md:4 / lg:5 / xl:6 */
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

function MangaTrendingAdCell() {
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg bg-gray-800/40 p-1">
        <AdsterraBanner
          placement="manga_trending_grid_160"
          variant="inline"
          size="160x300"
          className="my-0 max-h-full w-full max-w-[160px] [&>p]:sr-only [&_iframe]:max-h-full [&_iframe]:w-auto"
        />
      </div>
      <div className="mt-2 flex min-h-[4.5rem] flex-1 flex-col justify-end">
        <AdsterraMangaTrendingSocial />
      </div>
    </div>
  );
}

interface MangaGridProps {
  manga: Manga[];
  isLoading?: boolean;
  /** Ad as last cell of the first grid row (e.g. 6th on xl). */
  adSlot?: boolean;
}

export function MangaGrid({ manga, isLoading, adSlot = false }: MangaGridProps) {
  const cols = useGridColumns();

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

  const showAd = adSlot && manga.length >= 1;
  /** Drop one title so (manga count + ad) fills full grid rows. */
  const list = showAd ? manga.slice(0, -1) : manga;
  const beforeAdCount = showAd ? Math.min(cols - 1, list.length) : list.length;
  const beforeAd = list.slice(0, beforeAdCount);
  const afterAd = showAd ? list.slice(beforeAdCount) : [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {beforeAd.map((item) => (
        <MangaCard key={item.id} manga={item} />
      ))}
      {showAd && <MangaTrendingAdCell />}
      {afterAd.map((item) => (
        <MangaCard key={item.id} manga={item} />
      ))}
    </div>
  );
}
