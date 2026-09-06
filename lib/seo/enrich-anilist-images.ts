/**
 * Merge AniList cover/banner onto HiAnime-only anime when scraped CDN posters fail or are low-quality.
 */

import { searchAnilistMediaByTitle } from '@/lib/api/anilist';
import { saveAnimeSlugMapping, titleToSeoSlug } from '@/lib/seo/anime-slug';
import { ANIME_PLACEHOLDER, isUnreliableImageCdn } from '@/lib/utils/image-url';
import type { Anime } from '@/types';

function pickAnilistImageMatch(candidates: Anime[], title: string): Anime | null {
  if (!candidates.length) return null;

  const targetSlug = titleToSeoSlug(title);
  const exact = candidates.find((c) => {
    const names = [c.title.english, c.title.romaji, c.title.native].filter(Boolean);
    return names.some((n) => titleToSeoSlug(n!) === targetSlug);
  });
  if (exact) return exact;

  const partial = candidates.find((c) => {
    const names = [c.title.english, c.title.romaji].filter(Boolean) as string[];
    return names.some((n) => {
      const slug = titleToSeoSlug(n);
      return slug.includes(targetSlug) || targetSlug.includes(slug);
    });
  });
  return partial ?? candidates[0] ?? null;
}

function needsImageEnrichment(anime: Pick<Anime, 'coverImage' | 'bannerImage'>): boolean {
  const cover = anime.coverImage?.large ?? '';
  if (!cover || cover === ANIME_PLACEHOLDER) return true;
  if (isUnreliableImageCdn(cover)) return true;

  const banner = anime.bannerImage ?? '';
  if (!banner || banner === ANIME_PLACEHOLDER) return true;
  if (isUnreliableImageCdn(banner)) return true;

  return false;
}

/**
 * When HiAnime poster CDN is blocked or missing, attach AniList artwork and link ids.
 */
export async function enrichAnimeImagesFromAnilist(
  anime: Anime,
  options?: { hiAnimeSlug?: string; force?: boolean }
): Promise<Anime> {
  if (!options?.force && !needsImageEnrichment(anime)) return anime;

  const title =
    anime.title?.english || anime.title?.romaji || anime.title?.native || '';
  if (!title.trim()) return anime;

  try {
    const results = await searchAnilistMediaByTitle(title, 8);
    const match = pickAnilistImageMatch(results, title);
    if (!match?.coverImage?.large) return anime;

    const anilistId = String(match.id);
    const hiAnimeSlug = options?.hiAnimeSlug ?? anime.slug ?? undefined;

    if (hiAnimeSlug && hiAnimeSlug !== anilistId) {
      await saveAnimeSlugMapping(anilistId, hiAnimeSlug);
    }

    return {
      ...anime,
      id: anilistId,
      slug: hiAnimeSlug ?? anime.slug ?? anilistId,
      coverImage: {
        large: match.coverImage.large,
        medium: match.coverImage.medium || match.coverImage.large,
        extraLarge: match.coverImage.extraLarge || match.coverImage.large,
      },
      bannerImage: match.bannerImage || match.coverImage.extraLarge || match.coverImage.large,
      averageScore: anime.averageScore ?? match.averageScore,
      seasonYear: anime.seasonYear ?? match.seasonYear,
      episodes: anime.episodes ?? match.episodes,
      status: anime.status ?? match.status,
      format: anime.format ?? match.format,
    };
  } catch {
    return anime;
  }
}
