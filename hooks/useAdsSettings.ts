'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  defaultAdPlacements,
  isPlacementVisible,
  type AdPlacementId,
  type AdPolicySettings,
} from '@/lib/ads-placements';
import { useUserStore } from '@/store/useUserStore';
import { useAdMode } from '@/hooks/useAdMode';

export const ADS_SETTINGS_QUERY_KEY = ['site-settings', 'ads'] as const;

/** @deprecated use ADS_SETTINGS_QUERY_KEY */
export const ADS_ENABLED_QUERY_KEY = ADS_SETTINGS_QUERY_KEY;

const DEFAULT_SETTINGS: AdPolicySettings = {
  enabled: true,
  hideForLoggedInUsers: true,
  showAdFreeLoginBanner: true,
  placements: defaultAdPlacements(),
};

async function fetchAdsSettings(): Promise<AdPolicySettings> {
  const res = await fetch('/api/site-settings/ads');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return DEFAULT_SETTINGS;
  return {
    enabled: data.enabled !== false,
    hideForLoggedInUsers: data.hideForLoggedInUsers !== false,
    showAdFreeLoginBanner: data.showAdFreeLoginBanner !== false,
    placements: {
      ...DEFAULT_SETTINGS.placements,
      ...(data.placements && typeof data.placements === 'object'
        ? data.placements
        : {}),
    },
  };
}

export function useAdsSettings() {
  const query = useQuery({
    queryKey: ADS_SETTINGS_QUERY_KEY,
    queryFn: fetchAdsSettings,
    staleTime: 60_000,
  });

  const settings = query.data ?? DEFAULT_SETTINGS;

  return {
    settings,
    isLoading: query.isLoading,
  };
}

export function useAdPlacementVisible(placement: AdPlacementId) {
  const { settings, isLoading } = useAdsSettings();
  const user = useUserStore((s) => s.user);

  const visible = useMemo(() => {
    if (isLoading) return true;
    return isPlacementVisible(settings, placement, {
      isLoggedIn: Boolean(user),
      userAdsHidden: user?.adsHidden === true,
    });
  }, [isLoading, settings, placement, user]);

  return { visible, isLoading };
}

/**
 * Whether to reserve grid/header space for an ad.
 * Localhost always previews placeholders; production waits for policy and respects toggles.
 */
export function useReserveAdSlot(placement: AdPlacementId, requested: boolean) {
  const { visible, isLoading: policyLoading } = useAdPlacementVisible(placement);
  const mode = useAdMode();
  const devPreview = mode !== 'live';

  const reserve = useMemo(() => {
    if (!requested) return false;
    if (devPreview) return true;
    return policyLoading || visible;
  }, [requested, devPreview, policyLoading, visible]);

  return reserve;
}
