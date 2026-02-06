/**
 * Filter Page
 * Browse anime by filters (Type, Status, Genre, Season, Year, Sort).
 * Server component passes URL params to client for crawler-ready initial render.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { SearchPageContent } from './SearchPageClient';
import { SITE_URL, SITE_NAME } from '@/constants/site';
import type { AnimeFilters } from '@/types';

function parseFiltersFromParams(params: Record<string, string | string[] | undefined>): AnimeFilters {
  const format = (typeof params.format === 'string' ? params.format : null) as AnimeFilters['format'] | null;
  const genresParam = typeof params.genres === 'string' ? params.genres : Array.isArray(params.genres) ? params.genres[0] : '';
  const genres = genresParam ? genresParam.split(',').filter(Boolean) : [];
  const sort = (typeof params.sort === 'string' ? params.sort : null) as AnimeFilters['sort'] | null;
  const search = (typeof params.search === 'string' ? params.search : typeof params.q === 'string' ? params.q : '') || '';
  const status = (typeof params.status === 'string' ? params.status : null) as AnimeFilters['status'] | null;
  const season = (typeof params.season === 'string' ? params.season : null) as AnimeFilters['season'] | null;
  const year = typeof params.year === 'string' ? parseInt(params.year, 10) : undefined;

  return {
    search: search || undefined,
    genres: genres.length ? genres : undefined,
    format: format || undefined,
    status: status || undefined,
    season: season || undefined,
    year: Number.isNaN(year) ? undefined : year,
    sort: sort || 'POPULARITY_DESC',
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const search = (typeof params.search === 'string' ? params.search : typeof params.q === 'string' ? params.q : '') || '';
  const url = `${SITE_URL}/search${search ? `?search=${encodeURIComponent(search)}` : ''}`;

  if (search) {
    const title = `Watch ${search} Online Free`;
    const description = `Search and watch ${search} online free. Stream ${search} with sub and dub on ${SITE_NAME}.`;
    return {
      title,
      description,
      openGraph: { title, description, url },
      alternates: { canonical: url },
    };
  }

  return {
    title: 'Search Anime - Filter by Genre, Type, Season',
    description: `Search and browse 10,000+ anime free. Filter by genre, type, season.`,
    alternates: { canonical: url },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialFilters = parseFiltersFromParams(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900">
          <Header />
          <div className="container mx-auto px-4 py-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          </div>
        </div>
      }
    >
      <SearchPageContent initialFilters={initialFilters} />
    </Suspense>
  );
}
