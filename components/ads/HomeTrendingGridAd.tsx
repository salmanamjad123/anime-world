'use client';

import { AdsterraBanner } from '@/components/ads/AdsterraBanner';
import { MonetagGridBanner } from '@/components/ads/MonetagGridBanner';
import { HOME_GRID_AD_PROVIDER } from '@/lib/ads';

/** Home Trending Now grid slot — Monetag or Adsterra via env. */
export function HomeTrendingGridAd() {
  if (HOME_GRID_AD_PROVIDER === 'adsterra') {
    return <AdsterraBanner placement="home_grid_300" variant="grid" />;
  }
  return <MonetagGridBanner placement="home_grid_300" />;
}
