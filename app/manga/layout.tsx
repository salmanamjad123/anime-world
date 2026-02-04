/**
 * Manga Layout
 * Shared layout for manga section
 */

import type { Metadata } from 'next';
import { SITE_NAME } from '@/constants/site';

export const metadata: Metadata = {
  title: `Manga | ${SITE_NAME}`,
  description: `Read manga online free. Discover trending and popular manga. Fast loading chapters.`,
};

export default function MangaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
