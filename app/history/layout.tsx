/**
 * History page layout - SEO metadata
 */

import type { Metadata } from 'next';
import { SITE_NAME } from '@/constants/site';

export const metadata: Metadata = {
  title: 'Watch History',
  description: `Your anime watch history on ${SITE_NAME}. Continue watching where you left off.`,
  robots: { index: false, follow: true },
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
