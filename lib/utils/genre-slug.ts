/**
 * Genre slug <-> name mapping for SEO-friendly URLs
 */

import { GENRES } from '@/constants/genres';

export function genreToSlug(genre: string): string {
  return genre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function slugToGenre(slug: string): string | null {
  const normalized = slug.toLowerCase();
  const found = GENRES.find(
    (g) => genreToSlug(g) === normalized || g.toLowerCase() === normalized
  );
  return found ?? null;
}

export const GENRE_SLUGS = GENRES.map((g) => genreToSlug(g));
