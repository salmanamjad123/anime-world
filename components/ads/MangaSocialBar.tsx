'use client';

import { useEffect } from 'react';
import {
  ADSTERRA_SOCIAL_SRC,
  canShowMangaSocialBar,
  markMangaSocialBarShown,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';

const SOCIAL_SCRIPT_ATTR = 'data-av-manga-social';

function removeSocialBarArtifacts() {
  document
    .querySelectorAll(`script[${SOCIAL_SCRIPT_ATTR}], script[src*="bauval.org"]`)
    .forEach((el) => el.remove());
  document.querySelectorAll('iframe[src*="bauval.org"]').forEach((el) => el.remove());
}

/**
 * Manga routes only: inject Adsterra social bar at most once every 2 hours.
 * Removed when leaving /manga so it never stays on anime pages.
 */
export function MangaSocialBar() {
  const mode = useAdMode();
  const { visible, isLoading } = useAdPlacementVisible('manga_social_bar');

  useEffect(() => {
    if (isLoading || mode !== 'live' || !visible || !ADSTERRA_SOCIAL_SRC) return;
    if (!canShowMangaSocialBar()) return;

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
    markMangaSocialBarShown();

    return () => {
      observer.disconnect();
      script.remove();
      added.forEach((node) => {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      removeSocialBarArtifacts();
    };
  }, [isLoading, mode, visible]);

  return null;
}
