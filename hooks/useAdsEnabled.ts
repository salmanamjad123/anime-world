'use client';

import { useQuery } from '@tanstack/react-query';

export const ADS_ENABLED_QUERY_KEY = ['site-settings', 'ads'] as const;

async function fetchAdsEnabled(): Promise<boolean> {
  const res = await fetch('/api/site-settings/ads');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return true;
  return data.enabled !== false;
}

/** Site-wide Adsterra toggle from admin (default on if unset or API fails). */
export function useAdsEnabled() {
  const query = useQuery({
    queryKey: ADS_ENABLED_QUERY_KEY,
    queryFn: fetchAdsEnabled,
    staleTime: 60_000,
  });

  const enabled = query.data !== undefined ? query.data : true;

  return {
    enabled,
    isLoading: query.isLoading,
  };
}
