/**
 * Manga Detail Layout - Dynamic SEO metadata
 */

import type { Metadata } from 'next';
import { cache } from 'react';
import { getMangaById } from '@/lib/api/anilist-manga';
import { getPreferredTitle, stripHtml } from '@/lib/utils';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import type { Manga } from '@/types';

const getMangaForMetadata = cache(async (id: string): Promise<Manga | null> => {
  try {
    const result = await getMangaById(id);
    return result?.data?.Media ?? null;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const manga = await getMangaForMetadata(id);
  if (!manga) {
    return { title: 'Manga Not Found' };
  }

  const title = getPreferredTitle(manga.title);
  const description = manga.description
    ? stripHtml(manga.description).slice(0, 160)
    : `Read ${title} manga online free. ${manga.chapters || '?'} chapters on ${SITE_NAME}.`;
  const canonicalUrl = `${SITE_URL}/manga/${id}`;
  const image =
    manga.bannerImage ||
    manga.coverImage?.extraLarge ||
    manga.coverImage?.large ||
    undefined;

  return {
    title: `${title} | Manga`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} | Manga | ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      type: 'website',
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Manga`,
      description,
    },
  };
}

export default function MangaDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
