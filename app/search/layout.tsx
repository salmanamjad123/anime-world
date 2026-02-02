/**
 * Search page layout - SEO metadata
 */

import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/constants/site';

export const metadata: Metadata = {
  title: 'Search Anime - Aniwatch, Anilab, HiAnime Style | Filter by Genre',
  description: `Search 10000+ anime free. Like Aniwatch, Anilab, HiAnime. Filter by genre, type, season. One Piece, Naruto, JJK, Demon Slayer & more.`,
  keywords: ['search anime', 'anime filter', 'browse anime', 'aniwatch', 'anilab', 'hianime'],
  openGraph: {
    title: `Search Anime | ${SITE_NAME}`,
    url: `${SITE_URL}/search`,
  },
  alternates: {
    canonical: `${SITE_URL}/search`,
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
