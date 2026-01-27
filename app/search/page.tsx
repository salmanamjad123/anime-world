/**
 * Search Page
 * Search for anime with filters
 */

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { useSearchAnime } from '@/hooks/useAnime';
import { useDebounce } from '@/hooks/useDebounce';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { GENRES } from '@/constants/genres';
import type { AnimeFilters } from '@/types';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AnimeFilters>({
    search: '',
    genres: [],
    sort: 'POPULARITY_DESC',
  });

  const debouncedSearch = useDebounce(searchQuery, 500);

  // Update filters when debounced search changes
  const activeFilters = {
    ...filters,
    search: debouncedSearch,
  };

  const { data, isLoading } = useSearchAnime(
    activeFilters,
    1,
    30
  );

  const results = data?.data?.Page?.media || [];
  const hasActiveFilters = filters.genres && filters.genres.length > 0;

  const handleGenreToggle = (genre: string) => {
    setFilters((prev) => {
      const genres = prev.genres || [];
      const newGenres = genres.includes(genre)
        ? genres.filter((g) => g !== genre)
        : [...genres, genre];
      return { ...prev, genres: newGenres };
    });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      genres: [],
      sort: 'POPULARITY_DESC',
    });
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Search Anime</h1>
          <p className="text-gray-400">Find your next favorite anime</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 text-lg"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-0.5 bg-blue-500 rounded-full text-xs">
                {filters.genres?.length}
              </span>
            )}
          </Button>

          {/* Sort Dropdown */}
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value as any })}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="POPULARITY_DESC">Most Popular</option>
            <option value="SCORE_DESC">Highest Rated</option>
            <option value="TRENDING_DESC">Trending</option>
            <option value="UPDATED_AT_DESC">Recently Updated</option>
          </select>

          {(hasActiveFilters || searchQuery) && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-8 bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => {
                const isSelected = filters.genres?.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => handleGenreToggle(genre)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && (
          <div className="mb-4 text-gray-400">
            {results.length > 0 ? (
              <p>Found {data?.data?.Page?.pageInfo?.total || results.length} results</p>
            ) : searchQuery || hasActiveFilters ? (
              <p>No results found. Try different keywords or filters.</p>
            ) : (
              <p>Start typing to search for anime...</p>
            )}
          </div>
        )}

        {/* Results Grid */}
        {(searchQuery || hasActiveFilters) && (
          <AnimeGrid anime={results} isLoading={isLoading} />
        )}

        {/* Empty State */}
        {!searchQuery && !hasActiveFilters && !isLoading && (
          <div className="text-center py-16">
            <SearchIcon className="w-24 h-24 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Search for Anime</h3>
            <p className="text-gray-400">
              Use the search bar above to find your favorite anime series
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
