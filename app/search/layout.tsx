/**
 * Search page layout - SEO metadata
 */

import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import {
  POPULAR_ANIME_KEYWORDS,
  CORE_KEYWORDS,
} from '@/constants/seo';

export const metadata: Metadata = {
  title: 'Search Anime | Browse 10,000+ Anime by Genre',
  description: `Search and browse 10,000+ anime free. Filter by genre, type, season. One Piece, Naruto, Jujutsu Kaisen, Demon Slayer and more.`,
  keywords: [
    'search anime',
    'anime filter',
    'browse anime',
    'anime village',
    ...POPULAR_ANIME_KEYWORDS.slice(0, 15),
    ...CORE_KEYWORDS.slice(0, 8),
  ],
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
