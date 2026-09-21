/**
 * Manga Reader Page
 * Two modes: Scroll view (all pages) | Page view (modal, one page at a time)
 */

'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  useChapterPages,
  useMangaChaptersAll,
  useMangaInfo,
  usePrefetchChapterPages,
  usePrefetchChapterImages,
} from '@/hooks/useManga';
import { ROUTES } from '@/constants/routes';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Square,
  X,
  Bookmark,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { MangaChapter, MangaChapterPage } from '@/types';
import { useReadingHistoryStore } from '@/store/useReadingHistoryStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import {
  updateReadingProgress,
  markMangaChapterRead,
  setSavedChapter,
  removeSavedChapter,
} from '@/lib/firebase/manga-firestore';
import { cn, getPreferredTitle } from '@/lib/utils';
import { MangaPageImage } from '@/components/manga/MangaPageImage';

const PAGE_VIEW_ZOOM_STEPS = [100, 125, 150, 200, 250] as const;

export default function MangaReadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mangaId = params.id as string;
  const chapterId = searchParams.get('chapterId');
  const providerParam = searchParams.get('provider') || 'auto';
  const mangadexId = searchParams.get('md');

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageViewOpen, setPageViewOpen] = useState(false);
  const [pageViewZoom, setPageViewZoom] = useState(100);
  const [scrollViewPage, setScrollViewPage] = useState(1);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const pageViewScrollRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumedRef = useRef(false);

  const { user } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const {
    updateProgress,
    getProgress,
    markChapterRead,
    saveChapter,
    unsaveChapter,
    isChapterSaved,
  } = useReadingHistoryStore();
  const { data: infoData } = useMangaInfo(mangaId, mangadexId);
  const manga = infoData?.manga;
  const resolvedMangadexId = mangadexId ?? manga?.mangadexId ?? null;
  const { data: chaptersData } = useMangaChaptersAll(mangaId, providerParam, resolvedMangadexId);
  /** Resolved source for fetching page images (never "auto") */
  const readProvider =
    chaptersData?.provider && chaptersData.provider !== 'auto'
      ? chaptersData.provider
      : providerParam !== 'auto'
        ? providerParam
        : null;
  const {
    data: chapterData,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    refetch,
  } = useChapterPages(chapterId, readProvider);

  const chapters: MangaChapter[] = useMemo(() => {
    const list = chaptersData?.chapters || [];
    return [...list].sort((a, b) => {
      const na = Number(a.chapter);
      const nb = Number(b.chapter);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [chaptersData?.chapters]);
  const pages = chapterData?.pages || [];
  const currentChapter = chapters.find((c) => c.id === chapterId);
  const chapterSaved = !!(chapterId && isChapterSaved(mangaId, chapterId));

  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  const navProvider = readProvider ?? providerParam;

  usePrefetchChapterPages(nextChapter?.id, readProvider ?? undefined);
  usePrefetchChapterPages(prevChapter?.id, readProvider ?? undefined);
  usePrefetchChapterImages(pages, pageViewOpen ? 2 : 5, 0);
  usePrefetchChapterImages(
    pageViewOpen ? pages : undefined,
    2,
    Math.max(0, currentPageIndex + 1)
  );

  useEffect(() => {
    setCurrentPageIndex(0);
    setScrollViewPage(1);
    resumedRef.current = false;
  }, [chapterId]);

  useEffect(() => {
    setPageViewZoom(100);
    pageViewScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentPageIndex, chapterId]);

  const pageViewZoomIn = useCallback(() => {
    setPageViewZoom((z) => {
      const next = PAGE_VIEW_ZOOM_STEPS.find((s) => s > z);
      return next ?? PAGE_VIEW_ZOOM_STEPS[PAGE_VIEW_ZOOM_STEPS.length - 1];
    });
  }, []);

  const pageViewZoomOut = useCallback(() => {
    setPageViewZoom((z) => {
      let idx = PAGE_VIEW_ZOOM_STEPS.findIndex((s) => s >= z);
      if (idx === -1) idx = PAGE_VIEW_ZOOM_STEPS.length - 1;
      return PAGE_VIEW_ZOOM_STEPS[Math.max(0, idx - 1)];
    });
  }, []);

  const cyclePageViewZoom = useCallback(() => {
    setPageViewZoom((z) => {
      let idx = PAGE_VIEW_ZOOM_STEPS.findIndex((s) => s >= z);
      if (idx === -1) idx = 0;
      const nextIdx = (idx + 1) % PAGE_VIEW_ZOOM_STEPS.length;
      return PAGE_VIEW_ZOOM_STEPS[nextIdx];
    });
  }, []);

  // Resume from saved page or ?page= query param
  useEffect(() => {
    if (pages.length === 0 || resumedRef.current || isPlaceholderData) return;

    const pageParam = searchParams.get('page');
    const saved = getProgress(mangaId);
    const targetPage =
      pageParam && !Number.isNaN(Number(pageParam))
        ? Math.min(Math.max(Number(pageParam), 1), pages.length)
        : saved?.chapterId === chapterId && saved.pageIndex >= 0
          ? Math.min(saved.pageIndex + 1, pages.length)
          : 1;

    if (targetPage > 1) {
      setScrollViewPage(targetPage);
      setCurrentPageIndex(targetPage - 1);
      requestAnimationFrame(() => {
        pageRefs.current.get(targetPage)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    resumedRef.current = true;
  }, [pages.length, chapterId, mangaId, searchParams, getProgress, isPlaceholderData]);

  // Save reading progress
  useEffect(() => {
    if (!chapterId || pages.length === 0 || !manga || isPlaceholderData) return;

    const pageIndex = pageViewOpen ? currentPageIndex : scrollViewPage - 1;
    const mangaTitle = getPreferredTitle(manga.title);
    const mangaImage = manga.coverImage?.large || manga.coverImage?.medium || '';

    updateProgress(
      mangaId,
      chapterId,
      currentChapter?.chapter,
      pageIndex,
      pages.length,
      mangaTitle,
      mangaImage,
      currentChapter?.title,
      navProvider
    );

    if (user?.uid) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const item = getProgress(mangaId);
        if (item) {
          updateReadingProgress(user.uid, item, item.mangaTitle, item.mangaImage, item.chapterTitle).catch(
            (err) => console.error('[Manga Read] Failed to save progress:', err)
          );
        }
      }, 3000);
    }
  }, [
    scrollViewPage,
    currentPageIndex,
    pageViewOpen,
    chapterId,
    pages.length,
    manga,
    mangaId,
    currentChapter,
    navProvider,
    user?.uid,
    updateProgress,
    getProgress,
    isPlaceholderData,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Track which page is in view while scrolling (scroll view)
  useEffect(() => {
    if (pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page-index'));
            if (!Number.isNaN(pageNum)) setScrollViewPage(pageNum);
          }
        }
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [pages]);

  const goToChapter = useCallback(
    (target: MangaChapter | null) => {
      if (!target || !chapterId) return;
      markChapterRead(mangaId, chapterId);
      if (user?.uid) {
        markMangaChapterRead(user.uid, mangaId, chapterId).catch(() => {});
      }
      router.replace(
        ROUTES.MANGA_READ(mangaId, target.id, navProvider, resolvedMangadexId ?? undefined)
      );
    },
    [chapterId, mangaId, markChapterRead, navProvider, resolvedMangadexId, router, user?.uid]
  );

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((i) => i - 1);
    } else if (prevChapter) {
      goToChapter(prevChapter);
    }
  }, [currentPageIndex, prevChapter, goToChapter]);

  const handleNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((i) => i + 1);
    } else if (nextChapter) {
      goToChapter(nextChapter);
    }
  }, [currentPageIndex, pages.length, nextChapter, goToChapter]);

  const handlePrevChapter = () => goToChapter(prevChapter);
  const handleNextChapter = () => goToChapter(nextChapter);

  const handleToggleSave = () => {
    if (!chapterId || !manga) return;
    if (!user) {
      openAuthModal();
      return;
    }
    const mangaTitle = getPreferredTitle(manga.title);
    const mangaImage = manga.coverImage?.large || manga.coverImage?.medium || '';
    if (chapterSaved) {
      unsaveChapter(mangaId, chapterId);
      if (user?.uid) {
        removeSavedChapter(user.uid, mangaId, chapterId).catch(() => {});
      }
      return;
    }
    const item = {
      mangaId,
      chapterId,
      chapterNumber: currentChapter?.chapter,
      chapterTitle: currentChapter?.title,
      mangaTitle,
      mangaImage,
      provider: navProvider,
    };
    saveChapter(item);
    if (user?.uid) {
      setSavedChapter(user.uid, { ...item, savedAt: new Date() }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!pageViewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevPage();
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'Escape') setPageViewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pageViewOpen, handlePrevPage, handleNextPage]);

  // Lock document scroll while page-view modal is open
  useEffect(() => {
    if (!pageViewOpen) return;

    const scrollY = window.scrollY;
    const { overflow, position, top, left, right, width } = document.body.style;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.left = left;
      document.body.style.right = right;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [pageViewOpen]);

  useEffect(() => {
    if (!chapterId) {
      router.push(ROUTES.MANGA_DETAIL(mangaId));
    }
  }, [chapterId, mangaId, router]);

  if (!chapterId) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Reader bar — only chrome on read pages; site header hidden for immersive reading */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 pt-[env(safe-area-inset-top,0px)]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(ROUTES.MANGA_DETAIL(mangaId))}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="flex items-center gap-0 rounded-lg border border-gray-700 bg-gray-800/50 flex-1 justify-center max-w-[200px] sm:max-w-[240px] mx-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevChapter}
                disabled={!prevChapter}
                className="min-h-[40px] min-w-[40px] shrink-0 rounded-l-lg rounded-r-none"
                title="Previous chapter"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-300 min-w-[80px] sm:min-w-[100px] text-center px-2 truncate">
                {pages.length > 0
                  ? `Ch. ${
                      chapters.find((c) => c.id === chapterId)?.chapter ||
                      chapters.find((c) => c.id === chapterId)?.title?.replace(/^ch\.?\s*/i, '') ||
                      '—'
                    } · ${scrollViewPage}/${pages.length}`
                  : '—'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextChapter}
                disabled={!nextChapter}
                className="min-h-[40px] min-w-[40px] shrink-0 rounded-r-lg rounded-l-none"
                title="Next chapter"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSave}
                  title={chapterSaved ? 'Remove saved chapter' : 'Save chapter'}
                  className={cn(
                    'flex items-center gap-1.5 min-h-[40px] min-w-[40px]',
                    chapterSaved ? 'text-amber-400 hover:text-amber-300' : ''
                  )}
                >
                  <Bookmark className={cn('w-4 h-4', chapterSaved && 'fill-current')} />
                  <span className="hidden sm:inline text-xs">{chapterSaved ? 'Saved' : 'Save'}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPageViewOpen(true)}
                title="Page view (one page at a time)"
                className="flex items-center gap-1.5"
              >
                <Square className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Page view</span>
              </Button>
            </div>
          </div>
        </div>
        {isFetching && isPlaceholderData && (
          <div className="h-0.5 bg-gray-800 overflow-hidden">
            <div className="h-full w-1/3 bg-amber-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Content - Scroll view: all pages stacked, edge-to-edge */}
      <main className={`w-full pb-4 ${pageViewOpen ? 'overflow-hidden' : ''}`} aria-hidden={pageViewOpen}>
        {isLoading && pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mb-4" />
            <p className="text-gray-400">Loading chapter...</p>
          </div>
        ) : isError || pages.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-amber-400 font-medium mb-2">Not available yet</p>
            <p className="text-gray-400 text-sm mb-4">
              This chapter is not available from the current source. Try another provider or check back later.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.MANGA_DETAIL(mangaId))}>
                Back to Manga
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col w-full md:max-w-[720px] md:mx-auto md:px-4 md:py-4 md:gap-2',
              isPlaceholderData && 'opacity-60'
            )}
          >
            {pages.map((page: MangaChapterPage, idx: number) => (
              <div
                key={idx}
                ref={(el) => {
                  if (el) pageRefs.current.set(idx + 1, el);
                  else pageRefs.current.delete(idx + 1);
                }}
                data-page-index={idx + 1}
                className="w-full select-none md:rounded-lg md:overflow-hidden md:bg-gray-800/30"
              >
                <MangaPageImage
                  src={page.img}
                  alt={`Page ${idx + 1}`}
                  priority={idx < 4}
                  referer={page.headerForImage?.Referer || page.headerForImage?.referer}
                />
              </div>
            ))}
            <div className="flex items-center justify-center gap-0 py-8 px-4">
              <div className="flex items-center gap-0 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handlePrevChapter}
                  disabled={!prevChapter}
                  className="rounded-none min-h-[44px]"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNextChapter}
                  disabled={!nextChapter}
                  className="rounded-none min-h-[44px] bg-amber-600 hover:bg-amber-700"
                >
                  Next
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Page view modal */}
      {pageViewOpen && pages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-black/95 overscroll-none"
          role="dialog"
          aria-modal="true"
          aria-label="Page view"
        >
          {/* Top: Chapter change — fixed chrome, not part of image scroll */}
          <div className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-900/98 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm min-h-[52px] touch-manipulation">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageViewOpen(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white min-h-[44px] min-w-[44px]"
            >
              <X className="w-5 h-5" />
              <span className="hidden sm:inline">Close</span>
            </Button>
            <div className="flex items-center gap-0 rounded-lg border border-gray-700 bg-gray-800/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevChapter}
                disabled={!prevChapter}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-l-lg rounded-r-none"
                title="Previous chapter"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-sm text-gray-300 min-w-[72px] text-center px-2">
                Ch.{' '}
                {chapters.find((c) => c.id === chapterId)?.chapter ||
                  chapters.find((c) => c.id === chapterId)?.title?.replace(/^ch\.?\s*/i, '') ||
                  '—'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextChapter}
                disabled={!nextChapter}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-r-lg rounded-l-none"
                title="Next chapter"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={pageViewZoomOut}
                disabled={pageViewZoom <= PAGE_VIEW_ZOOM_STEPS[0]}
                title="Zoom out"
                className="min-h-[44px] min-w-[40px] text-gray-400 hover:text-white"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <button
                type="button"
                onClick={cyclePageViewZoom}
                className="min-w-[3rem] rounded-md px-1 py-2 text-xs tabular-nums text-gray-400 hover:text-white"
                title="Double-tap page to cycle zoom"
              >
                {pageViewZoom}%
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={pageViewZoomIn}
                disabled={pageViewZoom >= PAGE_VIEW_ZOOM_STEPS[PAGE_VIEW_ZOOM_STEPS.length - 1]}
                title="Zoom in (image area only)"
                className="min-h-[44px] min-w-[40px] text-gray-400 hover:text-white"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSave}
                  title={chapterSaved ? 'Remove saved chapter' : 'Save chapter'}
                  className={cn(
                    'min-h-[44px] min-w-[44px]',
                    chapterSaved ? 'text-amber-400 hover:text-amber-300' : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Bookmark className={cn('w-5 h-5', chapterSaved && 'fill-current')} />
                </Button>
              )}
            </div>
          </div>

          {/* Image only — scroll inside this pane; top/bottom bars stay fixed */}
          <div
            ref={pageViewScrollRef}
            className={cn(
              'min-h-0 flex-1 overscroll-contain bg-[#050505]',
              pageViewZoom > 100
                ? 'overflow-auto touch-pan-x touch-pan-y'
                : 'overflow-x-hidden overflow-y-auto touch-pan-y'
            )}
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              if (e.deltaY < 0) pageViewZoomIn();
              else pageViewZoomOut();
            }}
          >
            <div
              className="mx-auto w-full max-w-3xl pb-6"
              style={pageViewZoom > 100 ? { width: `${pageViewZoom}%` } : undefined}
              onDoubleClick={cyclePageViewZoom}
            >
              <MangaPageImage
                src={pages[currentPageIndex]?.img ?? ''}
                alt={`Page ${currentPageIndex + 1}`}
                priority
                fitInView
                referer={
                  pages[currentPageIndex]?.headerForImage?.Referer ||
                  pages[currentPageIndex]?.headerForImage?.referer
                }
              />
            </div>
          </div>

          {/* Bottom: Page change — fixed chrome */}
          <div className="z-10 flex shrink-0 items-center justify-center border-t border-gray-800 bg-gray-900/98 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm min-h-[60px] touch-manipulation">
            <div className="flex items-center gap-0 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
              <Button
                variant="secondary"
                size="md"
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0 && !prevChapter}
                className="flex items-center gap-1.5 min-h-[44px] min-w-[48px] sm:min-w-[80px] rounded-none"
              >
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="text-sm text-gray-300 min-w-[64px] text-center px-3 py-2 border-x border-gray-700">
                {currentPageIndex + 1} / {pages.length}
              </span>
              <Button
                variant="primary"
                size="md"
                onClick={handleNextPage}
                disabled={currentPageIndex >= pages.length - 1 && !nextChapter}
                className="flex items-center gap-1.5 min-h-[44px] min-w-[48px] sm:min-w-[80px] rounded-none"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-5 h-5 shrink-0" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
