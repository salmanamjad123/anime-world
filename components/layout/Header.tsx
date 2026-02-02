/**
 * Header Component
 * Main navigation header with inline search
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Heart, History, Moon, Sun, Loader2, Filter, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { useThemeStore } from '@/store/useThemeStore';
import { useDebounce } from '@/hooks/useDebounce';
import { getPreferredTitle } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Anime } from '@/types';
import type { HiAnimeSearchResult } from '@/lib/api/hianime';
import { Sidebar } from './Sidebar';

type SearchResultItem = Anime | HiAnimeSearchResult;

function isHiAnimeResult(item: SearchResultItem): item is HiAnimeSearchResult {
  return 'poster' in item && 'name' in item && !('coverImage' in item);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSimilarAnime, setIsSimilarAnime] = useState(false); // true when showing trending fallback
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);

  const debouncedQuery = useDebounce(searchQuery.trim(), 300);

  // const navItems = [
  //   { label: 'Home', href: ROUTES.HOME },
  //   { label: 'Watchlist', href: ROUTES.WATCHLIST, icon: Heart },
  //   { label: 'History', href: ROUTES.HISTORY, icon: History },
  // ];

  // Fetch search: HiAnime first (anime you can watch), then AniList search, then trending fallback
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setSearchResults([]);
      setIsSimilarAnime(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setIsSimilarAnime(false);

    const setTrendingFallback = () => {
      if (cancelled) return;
      return fetch('/api/anime?type=trending&page=1&perPage=15')
        .then((r) => (r.ok ? r.json() : null))
        .then((fallback) => {
          if (cancelled) return;
          const fallbackMedia = fallback?.data?.Page?.media ?? fallback?.Page?.media ?? [];
          setSearchResults(Array.isArray(fallbackMedia) ? fallbackMedia : []);
          setIsSimilarAnime(true);
        });
    };

    // 1) Try HiAnime search (aniwatch-api) – anime that exist on the site
    fetch(`/api/search/hianime?q=${encodeURIComponent(debouncedQuery)}&page=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const animes = data?.data?.animes ?? [];
        if (Array.isArray(animes) && animes.length > 0) {
          setSearchResults(animes);
          setIsSimilarAnime(false);
          setIsSearching(false);
          return;
        }
        // 2) No HiAnime results: try AniList search
        return fetch(`/api/search?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=15`)
          .then((res) => (res.ok ? res.json() : null))
          .then((anilistData) => {
            if (cancelled) return;
            const media = anilistData?.data?.Page?.media ?? anilistData?.Page?.media ?? [];
            if (media.length > 0) {
              setSearchResults(Array.isArray(media) ? media : []);
              setIsSimilarAnime(false);
              setIsSearching(false);
              return;
            }
            return setTrendingFallback();
          });
      })
      .catch(() => {
        if (!cancelled) {
          // HiAnime failed: try AniList search, then trending
          return fetch(`/api/search?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=15`)
            .then((res) => (res.ok ? res.json() : null))
            .then((anilistData) => {
              if (cancelled) return;
              const media = anilistData?.data?.Page?.media ?? anilistData?.Page?.media ?? [];
              if (media.length > 0) {
                setSearchResults(Array.isArray(media) ? media : []);
                setIsSimilarAnime(false);
                return;
              }
              return setTrendingFallback();
            })
            .catch(() => setTrendingFallback());
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close dropdown when clicking outside (exclude search toggle button)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (searchToggleRef.current?.contains(target)) return;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = searchOpen && (searchQuery.length >= 1 || searchResults.length > 0);

  const handleResultClick = (animeId: string) => {
    setSearchQuery('');
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchResults([]);
    router.push(ROUTES.ANIME_DETAIL(animeId));
  };

  const toggleMobileSearch = () => {
    setMobileSearchOpen((prev) => {
      if (prev) setSearchOpen(false);
      else setSearchOpen(true);
      return !prev;
    });
  };

  const closeMobileSearch = useCallback(() => {
    setMobileSearchOpen(false);
    setSearchOpen(false);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
      <div className="relative w-full">
        {/* Header row */}
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Toggle + Logo - grouped together */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link href={ROUTES.HOME} className="flex-shrink-0 flex items-center">
                <div className="text-2xl font-bold">
                  <span className="text-blue-500">Anime</span>
                  <span className="text-white">World</span>
                </div>
              </Link>
            </div>

            {/* Mobile: Search icon only - tap to open/close */}
            <button
              ref={searchToggleRef}
              type="button"
              onClick={toggleMobileSearch}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-blue-500 hover:bg-gray-800 transition-colors"
              aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
              aria-expanded={mobileSearchOpen}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop: Filter + Search bar */}
            <div ref={searchRef} className="relative flex-1 max-w-xl mx-4 hidden md:flex items-center gap-2 min-w-0">
            <Link
              href={ROUTES.SEARCH}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="Filters"
            >
              <Filter className="w-4 h-4" />
            </Link>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search any anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Search results dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl max-h-[70vh] overflow-y-auto z-50">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    {searchQuery.length < 1 ? 'Type to search' : 'No anime found'}
                  </div>
                ) : (
                  <ul className="py-2">
                    {debouncedQuery && searchResults.length > 0 && (
                      <li className="px-4 py-2 text-xs text-gray-500 border-b border-gray-700">
                        {isSimilarAnime ? 'Similar / Popular anime' : 'Search results'}
                      </li>
                    )}
                    {searchResults.map((item) => {
                      const isHiAnime = isHiAnimeResult(item);
                      const title = isHiAnime ? item.name : getPreferredTitle(item.title);
                      const imageUrl = isHiAnime ? item.poster : item.coverImage.medium;
                      const subtitle = isHiAnime ? item.type : item.genres?.[0];
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700/80 transition-colors"
                          >
                            <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                              <Image
                                src={imageUrl}
                                alt={title}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium truncate">{title}</p>
                              {subtitle && (
                                <p className="text-gray-400 text-xs truncate">{subtitle}</p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            </div>

          {/* Navigation */}
          {/* <nav className="hidden md:flex items-center space-x-6 flex-shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium transition-colors hover:text-blue-400',
                    isActive ? 'text-blue-500' : 'text-gray-300'
                  )}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
          </nav> */}

          {/* Actions */}
          {/* <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div> */}
          </div>
        </div>

        {/* Mobile Search Bar - absolute overlay below header, takes extra space */}
        {mobileSearchOpen && (
          <div
            ref={searchRef}
            className="md:hidden absolute top-full left-0 right-0 z-50 w-full px-4 py-4 border-t border-gray-800 bg-gray-900 shadow-xl"
          >
            <div className="flex gap-2 w-full">
              <Link
                href={ROUTES.SEARCH}
                onClick={closeMobileSearch}
                className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                aria-label="Filters"
              >
                <Filter className="w-5 h-5" />
              </Link>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  autoFocus
                  className="w-full h-12 pl-10 pr-10 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
            </div>
            {/* Search results dropdown */}
            {showDropdown && (
              <div className="mt-2 rounded-lg bg-gray-800 border border-gray-700 max-h-[60vh] overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    {searchQuery.length < 1 ? 'Type to search' : 'No anime found'}
                  </div>
                ) : (
                  <ul className="py-2">
                    {debouncedQuery && searchResults.length > 0 && (
                      <li className="px-4 py-2 text-xs text-gray-500 border-b border-gray-700">
                        {isSimilarAnime ? 'Similar / Popular anime' : 'Search results'}
                      </li>
                    )}
                    {searchResults.map((item) => {
                      const isHiAnime = isHiAnimeResult(item);
                      const title = isHiAnime ? item.name : getPreferredTitle(item.title);
                      const imageUrl = isHiAnime ? item.poster : item.coverImage.medium;
                      const subtitle = isHiAnime ? item.type : item.genres?.[0];
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700/80 transition-colors"
                          >
                            <div className="relative w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                              <Image
                                src={imageUrl}
                                alt={title}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium truncate">{title}</p>
                              {subtitle && (
                                <p className="text-gray-400 text-xs truncate">{subtitle}</p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
