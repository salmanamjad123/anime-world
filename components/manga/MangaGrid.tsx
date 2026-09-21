/**
 * Manga Grid Component
 * Grid layout for displaying manga cards
 */

'use client';

import { MangaCard } from './MangaCard';
import { AdsterraBanner } from '@/components/ads/AdsterraBanner';
import { Card } from '@/components/ui/Card';
import { useReserveAdSlot } from '@/hooks/useAdsSettings';
import type { Manga } from '@/types';

/** Always insert the ad after this many manga (6th slot in grid order). */
const MANGA_TRENDING_AD_AFTER = 5;

function MangaTrendingAdCell() {
  return (
    <div className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden bg-gray-900/30">
          <AdsterraBanner
            placement="manga_trending_grid_160"
            variant="inline"
            size="160x300"
            className="my-0 max-h-full w-full max-w-[160px] [&>p]:sr-only [&_iframe]:max-h-full [&_iframe]:w-auto"
          />
        </div>
        <div className="p-3 flex-1" aria-hidden>
          <div className="min-h-[2.75rem]" />
        </div>
      </Card>
    </div>
  );
}

interface MangaGridProps {
  manga: Manga[];
  isLoading?: boolean;
  /** 160×300 ad as 6th item (after 5 manga). */
  adSlot?: boolean;
}

export function MangaGrid({ manga, isLoading, adSlot = false }: MangaGridProps) {
  const showAd = useReserveAdSlot(
    'manga_trending_grid_160',
    adSlot && (manga?.length ?? 0) >= 1
  );

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

  /** Drop one title so total cells align with full rows when possible. */
  const list = showAd ? manga.slice(0, -1) : manga;
  const beforeAdCount = showAd
    ? Math.min(MANGA_TRENDING_AD_AFTER, list.length)
    : list.length;
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
