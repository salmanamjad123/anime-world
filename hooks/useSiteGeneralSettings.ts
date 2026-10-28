'use client';

import { useQuery } from '@tanstack/react-query';

export const SITE_GENERAL_QUERY_KEY = ['site-settings', 'general'] as const;

export type SiteGeneralPublic = {
  showMirrorLink: boolean;
};

const DEFAULTS: SiteGeneralPublic = { showMirrorLink: true };

async function fetchGeneral(): Promise<SiteGeneralPublic> {
  const res = await fetch('/api/site-settings/general', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return DEFAULTS;
  return {
    showMirrorLink: data.showMirrorLink !== false,
  };
}

export function useSiteGeneralSettings() {
  const query = useQuery({
    queryKey: SITE_GENERAL_QUERY_KEY,
    queryFn: fetchGeneral,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });

  return {
    settings: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
  };
}

export function useShowMirrorLink() {
  const { settings, isLoading } = useSiteGeneralSettings();
  return { show: settings.showMirrorLink, isLoading };
}
