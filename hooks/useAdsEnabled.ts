'use client';

import { useAdPlacementVisible } from '@/hooks/useAdsSettings';

/** @deprecated Prefer useAdPlacementVisible(placement) for a specific slot. */
export function useAdsEnabled() {
  const { visible, isLoading } = useAdPlacementVisible('home_trending_320');
  return { enabled: visible, isLoading };
}

export { ADS_SETTINGS_QUERY_KEY as ADS_ENABLED_QUERY_KEY } from '@/hooks/useAdsSettings';
