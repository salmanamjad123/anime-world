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
import { compactSearchText } from '@/lib/search-query';
import { cn } from '@/lib/utils';
import type { Anime, Manga } from '@/types';
import { canAccessGameDemo } from '@/lib/game-demo-access';
import { Sidebar, type SidebarTab } from './Sidebar';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAnimeDetail, seedAnimeDetail } from '@/hooks/useAnime';

type SearchResultItem = (Anime | Manga) & { id: string };
type ActiveTab = SidebarTab;

function searchHaystack(item: SearchResultItem): string {
  const synonyms = 'synonyms' in item && Array.isArray(item.synonyms) ? item.synonyms.join(' ') : '';
  return [item.title?.english, item.title?.romaji, item.title?.native, synonyms]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function mediaMatchesQuery(item: SearchResultItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = searchHaystack(item);
  if (words.every((word) => hay.includes(word))) return true;
  const compactQuery = compactSearchText(query);
  return compactQuery.length >= 4 && compactSearchText(hay).includes(compactQuery);
}

function matchScore(item: SearchResultItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const english = (item.title?.english || '').toLowerCase();
  const romaji = (item.title?.romaji || '').toLowerCase();
  const hay = searchHaystack(item);
  const compactQuery = compactSearchText(q);
  const compactHay = compactSearchText(hay);
  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;
  if (english === q || romaji === q) score += 100;
  if (english.startsWith(q) || romaji.startsWith(q)) score += 40;
  if (compactQuery && compactHay.startsWith(compactQuery)) score += 35;
  if (compactQuery && compactHay.includes(compactQuery)) score += 20;
  if (words.every((word) => english.includes(word) || romaji.includes(word))) score += 25;
  if (words.every((word) => hay.includes(word))) score += 10;
  return score;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const mobileTabProgressRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const scrollTickingRef = useRef(false);

  const MOBILE_TAB_SCROLL_RANGE = 72;
  const MOBILE_TAB_ROW_HEIGHT = 52;
  const MOBILE_MAIN_ROW_HEIGHT = 56; // h-14
  const HEADER_BORDER_PX = 1;

  const { user } = useUserStore();
  const showGameTab = canAccessGameDemo(user);

  const activeTab: ActiveTab =
    showGameTab && pathname.startsWith('/game')
      ? 'game'
      : pathname.startsWith('/manga')
        ? 'manga'
        : 'anime';
  const isGameBattlePage = showGameTab && pathname.startsWith('/game/battle');
  // Hide sticky chrome only on manga reader + game battle (watch keeps the header)
  const isReaderPage = pathname.includes('/read');
  const hideChrome = isGameBattlePage;
  const hideSearch = activeTab === 'game';
  // Mobile: Anime/Manga toggle only on section homes (not detail/search/profile/watch)
  const showMobileSectionTabs =
    !isReaderPage && !hideChrome && (pathname === ROUTES.HOME || pathname === ROUTES.MANGA);
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
    setSidebarOpen(false);
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setUserMenuOpen(false);
    closeAuthModal();
  }, [pathname, closeAuthModal]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setSearchResults([]);
      setIsFallback(false);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    setSearchResults((prev) => prev.filter((item) => mediaMatchesQuery(item, debouncedQuery)));
    setSearchOpen(true);
    setIsSearching(true);

    const finish = (results: SearchResultItem[], fallback: boolean) => {
      if (cancelled) return;
      setSearchResults(results);
      setIsFallback(fallback);
      setIsSearching(false);
    };

    const mediaFromPayload = (data: unknown): SearchResultItem[] => {
      const payload = data as {
        data?: { Page?: { media?: SearchResultItem[] } };
        Page?: { media?: SearchResultItem[] };
        _fallback?: string;
      } | null;
      const media = payload?.data?.Page?.media ?? payload?.Page?.media ?? [];
      return Array.isArray(media) ? media : [];
    };

    const endpoint =
      activeTab === 'manga'
        ? `/api/search/manga?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=15`
        : `/api/search?search=${encodeURIComponent(debouncedQuery)}&page=1&perPage=15`;

    (async () => {
      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        if (cancelled) return;
        const data = res.ok ? await res.json() : null;
        const media = mediaFromPayload(data);
        if (media.length > 0) {
          const ranked = [...media].sort(
            (a, b) => matchScore(b, debouncedQuery) - matchScore(a, debouncedQuery)
          );
          finish(ranked, Boolean((data as { _fallback?: string } | null)?._fallback));
          return;
        }
        setIsSearching(false);
      } catch {
        if (!cancelled) setIsSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [debouncedQuery, activeTab]);

  // Sync --site-header-height on layout changes (resize, reader mode, search)
  useEffect(() => {
    const syncHeaderHeight = () => {
      const header = headerRef.current;
      if (!header) return;

      if (window.innerWidth < 768 && showMobileSectionTabs) {
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
  }, [isReaderPage, showMobileSectionTabs, mobileSearchOpen]);

  // Game battle / manga reader: no header bar — reset layout offset
  useEffect(() => {
    if (!hideChrome && !isReaderPage) return;
    document.documentElement.style.setProperty('--site-header-height', '0px');
    return () => {
      document.documentElement.style.removeProperty('--site-header-height');
    };
  }, [hideChrome, isReaderPage]);

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
      if (headerRef.current) {
        headerRef.current.style.removeProperty('--tab-scroll-progress');
      }
    };

    // Only update the CSS var — tab row margin/transform read it in JSX so React
    // re-renders (e.g. opening mobile search) cannot wipe the collapsed scroll styles.
    const applyTabProgress = (progress: number) => {
      const p = Math.min(Math.max(progress, 0), 1);
      mobileTabProgressRef.current = p;

      if (headerRef.current) {
        headerRef.current.style.setProperty('--tab-scroll-progress', p.toFixed(4));
      }

      syncSiteHeaderHeight(p);
    };

    const readScrollProgress = () => {
      if (!showMobileSectionTabs || window.innerWidth >= 768) return 0;
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
  }, [showMobileSectionTabs]);

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

  const closeMobileSearch = useCallback(() => {
    setMobileSearchOpen(false);
    setSearchOpen(false);
  }, []);

  // Manga reader / game battle: no sticky header chrome (watch keeps the header)
  if (hideChrome || isReaderPage) {
    return (
      <>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          showGameTab={showGameTab}
        />
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
      seedAnimeDetail(queryClient, item as Anime);
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

  const renderTabToggle = () => (
    <div className="flex items-center rounded-full bg-gray-800/90 p-0.5 w-full md:w-auto border border-white/5">
      <Link
        href={ROUTES.HOME}
        className={cn(
          'flex-1 md:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200',
          activeTab === 'anime'
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
            : 'text-gray-400 hover:text-white'
        )}
      >
        Anime
      </Link>
      <Link
        href={ROUTES.MANGA}
        className={cn(
          'flex-1 md:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200',
          activeTab === 'manga'
            ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
            : 'text-gray-400 hover:text-white'
        )}
      >
        Manga
      </Link>
      {showGameTab && (
        <Link
          href={ROUTES.GAME}
          className={cn(
            'flex-1 md:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200',
            activeTab === 'game'
              ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Game
        </Link>
      )}
    </div>
  );

  return (
    <>
    <header ref={headerRef} className="sticky top-0 z-[100] w-full border-b border-white/10 bg-gray-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-gray-950/55">
      <div className="relative w-full">
        {/* Header row */}
        <div className="container mx-auto px-4 relative">
          <div className="relative z-20 flex h-14 md:h-16 items-center justify-between gap-2 md:gap-4">
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
                href={
                  activeTab === 'manga'
                    ? ROUTES.MANGA
                    : activeTab === 'game'
                      ? ROUTES.GAME
                      : ROUTES.HOME
                }
                className="flex-shrink-0 flex items-center"
              >
                <div className="text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap">
                  {activeTab === 'manga' ? (
                    <>
                      <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">Manga</span>
                      <span className="text-white">Village</span>
                    </>
                  ) : activeTab === 'game' ? (
                    <>
                      <span className="text-orange-500">Game</span>
                      <span className="text-white">Village</span>
                    </>
                  ) : (
                    <>
                      <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Anime</span>
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
            {!hideSearch && (
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
            )}

            {/* Desktop: Filter (anime only) + Search bar */}
            {!hideSearch && (
            <div ref={searchRef} className="relative z-50 hidden md:flex items-center gap-2 w-full max-w-[400px] flex-none">
            {showFilter && (
              <Link
                href={ROUTES.SEARCH}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 border border-white/10 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
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
                  'relative z-0 w-full pl-10 pr-4 py-1.5 rounded-xl bg-gray-800/80 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all duration-200',
                  activeTab === 'manga' ? 'focus:ring-amber-500' : 'focus:ring-blue-500'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin z-20 pointer-events-none" />
              )}

            {/* Search results dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-gray-900/95 border border-white/10 shadow-2xl max-h-72 overflow-y-auto z-[110] backdrop-blur-xl">
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
                            onPointerEnter={() => {
                              if (activeTab !== 'manga') prefetchAnimeDetail(queryClient, item as Anime);
                            }}
                            onFocus={() => {
                              if (activeTab !== 'manga') prefetchAnimeDetail(queryClient, item as Anime);
                            }}
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
            )}

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
                    <div className="absolute right-0 top-full mt-1 py-2 w-64 rounded-2xl bg-gray-950/95 border border-white/10 shadow-2xl z-[110] backdrop-blur-xl">
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
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 shadow-[0_8px_20px_-10px_rgba(88,102,242,0.9)]"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}
            </div>
          </div>
          </div>

          {/* Mobile: Anime/Manga toggle only on home pages */}
          {showMobileSectionTabs && (
          <div
            className="md:hidden relative z-0 overflow-hidden [contain:layout_paint]"
            style={{
              height: MOBILE_TAB_ROW_HEIGHT,
              // Collapses with --tab-scroll-progress (set on <header>); survives React re-renders
              marginBottom: `calc(var(--tab-scroll-progress, 0) * -${MOBILE_TAB_ROW_HEIGHT}px)`,
            }}
          >
            <div
              className="max-w-xs mx-auto px-0 pb-3 pt-1 [backface-visibility:hidden] will-change-transform"
              style={{
                transform: `translate3d(0, calc(var(--tab-scroll-progress, 0) * -${MOBILE_TAB_ROW_HEIGHT}px), 0)`,
              }}
            >
              {renderTabToggle()}
            </div>
          </div>
          )}
        </div>

        {/* Mobile Search Bar — attached to visible header bottom (accounts for tab collapse) */}
        {mobileSearchOpen && !hideSearch && (
          <div
            ref={searchRef}
            className="md:hidden absolute left-0 right-0 z-[110] w-full px-4 py-3 border-t border-white/10 bg-gray-950/95 backdrop-blur-xl shadow-2xl"
            style={{
              // Stick to visible header bottom (main row + remaining tab strip when present)
              top: showMobileSectionTabs
                ? `calc(${MOBILE_MAIN_ROW_HEIGHT}px + (1 - var(--tab-scroll-progress, 0)) * ${MOBILE_TAB_ROW_HEIGHT}px)`
                : MOBILE_MAIN_ROW_HEIGHT,
            }}
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
                            onPointerEnter={() => {
                              if (activeTab !== 'manga') prefetchAnimeDetail(queryClient, item as Anime);
                            }}
                            onFocus={() => {
                              if (activeTab !== 'manga') prefetchAnimeDetail(queryClient, item as Anime);
                            }}
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

    <Sidebar
      isOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      activeTab={activeTab}
      showGameTab={showGameTab}
    />
    <AuthModal
      isOpen={authModalOpen}
      onClose={closeAuthModal}
      defaultView={authModalDefaultView ?? 'login'}
    />
    </>
  );
}
