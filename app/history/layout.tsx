/**
 * History page layout - SEO metadata
 */

import type { Metadata } from 'next';
import { SITE_NAME } from '@/constants/site';

export const metadata: Metadata = {
  title: 'Continue Watching',
  description: `Resume where you left off on ${SITE_NAME}.`,
  robots: { index: false, follow: true },
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
