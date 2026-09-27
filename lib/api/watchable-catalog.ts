import type { Anime, AnimeSearchResult, AnimeStatus } from '@/types';

/** Catalog/home lists should only show titles users can actually watch. */
export const WATCHABLE_CATALOG_STATUSES: AnimeStatus[] = [
  'RELEASING',
  'FINISHED',
  'HIATUS',
];

export function isWatchableCatalogAnime(anime: {
  status?: string | null;
}): boolean {
  if (!anime.status) return true;
  return WATCHABLE_CATALOG_STATUSES.includes(anime.status as AnimeStatus);
}

export function filterWatchableCatalog<T extends { status?: string | null }>(
  items: T[]
): T[] {
  return items.filter(isWatchableCatalogAnime);
}

export function keepWatchableSearchResult(
  result: AnimeSearchResult
): AnimeSearchResult {
  const media = result?.data?.Page?.media ?? [];
  const filtered = filterWatchableCatalog(media) as Anime[];
  if (filtered.length === media.length) return result;

  return {
    ...result,
    data: {
      ...result.data,
      Page: {
        ...result.data.Page,
        media: filtered,
      },
    },
  };
}
