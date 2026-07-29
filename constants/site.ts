/**
 * Site configuration for SEO and metadata
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://animevillage.org');

export const SITE_NAME = 'Anime Village';

/** SERP / Open Graph description — keep under ~160 chars */
export const SITE_DESCRIPTION =
  'Watch anime online free on Anime Village. Stream thousands of series with English subtitles and dub — One Piece, Naruto, Jujutsu Kaisen, Demon Slayer and more.';

export const SITE_TITLE_DEFAULT =
  'Anime Village — Watch Anime Online Free (Sub & Dub)';

/** Social profiles (footer + Organization sameAs) */
export const SOCIAL_INSTAGRAM_URL =
  'https://www.instagram.com/animevillage_org/';
export const SOCIAL_TIKTOK_URL = 'https://www.tiktok.com/@animevillage.org';
export const SOCIAL_LINKS = [SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL] as const;
