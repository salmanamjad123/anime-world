'use client';

import { useEffect } from 'react';
import {
  ADSTERRA_SOCIAL_SRC,
  canShowSocialBar,
  markSocialBarShown,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';
import type { AdPlacementId } from '@/lib/ads-placements';

const SOCIAL_SCRIPT_ATTR = 'data-av-social-bar';

function removeSocialBarArtifacts() {
  document
    .querySelectorAll(`script[${SOCIAL_SCRIPT_ATTR}], script[src*="bauval.org"]`)
    .forEach((el) => el.remove());
  document.querySelectorAll('iframe[src*="bauval.org"]').forEach((el) => el.remove());
}

/**
 * Adsterra social bar, at most once every 2 hours (shared manga + watch cooldown).
 * Removed on unmount so it does not stay on other sections.
 */
export function AdsterraSocialBar({ placement }: { placement: AdPlacementId }) {
  const mode = useAdMode();
  const { visible, isLoading } = useAdPlacementVisible(placement);

  useEffect(() => {
    if (isLoading || mode !== 'live' || !visible || !ADSTERRA_SOCIAL_SRC) return;
    if (!canShowSocialBar()) return;

    const added: Node[] = [];
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => added.push(node));
      }
    });
    observer.observe(document.body, { childList: true });

    const script = document.createElement('script');
    script.src = ADSTERRA_SOCIAL_SRC;
    script.async = true;
    script.dataset.cfasync = 'false';
    script.setAttribute(SOCIAL_SCRIPT_ATTR, '1');
    document.body.appendChild(script);
    markSocialBarShown();

    return () => {
      observer.disconnect();
      script.remove();
      added.forEach((node) => {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      removeSocialBarArtifacts();
    };
  }, [isLoading, mode, visible, placement]);

  return null;
}

export function MangaSocialBar() {
  return <AdsterraSocialBar placement="manga_social_bar" />;
}

export function WatchSocialBar() {
  return <AdsterraSocialBar placement="watch_social_bar" />;
}
