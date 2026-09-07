'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { FilterSection } from '@/components/search/FilterSection';
import { useSearchAnime } from '@/hooks/useAnime';
import { Filter, X } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import type { AnimeFilters } from '@/types';

const DEFAULT_FILTERS: AnimeFilters = {
  search: '',
  genres: [],
  sort: 'POPULARITY_DESC',
};

export function SearchPageContent({ initialFilters }: { initialFilters: AnimeFilters }) {
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<AnimeFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
    search: initialFilters.search ?? '',
    genres: initialFilters.genres ?? [],
    format: initialFilters.format,
    status: initialFilters.status,
    season: initialFilters.season,
    year: initialFilters.year,
    sort: initialFilters.sort ?? 'POPULARITY_DESC',
  }));

  // Sync filters when URL changes (client-side navigation)
  useEffect(() => {
    const format = searchParams.get('format') as AnimeFilters['format'] | null;
    const genres = searchParams.get('genres')?.split(',').filter(Boolean);
    const sort = searchParams.get('sort') as AnimeFilters['sort'] | null;
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const status = searchParams.get('status') as AnimeFilters['status'] | null;
    const season = searchParams.get('season') as AnimeFilters['season'] | null;
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    setFilters((prev) => ({
      ...prev,
      ...(format !== null && { format: format || undefined }),
      ...(genres?.length && { genres }),
      ...(sort && { sort }),
      ...(search && { search }),
      ...(status !== null && { status: status || undefined }),
      ...(season !== null && { season: season || undefined }),
      ...(year !== undefined && !Number.isNaN(year) && { year }),
    }));
  }, [searchParams]);

  const { data, isLoading } = useSearchAnime(filters, 1, 30);

  // Filter out hentai results for safer search listings
  const allResults = data?.data?.Page?.media || [];
  const results = allResults.filter((item) => {
    const hasHentaiGenre = item.genres?.includes('Hentai');
    const hasHentaiTag = item.tags?.some((tag) =>
      tag.name.toLowerCase().includes('hentai')
    );
    return !hasHentaiGenre && !hasHentaiTag;
  });
  const totalResults = data?.data?.Page?.pageInfo?.total ?? 0;
  const hasActiveFilters =
    (filters.genres && filters.genres.length > 0) ||
    filters.format ||
    filters.status ||
    filters.season ||
    filters.year;

  const clearFilters = () => {
    setFilters({
      search: '',
      genres: [],
      format: undefined,
      status: undefined,
      season: undefined,
      year: undefined,
      sort: 'POPULARITY_DESC',
    });
  };

  const pageTitle = filters.search
    ? `Search: ${filters.search}`
    : 'Filter Anime';
  const pageDescription = filters.search
    ? `Watch ${filters.search} online free. ${totalResults} results.`
    : 'Browse by type, genre, season and more';

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <nav className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400">
          <Link href={ROUTES.HOME} className="hover:text-blue-400 transition-colors">
            Home
          </Link>
          <span className="mx-2">•</span>
          <span className="text-gray-300">{filters.search ? 'Search' : 'Filter'}</span>
        </nav>

        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">{pageTitle}</h1>
          <p className="text-gray-400 text-sm sm:text-base">{pageDescription}</p>
        </div>

        <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Filter className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            Filters
            {filters.genres?.length ? (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/80 text-xs">
                {filters.genres.length}
              </span>
            ) : null}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Clear All
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mb-6 sm:mb-8">
            <FilterSection
              filters={filters}
              onFiltersChange={setFilters}
              onApply={() => setShowFilters(false)}
            />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-blue-400">Results</h2>
          {!isLoading && (
            <span className="text-gray-400 text-xs sm:text-sm">{totalResults} results</span>
          )}
        </div>

        <AnimeGrid anime={results} isLoading={isLoading} />
      </div>
    </div>
  );
}
