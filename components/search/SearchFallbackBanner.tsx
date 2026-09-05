import type { AnimeSearchFallbackSource } from '@/types';

const MESSAGES: Record<AnimeSearchFallbackSource, string> = {
  'hianime-genre':
    'AniList is temporarily unavailable. Showing similar anime from our catalog — genre matching may be approximate.',
  'hianime-search':
    'AniList is temporarily unavailable. Showing search results from our catalog.',
  'hianime-browse':
    'AniList is temporarily unavailable. Showing popular anime until filters can be applied again.',
};

export function SearchFallbackBanner({
  source,
}: {
  source?: AnimeSearchFallbackSource;
}) {
  if (!source) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
    >
      {MESSAGES[source]}
    </div>
  );
}
