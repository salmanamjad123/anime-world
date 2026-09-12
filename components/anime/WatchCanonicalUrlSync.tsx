'use client';

import { useEffect } from 'react';
import { isAniListNumericId } from '@/lib/seo/anime-path';
import { ROUTES } from '@/constants/routes';

/**
 * Canonicalize /watch/{slug}/… → /watch/{anilistId}/… without remounting the page.
 * Uses history.replaceState so the VideoPlayer is not torn down (avoids AbortError).
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
    const id = anilistId != null ? String(anilistId) : '';
    if (!id || !isAniListNumericId(id)) return;
    if (routeAnimeId === id) return;

    const canonical = ROUTES.WATCH(id, episodeId);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === canonical) return;

    window.history.replaceState(window.history.state, '', canonical);
  }, [routeAnimeId, anilistId, episodeId]);

  return null;
}
