/**
 * Site configuration for SEO and metadata
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://anime-world.vercel.app');

export const SITE_NAME = 'Anime World';
export const SITE_DESCRIPTION =
  'Watch anime online free - Like Aniwatch, Anilab, HiAnime. Stream 10000+ anime with sub and dub. One Piece, Naruto, JJK, Demon Slayer, Dragon Ball & more. Best free anime streaming site.';
