/**
 * Filter Section
 * Filter panel with Type, Status, Season, Year, Sort dropdowns and Genre tags.
 * Shared design for desktop and mobile.
 */

'use client';

import { GENRES } from '@/constants/genres';
import type { AnimeFilters, AnimeFormat, AnimeSeason, AnimeStatus } from '@/types';

const FORMAT_OPTIONS: { value: AnimeFormat | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'TV', label: 'TV' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'MUSIC', label: 'Music' },
];

const STATUS_OPTIONS: { value: AnimeStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'RELEASING', label: 'Releasing' },
  { value: 'NOT_YET_RELEASED', label: 'Not Yet Released' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SEASON_OPTIONS: { value: AnimeSeason | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'SCORE_DESC', label: 'Highest Rated' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'UPDATED_AT_DESC', label: 'Recently Updated' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

type Props = {
  filters: AnimeFilters;
  onFiltersChange: (filters: AnimeFilters) => void;
  onApply: () => void;
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg bg-gray-800 border border-gray-700 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
      >
        {options.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterSection({ filters, onFiltersChange, onApply }: Props) {
  const handleGenreToggle = (genre: string) => {
    const genres = filters.genres || [];
    const newGenres = genres.includes(genre)
      ? genres.filter((g) => g !== genre)
      : [...genres, genre];
    onFiltersChange({ ...filters, genres: newGenres });
  };

  return (
    <div className="rounded-xl bg-gray-800/80 border border-gray-700 p-3 sm:p-6">
      {/* Filter heading */}
      <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Filter</h3>

      {/* Dropdowns grid - 2 cols mobile (compact), 3 cols tablet, 6 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <FilterSelect
          label="Type"
          value={filters.format || ''}
          onChange={(v) => onFiltersChange({ ...filters, format: (v || undefined) as AnimeFormat })}
          options={FORMAT_OPTIONS}
        />
        <FilterSelect
          label="Status"
          value={filters.status || ''}
          onChange={(v) => onFiltersChange({ ...filters, status: (v || undefined) as AnimeStatus })}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Season"
          value={filters.season || ''}
          onChange={(v) => onFiltersChange({ ...filters, season: (v || undefined) as AnimeSeason })}
          options={SEASON_OPTIONS}
        />
        <FilterSelect
          label="Year"
          value={filters.year?.toString() || ''}
          onChange={(v) => onFiltersChange({ ...filters, year: v ? parseInt(v, 10) : undefined })}
          options={[{ value: '', label: 'All' }, ...YEARS.map((y) => ({ value: String(y), label: String(y) }))]}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort || 'POPULARITY_DESC'}
          onChange={(v) => onFiltersChange({ ...filters, sort: (v as AnimeFilters['sort']) || 'POPULARITY_DESC' })}
          options={SORT_OPTIONS}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Genre section */}
      <h3 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3">Genre</h3>
      <div className="max-h-40 sm:max-h-48 overflow-y-auto pr-2 mb-4 sm:mb-6">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {GENRES.map((genre) => {
            const isSelected = filters.genres?.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => handleGenreToggle(genre)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors border ${
                  isSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Apply button */}
      <button
        type="button"
        onClick={onApply}
        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-semibold transition-colors"
      >
        Filter
      </button>
    </div>
  );
}
