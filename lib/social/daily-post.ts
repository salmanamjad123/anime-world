/**
 * Build a ready-to-copy Instagram / TikTok post from trending anime.
 */

import { getTrendingAnime } from '@/lib/api/anilist';
import { getPreferredTitle, stripHtml } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { SITE_NAME, SITE_URL } from '@/constants/site';
import type { Anime } from '@/types';

export type DailySocialPost = {
  animeId: string;
  title: string;
  score: string | null;
  genres: string[];
  synopsis: string;
  coverImage: string | null;
  pageUrl: string;
  caption: string;
  hashtags: string;
};

function dayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

function buildHashtags(title: string, genres: string[]): string {
  const slug = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join('');

  const genreTags = genres
    .slice(0, 3)
    .map((g) => `#${g.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter((t) => t.length > 1);

  return [
    `#${slug || 'Anime'}`,
    '#Anime',
    '#AnimeVillage',
    '#WatchAnime',
    '#AnimeTok',
    ...genreTags,
  ].join(' ');
}

export function buildCaption(anime: Anime, pageUrl: string): string {
  const title = getPreferredTitle(anime.title);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const genres = (anime.genres || []).slice(0, 3).join(' · ');
  const blurb = anime.description
    ? stripHtml(anime.description).slice(0, 140).trim()
    : 'Stream it free in sub and dub.';

  const lines = [
    `🔥 Trending now: ${title}`,
    score ? `⭐ ${score}/10${genres ? ` · ${genres}` : ''}` : genres || null,
    '',
    blurb.endsWith('.') ? blurb : `${blurb}...`,
    '',
    `▶ Watch free on ${SITE_NAME}`,
    pageUrl,
    '',
    buildHashtags(title, anime.genres || []),
  ];

  return lines.filter((line) => line !== null).join('\n');
}

export async function createDailySocialPost(
  date = new Date()
): Promise<DailySocialPost> {
  const result = await getTrendingAnime(1, 12);
  const media = result?.data?.Page?.media || [];

  if (!media.length) {
    throw new Error('No trending anime available for social post');
  }

  const anime = media[dayOfYear(date) % media.length];
  const title = getPreferredTitle(anime.title);
  const pageUrl = `${SITE_URL.replace(/\/$/, '')}${ROUTES.ANIME_DETAIL(String(anime.id))}`;

  return {
    animeId: String(anime.id),
    title,
    score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null,
    genres: anime.genres || [],
    synopsis: anime.description ? stripHtml(anime.description).slice(0, 280) : '',
    coverImage: anime.coverImage?.extraLarge || anime.coverImage?.large || null,
    pageUrl,
    caption: buildCaption(anime, pageUrl),
    hashtags: buildHashtags(title, anime.genres || []),
  };
}
