/**
 * Anime Detail Layout - Dynamic SEO metadata per anime
 */

import type { Metadata } from 'next';
import { cache } from 'react';
import { getAnimeById } from '@/lib/api/anilist';
import { getHiAnimeInfo } from '@/lib/api/hianime';
import { getPreferredTitle, stripHtml } from '@/lib/utils';
import { resolveAnimeImageUrl } from '@/lib/utils/image-url';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import {
  buildAnimeDetailUrl,
  isAniListNumericId,
  resolveAnimeSlug,
  resolveAnilistIdFromSegment,
  resolveAnimeRouteTarget,
} from '@/lib/seo/anime-slug';
import type { Anime } from '@/types';

const getAnimeForMetadata = cache(async (id: string): Promise<Anime | null> => {
  try {
    const target = await resolveAnimeRouteTarget(id);

    if (target.type === 'anilist') {
      const result = await getAnimeById(target.anilistId);
      return result?.data?.Media ?? null;
    }

    const info = await getHiAnimeInfo(target.slug);
    if (!info) return null;
    const poster = resolveAnimeImageUrl(info.poster);
    return {
      id: info.id,
      title: { romaji: info.name, english: info.name, native: info.name ?? '' },
      description: info.description ?? undefined,
      coverImage: {
        large: poster,
        medium: poster,
        extraLarge: poster,
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

const resolveSlugForPage = cache(
  async (id: string, anime: Anime | null): Promise<string | null> => {
    if (!anime) return null;

    const anilistId = isAniListNumericId(id)
      ? id
      : (await resolveAnilistIdFromSegment(id)) ??
        (isAniListNumericId(String(anime.id)) ? String(anime.id) : null);

    if (!anilistId) {
      return anime.slug ?? id;
    }

    return resolveAnimeSlug(anilistId, getPreferredTitle(anime.title), anime.episodes, {
      allowLookup: true,
    });
  }
);

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
  const synopsis = anime.description
    ? stripHtml(anime.description).replace(/\s+/g, ' ').trim()
    : '';
  const seoTail = `Watch ${title} online free with English sub and dub on ${SITE_NAME}.`;
  const description = synopsis
    ? `${synopsis.slice(0, 110).trim()}${synopsis.length > 110 ? '…' : ''} ${seoTail}`.slice(
        0,
        160
      )
    : seoTail;
  const pageTitle = `Watch ${title} Online Free (Sub & Dub)`;
  const slug = await resolveSlugForPage(id, anime);
  const canonicalUrl = buildAnimeDetailUrl(id, slug);
  const image =
    anime.bannerImage ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    `${SITE_URL}/opengraph-image`;

  // Title variants for alternate search terms (romaji, english, native)
  const titleVariants = [
    anime.title.english,
    anime.title.romaji,
    anime.title.native,
  ].filter((t): t is string => Boolean(t?.trim()));

  // AniList tags - high-rank tags are popular search terms
  const tagKeywords = (anime.tags || [])
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .slice(0, 10)
    .map((t) => t.name);

  return {
    title: pageTitle,
    description,
    keywords: [
      title,
      ...titleVariants.filter((t) => t !== title),
      `watch ${title}`,
      `watch ${title} online free`,
      `${title} online`,
      `${title} episodes`,
      `${title} english sub`,
      `${title} english dub`,
      `${title} sub`,
      `${title} dub`,
      ...(anime.genres || []),
      ...tagKeywords,
    ],
    openGraph: {
      title: `${pageTitle} | ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title} anime poster — watch online free on ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${pageTitle} | ${SITE_NAME}`,
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

function buildAnimeJsonLd(anime: Anime, canonicalUrl: string) {
  const title = getPreferredTitle(anime.title);
  const description = anime.description
    ? stripHtml(anime.description).slice(0, 200)
    : `Watch ${title} online free with English sub and dub on ${SITE_NAME}.`;
  const image =
    anime.bannerImage ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large;
  const url = canonicalUrl;

  const keywords = [
    ...(anime.genres || []),
    ...(anime.tags?.slice(0, 8).map((t) => t.name) || []),
    'watch anime online free',
    'anime sub',
    'anime dub',
  ].filter(Boolean);

  const tvSeries = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: title,
    alternateName: [anime.title.english, anime.title.romaji, anime.title.native].filter(
      (t): t is string => Boolean(t?.trim()) && t !== title
    ),
    description,
    image: image ? [image] : undefined,
    url,
    genre: anime.genres || [],
    ...(keywords.length > 0 && { keywords: keywords.join(', ') }),
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

  const slug = await resolveSlugForPage(id, anime);
  const canonicalUrl = anime ? buildAnimeDetailUrl(id, slug) : `${SITE_URL}/anime/${id}`;

  return (
    <>
      {anime &&
        buildAnimeJsonLd(anime, canonicalUrl).map((schema, i) => (
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
