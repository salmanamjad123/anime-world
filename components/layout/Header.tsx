/**
 * Header Component
 * Main navigation header with inline search
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Heart, History, Moon, Sun, Loader2, Filter, Menu, LogIn, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { useThemeStore } from '@/store/useThemeStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { signOut } from '@/lib/firebase/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useDebounce } from '@/hooks/useDebounce';
import { getPreferredTitle } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Anime, Manga } from '@/types';
import { Sidebar } from './Sidebar';

type SearchResultItem = (Anime | Manga) & { id: string };

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { isOpen: authModalOpen, defaultView: authModalDefaultView, openAuthModal, closeAuthModal } = useAuthModalStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileTabRowRef = useRef<HTMLDivElement>(null);
  const mobileTabInnerRef = useRef<HTMLDivElement>(null);
  const mobileTabProgressRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const scrollTickingRef = useRef(false);

  const MOBILE_TAB_SCROLL_RANGE = 72;
  const MOBILE_TAB_ROW_HEIGHT = 52;
  const MOBILE_MAIN_ROW_HEIGHT = 56; // h-14
  const HEADER_BORDER_PX = 1;

  const { user } = useUserStore();

  const activeTab = pathname.startsWith('/manga') ? 'manga' : 'anime';
  const isWatchPage = pathname.startsWith('/watch/');
  const isReaderPage = pathname.includes('/read') || isWatchPage;
  const profileLinks =
    activeTab === 'manga'
      ? {
          profile: ROUTES.MANGA_PROFILE,
          continue: ROUTES.MANGA_PROFILE_SECTION('reading'),
          list: ROUTES.MANGA_PROFILE_SECTION('readlist'),
          continueLabel: 'Continue Reading',
          listLabel: 'Read List',
        }
      : {
          profile: ROUTES.PROFILE,
          continue: ROUTES.PROFILE_SECTION('watching'),
          list: ROUTES.PROFILE_SECTION('watchlist'),
          continueLabel: 'Continue Watching',
          listLabel: 'Watch List',
        };
  const debouncedQuery = useDebounce(searchQuery.trim(), 300);
  const showFilter = activeTab === 'anime';

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setSearchResults([]);
      setIsFallback(false);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setIsFallback(false);

    const finish = (results: SearchResultItem[], fallback: boolean) => {
      if (cancelled) return;
      setSearchResults(results);
      setIsFallback(fallback);
      setIsSearching(false);
    };

    const loadAnimeTrendingFallback = async () => {
      try {
        const res = await fetch('/api/anime?type=trending&page=1&perPage=20');
        const fallback = res.ok ? await res.json() : null;
        const fallbackMedia = fallback?.data?.Page?.media ?? fallback?.Page?.media ?? [];
        finish(Array.isArray(fallbackMedia) ? fallbackMedia : [], true);
      } catch {
        finish([], true);
      }
    };

    const loadMangaPopularFallback = async () => {
      try {
        const res = await fetch('/api/manga?type=popular&page=1&perPage=20');
        const fallback = res.ok ? await res.json() : null;
        const fallbackMedia = fallback?.data?.Page?.media ?? fallback?.Page?.media ?? [];
        finish(Array.isArray(fallbackMedia) ? fallbackMedia : [], true);
      } catch {
        finish([], true);
      }
    };

    if (activeTab === 'manga') {
      (async () => {
        try {
          const res = await fetch(
            `/api/search/manga?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=25`
          );
          const data = res.ok ? await res.json() : null;
          const media = data?.data?.Page?.media ?? data?.Page?.media ?? [];
          if (media.length === 0) {
            await loadMangaPopularFallback();
            return;
          }
          finish(media, false);
        } catch {
          await loadMangaPopularFallback();
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/search?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=25`
        );
        const anilistData = res.ok ? await res.json() : null;
        const media = anilistData?.data?.Page?.media ?? anilistData?.Page?.media ?? [];
        if (media.length === 0) {
          await loadAnimeTrendingFallback();
          return;
        }

        const first = media[0];
        const relationIds = new Set<string>();

        if (first.id) {
          try {
            const seasonsRes = await fetch(`/api/anime/${first.id}/seasons`);
            if (seasonsRes.ok && !cancelled) {
              const seasonsData = await seasonsRes.json();
              const main = seasonsData.main;
              const seasons = seasonsData.seasons ?? [];
              const movies = seasonsData.movies ?? [];
              const allRelations = [main, ...seasons, ...movies].filter(Boolean);
              allRelations.forEach((r: { id: string }) => relationIds.add(String(r.id)));

              const mediaById = new Map<string, Anime>(media.map((m: Anime) => [String(m.id), m]));
              const firstCover = (first as Anime).coverImage?.medium || (first as Anime).coverImage?.large;
              const genericPlaceholder = '/images/anime-placeholder.svg';
              const relationToAnime = (r: { id: string; title: string; coverImage?: string; format?: string }) => {
                const original = mediaById.get(String(r.id)) as Anime | undefined;
                const origCover = original?.coverImage as { medium?: string; large?: string } | undefined;
                const img =
                  r.coverImage ||
                  origCover?.medium ||
                  origCover?.large ||
                  firstCover ||
                  genericPlaceholder;
                return {
                  id: String(r.id),
                  slug: original?.slug,
                  title: { romaji: r.title, english: r.title, native: '' },
                  coverImage: { large: img, medium: img },
                  genres: r.format ? [r.format] : [],
                } as Anime;
              };

              const enriched: Anime[] = allRelations.map(relationToAnime);
              const rest = media.filter((m: Anime) => !relationIds.has(String(m.id)));
              finish([...enriched, ...rest], false);
              return;
            }
          } catch {
            /* fall through to plain results */
          }
        }

        finish(Array.isArray(media) ? media : [], false);
      } catch {
        await loadAnimeTrendingFallback();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, activeTab]);

  // Sync --site-header-height on layout changes (resize, reader mode, search)
  useEffect(() => {
    const syncHeaderHeight = () => {
      const header = headerRef.current;
      if (!header) return;

      if (window.innerWidth < 768 && !isReaderPage) {
        const p = mobileTabProgressRef.current;
        const visibleTab = MOBILE_TAB_ROW_HEIGHT * (1 - p);
        document.documentElement.style.setProperty(
          '--site-header-height',
          `${MOBILE_MAIN_ROW_HEIGHT + visibleTab + HEADER_BORDER_PX}px`
        );
        return;
      }

      document.documentElement.style.setProperty(
        '--site-header-height',
        `${header.getBoundingClientRect().height}px`
      );
    };

    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    return () => window.removeEventListener('resize', syncHeaderHeight);
  }, [isReaderPage, mobileSearchOpen]);

  // Watch pages: no header bar — reset layout offset for full-bleed player
  useEffect(() => {
    if (!isWatchPage) return;
    document.documentElement.style.setProperty('--site-header-height', '0px');
    return () => {
      document.documentElement.style.removeProperty('--site-header-height');
    };
  }, [isWatchPage]);

  // Mobile: tabs slide up into the top row
  useEffect(() => {
    const syncSiteHeaderHeight = (progress: number) => {
      const visibleTab = MOBILE_TAB_ROW_HEIGHT * (1 - progress);
      document.documentElement.style.setProperty(
        '--site-header-height',
        `${MOBILE_MAIN_ROW_HEIGHT + visibleTab + HEADER_BORDER_PX}px`
      );
    };

    const resetTabStyles = () => {
      const tabRow = mobileTabRowRef.current;
      const tabInner = mobileTabInnerRef.current;
      if (tabRow) {
        tabRow.style.height = '';
        tabRow.style.marginBottom = '';
      }
      if (tabInner) {
        tabInner.style.transform = '';
      }
      if (headerRef.current) {
        headerRef.current.style.removeProperty('--tab-scroll-progress');
      }
    };

    const applyTabProgress = (progress: number) => {
      const p = Math.min(Math.max(progress, 0), 1);
      mobileTabProgressRef.current = p;
      const shift = p * MOBILE_TAB_ROW_HEIGHT;

      const tabRow = mobileTabRowRef.current;
      const tabInner = mobileTabInnerRef.current;

      if (tabRow) {
        tabRow.style.height = `${MOBILE_TAB_ROW_HEIGHT}px`;
        tabRow.style.marginBottom = `${-shift}px`;
      }

      if (tabInner) {
        tabInner.style.transform = `translate3d(0, ${-shift}px, 0)`;
      }

      if (headerRef.current) {
        headerRef.current.style.setProperty('--tab-scroll-progress', p.toFixed(4));
      }

      syncSiteHeaderHeight(p);
    };

    const readScrollProgress = () => {
      if (isReaderPage || window.innerWidth >= 768) return 0;
      return Math.min(Math.max(window.scrollY / MOBILE_TAB_SCROLL_RANGE, 0), 1);
    };

    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    let animating = false;

    const stopLoop = () => {
      animating = false;
      scrollTickingRef.current = false;
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };

    const frame = () => {
      applyTabProgress(readScrollProgress());
      if (animating) {
        scrollRafRef.current = requestAnimationFrame(frame);
      }
    };

    const startLoop = () => {
      if (animating) return;
      animating = true;
      scrollTickingRef.current = true;
      scrollRafRef.current = requestAnimationFrame(frame);
    };

    const settleProgress = () => {
      const progress = readScrollProgress();
      if (progress <= 0.06) applyTabProgress(0);
      else if (progress >= 0.94) applyTabProgress(1);
      else applyTabProgress(progress);
      stopLoop();
    };

    const onScroll = () => {
      startLoop();
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(settleProgress, 100);
    };

    const onResize = () => {
      stopLoop();
      applyTabProgress(readScrollProgress());
    };

    applyTabProgress(readScrollProgress());
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      stopLoop();
      resetTabStyles();
      applyTabProgress(0);
    };
  }, [isReaderPage]);

  // Close dropdown when clicking outside (exclude search toggle button)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (searchToggleRef.current?.contains(target)) return;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = searchOpen && (searchQuery.length >= 1 || searchResults.length > 0);

  // Watch pages: no sticky header chrome — Megaplay embed is full-width (same idea as manga read)
  if (isWatchPage) {
    return (
      <>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeTab={activeTab} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={closeAuthModal}
          defaultView={authModalDefaultView ?? 'login'}
        />
      </>
    );
  }

  const handleResultClick = (item: SearchResultItem) => {
    setSearchQuery('');
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchResults([]);
    if (activeTab === 'manga') {
      const md =
        'mangadexId' in item && item.mangadexId
          ? item.mangadexId
          : undefined;
      router.push(ROUTES.MANGA_DETAIL(String(item.id), md));
    } else {
      router.push(ROUTES.ANIME_DETAIL(item));
    }
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

  const renderTabToggle = () => (
    <div className="flex items-center rounded-lg bg-gray-800/80 p-0.5 w-full md:w-auto">
      <Link
        href={ROUTES.HOME}
        className={cn(
          'flex-1 md:flex-none text-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
          activeTab === 'anime'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        )}
      >
        Anime
      </Link>
      <Link
        href={ROUTES.MANGA}
        className={cn(
          'flex-1 md:flex-none text-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
          activeTab === 'manga'
            ? 'bg-amber-600 text-white'
            : 'text-gray-400 hover:text-white'
        )}
      >
        Manga
      </Link>
    </div>
  );

  return (
    <>
    <header ref={headerRef} className="sticky top-0 z-[100] w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
      <div className="relative w-full">
        {/* Header row */}
        <div className="container mx-auto px-4 relative">
          <div className="relative z-20 flex h-14 md:h-16 items-center justify-between gap-2 md:gap-4 bg-gray-900/95 supports-[backdrop-filter]:bg-gray-900/60">
            {/* Toggle + Logo (+ Tabs on desktop) */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link
                href={activeTab === 'manga' ? ROUTES.MANGA : ROUTES.HOME}
                className="flex-shrink-0 flex items-center"
              >
                <div className="text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap">
                  {activeTab === 'manga' ? (
                    <>
                      <span className="text-amber-500">Manga</span>
                      <span className="text-white">Village</span>
                    </>
                  ) : (
                    <>
                      <span className="text-blue-500">Anime</span>
                      <span className="text-white">Village</span>
                    </>
                  )}
                </div>
              </Link>
              <div className="hidden md:block ml-2">{renderTabToggle()}</div>
            </div>

            {/* Search + Auth */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-end">
            {/* Mobile: Search icon only - tap to open/close */}
            <button
              ref={searchToggleRef}
              type="button"
              onClick={toggleMobileSearch}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-blue-500 hover:bg-gray-800 transition-colors shrink-0"
              aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
              aria-expanded={mobileSearchOpen}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop: Filter (anime only) + Search bar */}
            <div ref={searchRef} className="relative z-50 hidden md:flex items-center gap-2 w-full max-w-[400px] flex-none">
            {showFilter && (
              <Link
                href={ROUTES.SEARCH}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                aria-label="Filters"
              >
                <Filter className="w-4 h-4" />
              </Link>
            )}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-20" />
              <input
                type="text"
                placeholder={activeTab === 'manga' ? 'Search manga...' : 'Search any anime...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                className={cn(
                  'relative z-0 w-full pl-10 pr-4 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm',
                  activeTab === 'manga' ? 'focus:ring-amber-500' : 'focus:ring-blue-500'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin z-20 pointer-events-none" />
              )}

            {/* Search results dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-0 rounded-lg bg-gray-800 border border-gray-700 shadow-2xl max-h-72 overflow-y-auto z-[110]">
                {isSearching && searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    {searchQuery.length < 1 ? 'Type to search' : activeTab === 'manga' ? 'No manga found' : 'No anime found'}
                  </div>
                ) : (
                  <ul className="py-1">
                    {debouncedQuery && searchResults.length > 0 && (
                      <li className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-700">
                        {isFallback ? (activeTab === 'manga' ? 'Popular manga' : 'Similar / Popular anime') : 'Search results'}
                      </li>
                    )}
                    {searchResults.map((item) => {
                      const title = getPreferredTitle(item.title);
                      const imageUrl = item.coverImage?.medium ?? item.coverImage?.large ?? '';
                      const subtitle = item.genres?.[0];
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(item)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/80 transition-colors"
                          >
                            <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                              <SafeImage
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
            </div>

            {/* Auth: Login button or User menu */}
            <div ref={userMenuRef} className="relative shrink-0 ml-2">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <UserAvatar
                      photoURL={user.photoURL}
                      name={user.displayName || user.email}
                      size="sm"
                      className="w-8 h-8"
                    />
                    <span className="hidden sm:inline max-w-[100px] truncate text-sm">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 py-2 w-64 rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl z-[110]">
                      <div className="px-4 pb-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {user.displayName || user.email}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <div className="mt-1 space-y-1 px-2 pb-2">
                        <Link
                          href={profileLinks.profile}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-100 text-sm transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span>Profile</span>
                        </Link>
                        <Link
                          href={profileLinks.continue}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-100 text-sm transition-colors"
                        >
                          <History className="w-4 h-4" />
                          <span>{profileLinks.continueLabel}</span>
                        </Link>
                        <Link
                          href={profileLinks.list}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-100 text-sm transition-colors"
                        >
                          <Heart className="w-4 h-4" />
                          <span>{profileLinks.listLabel}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            signOut();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm transition-colors mt-1"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}
            </div>
          </div>
          </div>

          {/* Mobile: tabs slide up behind logo/search row on scroll (hidden on reader pages) */}
          {!isReaderPage && (
          <div
            ref={mobileTabRowRef}
            className="md:hidden relative z-0 overflow-hidden [contain:layout_paint]"
            style={{ height: MOBILE_TAB_ROW_HEIGHT }}
          >
            <div
              ref={mobileTabInnerRef}
              className="max-w-xs mx-auto px-0 pb-3 pt-1 [backface-visibility:hidden] [transform:translateZ(0)]"
            >
              {renderTabToggle()}
            </div>
          </div>
          )}
        </div>

        {/* Mobile Search Bar - absolute overlay below header, takes extra space */}
        {mobileSearchOpen && (
          <div
            ref={searchRef}
            className="md:hidden absolute top-full left-0 right-0 z-[110] w-full px-4 py-3 border-t border-gray-800 bg-gray-900 shadow-2xl"
          >
            <div className="flex gap-2 w-full">
              {showFilter && (
                <Link
                  href={ROUTES.SEARCH}
                  onClick={closeMobileSearch}
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  aria-label="Filters"
                >
                  <Filter className="w-4 h-4" />
                </Link>
              )}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-20" />
                <input
                  type="text"
                  placeholder={activeTab === 'manga' ? 'Search manga...' : 'Search anime...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  autoFocus
                  className="relative z-0 w-full h-10 pl-10 pr-10 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin z-20 pointer-events-none" />
                )}
              </div>
            </div>
            {/* Search results dropdown */}
            {showDropdown && (
              <div className="relative z-[110] mt-1 rounded-lg bg-gray-800 border border-gray-700 shadow-2xl max-h-64 overflow-y-auto">
                {isSearching && searchResults.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 text-sm">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 text-sm">
                    {searchQuery.length < 1 ? 'Type to search' : activeTab === 'manga' ? 'No manga found' : 'No anime found'}
                  </div>
                ) : (
                  <ul className="py-1">
                    {debouncedQuery && searchResults.length > 0 && (
                      <li className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-700">
                        {isFallback ? (activeTab === 'manga' ? 'Popular manga' : 'Similar / Popular anime') : 'Search results'}
                      </li>
                    )}
                    {searchResults.map((item) => {
                      const title = getPreferredTitle(item.title);
                      const imageUrl = item.coverImage?.medium ?? item.coverImage?.large ?? '';
                      const subtitle = item.genres?.[0];
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(item)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/80 transition-colors"
                          >
                            <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                              <SafeImage
                                src={imageUrl}
                                alt={title}
                                fill
                                className="object-cover"
                                sizes="40px"
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

    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeTab={activeTab} />
    <AuthModal
      isOpen={authModalOpen}
      onClose={closeAuthModal}
      defaultView={authModalDefaultView ?? 'login'}
    />
    </>
  );
}
