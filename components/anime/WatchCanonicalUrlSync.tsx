'use client';

import { useEffect } from 'react';
import { isAniListNumericId } from '@/lib/seo/anime-path';
import { ROUTES } from '@/constants/routes';

/**
 * Canonicalize watch URLs without remounting the player:
 * - /watch/{slug}/… → /watch/{anilistId}/…
 * - ?ep=123 query → encoded path (%3Fep%3D) used by in-app links
 */
export function WatchCanonicalUrlSync({
  routeAnimeId,
  anilistId,
  episodeId,
}: {
  routeAnimeId: string;
  anilistId?: string | number | null;
  episodeId: string;
}) {
  useEffect(() => {
    if (!episodeId) return;
    const numeric =
      anilistId != null && isAniListNumericId(String(anilistId))
        ? String(anilistId)
        : isAniListNumericId(routeAnimeId)
          ? routeAnimeId
          : '';
    if (!numeric) return;

    const canonicalPath = ROUTES.WATCH(numeric, episodeId);
    const t = new URLSearchParams(window.location.search).get('t');
    const next = t ? `${canonicalPath}?t=${encodeURIComponent(t)}` : canonicalPath;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) return;

    window.history.replaceState(window.history.state, '', next);
  }, [routeAnimeId, anilistId, episodeId]);

  return null;
}
