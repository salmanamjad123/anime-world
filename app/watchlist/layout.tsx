/**
 * Watchlist page layout - SEO metadata
 */

import type { Metadata } from 'next';
import { SITE_NAME } from '@/constants/site';

export const metadata: Metadata = {
  title: 'My Watchlist',
  description: `Manage your anime watchlist on ${SITE_NAME}. Save anime to watch later.`,
  robots: { index: false, follow: true },
};

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
