'use client';

import { useAdsSettings } from '@/hooks/useAdsSettings';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useUserStore } from '@/store/useUserStore';

/** Guest-only one-line nudge: log in for ad-free. */
export function AdFreeLoginBanner() {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  const openAuthModal = useAuthModalStore((s) => s.openAuthModal);
  const { settings, isLoading: settingsLoading } = useAdsSettings();

  if (isLoading || settingsLoading || user || !settings.showAdFreeLoginBanner) {
    return null;
  }

  return (
    <p className="mb-3 text-sm text-gray-400">
      Guests see ads.{' '}
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className="font-medium text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline"
      >
        Log in to watch ad-free
      </button>
    </p>
  );
}
