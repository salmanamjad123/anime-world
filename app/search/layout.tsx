/**
 * Search page layout - SEO metadata only (no visible copy changes)
 */

import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import {
  POPULAR_ANIME_KEYWORDS,
  CORE_KEYWORDS,
} from '@/constants/seo';

const SEARCH_TITLE = 'Search Anime Online Free | Browse by Genre & Title';
const SEARCH_DESCRIPTION = `Search anime online free on ${SITE_NAME}. Browse by genre, type, or season — English sub and dub. Find One Piece, Naruto, Jujutsu Kaisen and more.`;

export const metadata: Metadata = {
  title: SEARCH_TITLE,
  description: SEARCH_DESCRIPTION,
  keywords: [
    'search anime',
    'browse anime online free',
    'anime filter',
    'anime by genre',
    'anime village',
    ...POPULAR_ANIME_KEYWORDS.slice(0, 15),
    ...CORE_KEYWORDS.slice(0, 8),
  ],
  openGraph: {
    title: `${SEARCH_TITLE} | ${SITE_NAME}`,
    description: SEARCH_DESCRIPTION,
    url: `${SITE_URL}/search`,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SEARCH_TITLE} | ${SITE_NAME}`,
    description: SEARCH_DESCRIPTION,
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
