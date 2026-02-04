/**
 * Manga Reader Page
 * Two modes: Scroll view (all pages) | Page view (modal, one page at a time)
 */

'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useChapterPages, useMangaChapters } from '@/hooks/useManga';
import { ROUTES } from '@/constants/routes';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  LayoutList,
  Square,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { MangaChapter, MangaChapterPage } from '@/types';

export default function MangaReadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mangaId = params.id as string;
  const chapterId = searchParams.get('chapterId');
  const provider = searchParams.get('provider') || 'mangapill';

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageViewOpen, setPageViewOpen] = useState(false);
  const [scrollViewPage, setScrollViewPage] = useState(1);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const { data: chaptersData } = useMangaChapters(mangaId, provider);
  const { data: chapterData, isLoading, isError, refetch } = useChapterPages(
    chapterId,
    provider
  );

  const chapters: MangaChapter[] = chaptersData?.chapters || [];
  const pages = chapterData?.pages || [];

  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  useEffect(() => {
    setCurrentPageIndex(0);
    setScrollViewPage(1);
  }, [chapterId]);

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

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((i) => i - 1);
    } else if (prevChapter) {
      router.push(ROUTES.MANGA_READ(mangaId, prevChapter.id, provider));
    }
  }, [currentPageIndex, prevChapter, mangaId, provider, router]);

  const handleNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((i) => i + 1);
    } else if (nextChapter) {
      router.push(ROUTES.MANGA_READ(mangaId, nextChapter.id, provider));
    }
  }, [currentPageIndex, pages.length, nextChapter, mangaId, provider, router]);

  const handlePrevChapter = () => {
    if (prevChapter) router.push(ROUTES.MANGA_READ(mangaId, prevChapter.id, provider));
  };

  const handleNextChapter = () => {
    if (nextChapter) router.push(ROUTES.MANGA_READ(mangaId, nextChapter.id, provider));
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

  useEffect(() => {
    if (!chapterId) {
      router.push(ROUTES.MANGA_DETAIL(mangaId));
    }
  }, [chapterId, mangaId, router]);

  if (!chapterId) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      {/* Reader bar */}
      <div className="sticky top-16 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
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
                  ? `Ch. ${chapters.find((c) => c.id === chapterId)?.chapter || '—'} · ${scrollViewPage}/${pages.length}`
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

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageViewOpen(true)}
              title="Page view (one page at a time)"
              className="flex items-center gap-1.5 shrink-0"
            >
              <Square className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Page view</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content - Scroll view: all pages stacked */}
      <main className="container mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
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
          <div className="flex flex-col items-center w-full max-w-[720px] mx-auto">
            <div className="flex items-center gap-2 mb-4 self-start">
              <LayoutList className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-400">Scroll view · All pages</span>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {pages.map((page: MangaChapterPage, idx: number) => (
                <div
                  key={idx}
                  ref={(el) => {
                    if (el) pageRefs.current.set(idx + 1, el);
                    else pageRefs.current.delete(idx + 1);
                  }}
                  data-page-index={idx + 1}
                  className="w-full bg-gray-800/30 rounded-lg overflow-hidden select-none"
                >
                  <img
                    src={page.img}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-auto block"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Page view modal */}
      {pageViewOpen && pages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Page view"
        >
          {/* Top: Chapter change - buttons close to count */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800 shrink-0 min-h-[52px]">
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
                Ch. {chapters.find((c) => c.id === chapterId)?.chapter || '—'}
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
          </div>

          {/* Content - one page, fit to view */}
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden p-2 sm:p-4">
            <img
              src={pages[currentPageIndex]?.img}
              alt={`Page ${currentPageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>

          {/* Bottom: Page change - buttons close to count */}
          <div className="flex items-center justify-center px-4 py-3 border-t border-gray-800 shrink-0 min-h-[60px]">
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
