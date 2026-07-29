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
  const pageTitle = `Watch ${genre} Anime Online Free (Sub & Dub)`;
  const description = `Watch ${genre.toLowerCase()} anime online free on ${SITE_NAME}. Stream top ${genre.toLowerCase()} series with English subtitles and dub.`;
  const url = `${SITE_URL}/genre/${slug}`;

  return {
    title: pageTitle,
    description,
    keywords: [
      `${genre} anime`,
      `watch ${genre} anime`,
      `watch ${genre} anime online free`,
      `${genre.toLowerCase()} anime online`,
      `${genre} anime list`,
      `best ${genre} anime`,
      `${genre} anime sub`,
      `${genre} anime dub`,
    ],
    openGraph: {
      title: `${pageTitle} | ${SITE_NAME}`,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${pageTitle} | ${SITE_NAME}`,
      description,
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
