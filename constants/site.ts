/**
 * Site configuration for SEO and metadata
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://animevillage.org');

export const SITE_NAME = 'Anime Village';
export const SITE_DESCRIPTION =
  'Stream thousands of anime series free with English sub and dub. One Piece, Naruto, Jujutsu Kaisen, Demon Slayer, Dragon Ball and more. Best free anime streaming site.';
