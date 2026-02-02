/**
 * Filter Page
 * Browse anime by filters (Type, Status, Genre, Season, Year, Sort).
 * Anime results shown below the filter section.
 */

'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { FilterSection } from '@/components/search/FilterSection';
import { useSearchAnime } from '@/hooks/useAnime';
import { Filter, X } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import type { AnimeFilters } from '@/types';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<AnimeFilters>({
    search: '',
    genres: [],
    sort: 'POPULARITY_DESC',
  });

  // Initialize filters from URL params on mount (e.g. from sidebar links)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    const format = searchParams.get('format') as AnimeFilters['format'] | null;
    const genres = searchParams.get('genres')?.split(',').filter(Boolean);
    const sort = searchParams.get('sort') as AnimeFilters['sort'] | null;
    if (format || genres?.length || sort) {
      hasInitialized.current = true;
      setFilters((prev) => ({
        ...prev,
        ...(format && { format }),
        ...(genres?.length && { genres }),
        ...(sort && { sort }),
      }));
    }
  }, [searchParams]);

  const { data, isLoading } = useSearchAnime(filters, 1, 30);

  const results = data?.data?.Page?.media || [];
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
      sort: 'POPULARITY_DESC',
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400">
          <Link href={ROUTES.HOME} className="hover:text-blue-400 transition-colors">
            Home
          </Link>
          <span className="mx-2">•</span>
          <span className="text-gray-300">Filter</span>
        </nav>

        {/* Page header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">Filter Anime</h1>
          <p className="text-gray-400 text-sm sm:text-base">Browse by type, genre, season and more</p>
        </div>

        {/* Filter toggle (mobile) + Clear */}
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

        {/* Filter Section - shared design desktop & mobile */}
        {showFilters && (
          <div className="mb-6 sm:mb-8">
            <FilterSection
              filters={filters}
              onFiltersChange={setFilters}
              onApply={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Filter Results header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-blue-400">Filter Results</h2>
          {!isLoading && (
            <span className="text-gray-400 text-xs sm:text-sm">{totalResults} results</span>
          )}
        </div>

        {/* Results Grid - always show based on current filters */}
        <AnimeGrid anime={results} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
