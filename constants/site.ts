/**
 * Site configuration for SEO and metadata
 */

import { IS_GAME_ARENA_ONLY } from '@/constants/site-mode';

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://animevillage.org');

export const SITE_NAME = IS_GAME_ARENA_ONLY ? 'Village Arena' : 'Anime Village';

/** SERP / Open Graph description — keep under ~160 chars */
export const SITE_DESCRIPTION = IS_GAME_ARENA_ONLY
  ? 'Village Arena — original 3v3 fighter duels. Ranked Forge, Quick Duel, and Private Gate.'
  : 'Watch anime online free on Anime Village. Stream thousands of series with English subtitles and dub — One Piece, Naruto, Jujutsu Kaisen, Demon Slayer and more.';

export const SITE_TITLE_DEFAULT = IS_GAME_ARENA_ONLY
  ? 'Village Arena — 3v3 Fighter Duels'
  : 'Anime Village — Watch Anime Online Free (Sub & Dub)';

/** Social profiles (footer + Organization sameAs) */
export const SOCIAL_INSTAGRAM_URL =
  'https://www.instagram.com/animevillage_org/';
export const SOCIAL_TIKTOK_URL = 'https://www.tiktok.com/@animevillage.org';
export const SOCIAL_LINKS = [SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL] as const;

/** Mirror / alternate site (admin can hide links site-wide) */
export const MIRROR_SITE_URL = 'https://www.animevillage.my';
export const MIRROR_SITE_LABEL = 'animevillage.my';
