/**
 * Shared route resolution for /anime/{segment} API handlers.
 */

import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import { attachSlugToAnime } from '@/lib/seo/enrich-slugs';
import { enrichAnimeImagesFromAnilist } from '@/lib/seo/enrich-anilist-images';
import { resolveAnimeRouteTarget } from '@/lib/seo/anime-slug';
import type { Anime } from '@/types';
import type { HiAnimeInfo } from '@/lib/api/hianime';

export async function fetchAnimeByRouteSegment(
  segment: string,
  mapHiAnime: (info: HiAnimeInfo) => Anime
): Promise<Anime | null> {
  const target = await resolveAnimeRouteTarget(segment);

  if (target.type === 'anilist') {
    const result = await getAnimeById(target.anilistId);
    const media = result?.data?.Media;
    if (!media) return null;
    return attachSlugToAnime(media, { allowLookup: false });
  }

  try {
    const info = await getHiAnimeInfo(target.slug);
    const mapped = mapHiAnime(info);
    return enrichAnimeImagesFromAnilist(mapped, { hiAnimeSlug: target.slug, force: true });
  } catch {
    return null;
  }
}

export async function resolveAnilistIdForRoute(segment: string): Promise<string | null> {
  const target = await resolveAnimeRouteTarget(segment);
  return target.type === 'anilist' ? target.anilistId : null;
}
