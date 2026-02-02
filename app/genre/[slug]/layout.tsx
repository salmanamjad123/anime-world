/**
 * Genre page layout - Dynamic SEO metadata per genre
 */

import type { Metadata } from 'next';
import { slugToGenre, genreToSlug } from '@/lib/utils/genre-slug';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import { GENRES } from '@/constants/genres';

export async function generateStaticParams() {
  return GENRES.map((g) => ({ slug: genreToSlug(g) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = slugToGenre(slug);
  if (!genre) return { title: 'Genre Not Found' };

  const title = `${genre} Anime`;
  const description = `Watch ${genre} anime online free. Stream the best ${genre.toLowerCase()} anime series with sub and dub on ${SITE_NAME}.`;
  const url = `${SITE_URL}/genre/${slug}`;

  return {
    title: `Watch ${title} Online Free`,
    description,
    keywords: [
      `${genre} anime`,
      `watch ${genre} anime`,
      `${genre.toLowerCase()} anime online`,
      `${genre} anime list`,
      `best ${genre} anime`,
    ],
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
    },
    alternates: { canonical: url },
  };
}

export default function GenreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
