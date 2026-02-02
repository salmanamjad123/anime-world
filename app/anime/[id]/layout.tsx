/**
 * Anime Detail Layout - Dynamic SEO metadata per anime
 */

import type { Metadata } from 'next';
import { cache } from 'react';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import { getPreferredTitle, stripHtml } from '@/lib/utils';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import type { Anime } from '@/types';

function isAniListId(id: string): boolean {
  return /^\d+$/.test(id);
}

const getAnimeForMetadata = cache(async (id: string): Promise<Anime | null> => {
  try {
    if (isAniListId(id)) {
      const result = await getAnimeById(id);
      return result?.data?.Media ?? null;
    }
    const info = await getHiAnimeInfo(id);
    if (!info) return null;
    const poster =
      typeof info.poster === 'string' && info.poster.trim().startsWith('http')
        ? info.poster.trim()
        : undefined;
    return {
      id: info.id,
      title: { romaji: info.name, english: info.name, native: info.name ?? '' },
      description: info.description ?? undefined,
      coverImage: {
        large: poster ?? '',
        medium: poster ?? '',
        extraLarge: poster ?? '',
      },
      bannerImage: poster,
      genres: Array.isArray(info.genres) ? info.genres : [],
      averageScore: undefined,
      status: undefined,
      seasonYear: undefined,
      episodes: undefined,
      duration: undefined,
      format: undefined,
      studios: undefined,
    };
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
  const anime = await getAnimeForMetadata(id);
  if (!anime) {
    return {
      title: 'Anime Not Found',
    };
  }

  const title = getPreferredTitle(anime.title);
  const description = anime.description
    ? stripHtml(anime.description).slice(0, 160)
    : `Watch ${title} online free - like Aniwatch, Anilab, HiAnime. Stream ${title} episodes with sub and dub on ${SITE_NAME}.`;
  const canonicalUrl = `${SITE_URL}/anime/${id}`;
  const image =
    anime.bannerImage ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    `${SITE_URL}/opengraph-image`;

  return {
    title: `Watch ${title} Online Free`,
    description,
    keywords: [
      title,
      `watch ${title}`,
      `${title} online`,
      `${title} episodes`,
      `${title} sub`,
      `${title} dub`,
      ...(anime.genres || []),
    ],
    openGraph: {
      title: `Watch ${title} Online Free | ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Watch ${title} Online Free | ${SITE_NAME}`,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function buildAnimeJsonLd(anime: Anime, id: string) {
  const title = getPreferredTitle(anime.title);
  const description = anime.description
    ? stripHtml(anime.description).slice(0, 200)
    : `Watch ${title} online free.`;
  const image =
    anime.bannerImage ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large;
  const url = `${SITE_URL}/anime/${id}`;

  const tvSeries = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: title,
    description,
    image: image ? [image] : undefined,
    url,
    genre: anime.genres || [],
    aggregateRating: anime.averageScore
      ? {
          '@type': 'AggregateRating',
          ratingValue: (anime.averageScore / 10).toFixed(1),
          bestRating: '10',
          ratingCount: 1,
        }
      : undefined,
    numberOfEpisodes: anime.episodes,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Anime', item: `${SITE_URL}/search` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  };

  return [tvSeries, breadcrumb];
}

export default async function AnimeDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anime = await getAnimeForMetadata(id);

  return (
    <>
      {anime &&
        buildAnimeJsonLd(anime, id).map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      {children}
    </>
  );
}
