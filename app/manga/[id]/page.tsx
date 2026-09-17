/**
 * Manga Detail Page
 * Manga info and chapters list
 */

'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { SafeImage } from '@/components/ui/SafeImage';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useMangaInfo, useMangaChapters } from '@/hooks/useManga';
import { getPreferredTitle, stripHtml, getScoreColor } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { BookOpen, Star, ChevronDown, ArrowLeft, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { MangaChapter, ListStatus } from '@/types';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useMangaListStore } from '@/store/useMangaListStore';
import { setMangaListItem, removeFromMangaList } from '@/lib/firebase/manga-firestore';
import { AddToMangaListDropdown } from '@/components/manga/AddToMangaListDropdown';

const CHAPTER_PAGE_SIZE = 60;

function isRedundantChapterTitle(title: string | undefined, chapter?: string): boolean {
  if (!title?.trim()) return true;
  const compact = title.replace(/\s+/g, '').toLowerCase();
  if (/^ch\.?\d+(\.\d+)?$/.test(compact) || /^chapter\d+(\.\d+)?$/.test(compact)) {
    return true;
  }
  if (chapter) {
    return (
      compact === `ch.${chapter}` ||
      compact === `ch${chapter}` ||
      compact === `chapter${chapter}`
    );
  }
  return false;
}

export default function MangaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mangaId = params.id as string;
  const mangadexId = searchParams.get('md');
  const [provider, setProvider] = useState('auto');
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [chapterPage, setChapterPage] = useState(1);

  const { data: infoData, isLoading: isInfoLoading, isError: isInfoError } = useMangaInfo(mangaId, mangadexId);
  const manga = infoData?.manga;
  const resolvedMangadexId = mangadexId ?? manga?.mangadexId ?? null;
  const {
    chapters,
    provider: resolvedProviderFromApi,
    mode: chapterMode,
    total: chaptersTotal,
    pageRanges,
    firstChapter,
    unavailableReason,
    isFetching: isChaptersLoading,
    isLoading: isChaptersInitialLoading,
    isPlaceholderData,
  } = useMangaChapters(mangaId, provider, resolvedMangadexId, chapterPage);
  const { user } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const { addToList, removeFromList, getListStatus } = useMangaListStore();

  const resolvedProvider = resolvedProviderFromApi || provider;
  const listStatus = getListStatus(mangaId);
  const totalPages = Math.max(1, pageRanges.length || Math.ceil(chaptersTotal / CHAPTER_PAGE_SIZE) || 1);

  useEffect(() => {
    setChapterPage(1);
  }, [provider, mangaId]);

  useEffect(() => {
    if (chapterPage > totalPages) setChapterPage(totalPages);
  }, [chapterPage, totalPages]);

  const CHAPTER_TABS = [
    { id: 'auto', label: 'Auto' },
    { id: 'mangadex', label: 'MangaDex' },
    { id: 'mangapark', label: 'MangaPark' },
    { id: 'mangasee123', label: 'MangaSee' },
    { id: 'asurascans', label: 'Asura' },
    { id: 'mangapill', label: 'MangaPill' },
    { id: 'mangareader', label: 'MangaReader' },
    { id: 'mangahere', label: 'MangaHere' },
  ] as const;

  if (isInfoLoading && !manga) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-500" />
        </div>
      </div>
    );
  }

  if (!manga || isInfoError) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Manga not found</h1>
            <Button onClick={() => router.push(ROUTES.MANGA)}>Back to Manga</Button>
          </div>
        </div>
      </div>
    );
  }

  const title = getPreferredTitle(manga.title);
  const description = manga.description ? stripHtml(manga.description) : 'No description available.';
  const coverImage = manga.coverImage?.extraLarge || manga.coverImage?.large || manga.bannerImage || '';

  const handleReadChapter = (chapter: MangaChapter) => {
    router.push(ROUTES.MANGA_READ(mangaId, chapter.id, resolvedProvider, resolvedMangadexId ?? undefined));
  };

  const handleListSelect = async (status: ListStatus) => {
    addToList(mangaId, title, coverImage, status);
    if (user?.uid) {
      try {
        await setMangaListItem(user.uid, mangaId, title, coverImage, status);
      } catch (err) {
        console.error('[manga list] Failed to sync to cloud:', err);
      }
    }
  };

  const handleListRemove = async () => {
    removeFromList(mangaId);
    if (user?.uid) {
      try {
        await removeFromMangaList(user.uid, mangaId);
      } catch (err) {
        console.error('[manga list] Failed to remove from cloud:', err);
      }
    }
  };

  const handleReadFirst = () => {
    const first = firstChapter || chapters[0];
    if (first) handleReadChapter(first);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      {/* Banner Section */}
      <div className="relative min-h-[320px] md:h-[420px] w-full">
        {/* Back button - top left */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(ROUTES.MANGA)}
            className="flex items-center gap-2 bg-gray-900/70 hover:bg-gray-800 text-white border border-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        {(manga.bannerImage || coverImage) && (
          <div className="absolute inset-0">
            <SafeImage
              src={manga.bannerImage || coverImage}
              alt={title}
              fill
              className="object-cover opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
          </div>
        )}

        <div className="relative container mx-auto px-4 h-full flex flex-col items-center md:items-start pt-4 pb-5 md:pt-0 md:pb-12 md:justify-end">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-6xl">
            <div className="shrink-0 w-40 mx-auto md:mx-0 md:w-48 md:-mb-24">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border-2 border-amber-500/20">
                <SafeImage
                  src={coverImage}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-amber-600/90 text-white text-xs font-semibold flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Manga
                </div>
              </div>
            </div>

            <div className="flex-1 md:pb-8 text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
              {manga.title?.native && (
                <p className="text-gray-400 mb-3 md:mb-4 text-sm sm:text-base">{manga.title.native}</p>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-3 md:mb-4 text-sm">
                {manga.averageScore && (
                  <div className="flex items-center gap-1">
                    <Star className={`w-4 h-4 fill-current ${getScoreColor(manga.averageScore)}`} />
                    <span className="text-white">{(manga.averageScore / 10).toFixed(1)}</span>
                  </div>
                )}
                {manga.chapters && (
                  <span className="text-gray-300">{manga.chapters} Chapters</span>
                )}
                {manga.status && (
                  <span className="text-gray-300 capitalize">{manga.status.toLowerCase()}</span>
                )}
              </div>

              {manga.genres && manga.genres.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                  {manga.genres.map((g: string) => (
                    <span
                      key={g}
                      className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-400 text-sm border border-amber-600/30"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleReadFirst}
                  disabled={isChaptersLoading || (!firstChapter && chapters.length === 0)}
                  isLoading={isChaptersLoading}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Read Now
                </Button>
                {user ? (
                  <AddToMangaListDropdown
                    currentStatus={listStatus}
                    onSelect={handleListSelect}
                    onRemove={handleListRemove}
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={isChaptersLoading}
                    loading={isChaptersLoading}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={isChaptersLoading}
                    onClick={() => openAuthModal()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-lg font-medium rounded-lg bg-gray-600 border border-gray-500 hover:bg-gray-500 hover:border-gray-400 text-white transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
                  >
                    {isChaptersLoading ? (
                      <span className="inline-block h-5 w-28 bg-white/30 rounded animate-pulse" aria-hidden />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 shrink-0" />
                        Add to List
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">
            {/* Chapters */}
            <div className="bg-gray-800/50 rounded-lg p-4 md:p-6 mb-6 relative">
              {isChaptersLoading && chapters.length > 0 && !isPlaceholderData && (
                <div className="absolute inset-0 bg-gray-900/40 rounded-lg flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold text-white">Chapters</h2>
                  {chaptersTotal > 0 && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      {chapterMode === 'auto' && resolvedProvider !== 'auto' ? (
                        <>
                          Best available · {chaptersTotal} chapters via{' '}
                          <span className="capitalize text-gray-400">{resolvedProvider}</span>
                        </>
                      ) : (
                        <>{chaptersTotal} chapters</>
                      )}
                      {totalPages > 1 && (
                        <>
                          {' · '}page {chapterPage} of {totalPages}
                        </>
                      )}
                    </p>
                  )}
                </div>

                {pageRanges.length > 0 && (
                  <label className="relative inline-flex items-center shrink-0">
                    <span className="sr-only">Chapter page</span>
                    <select
                      value={chapterPage}
                      onChange={(e) => setChapterPage(Number(e.target.value))}
                      disabled={isChaptersInitialLoading || totalPages <= 1}
                      className="appearance-none pl-3 pr-9 py-2 rounded-lg bg-gray-900/80 border border-gray-600/80 text-sm text-gray-100 hover:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[10.5rem] max-w-[16rem]"
                    >
                      {pageRanges.map((opt) => (
                        <option key={opt.page} value={opt.page}>
                          {totalPages > 1
                            ? `${opt.label} · ${opt.page}/${totalPages}`
                            : opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 w-4 h-4 text-gray-400" />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {CHAPTER_TABS.map(({ id, label }) => (
                  <Button
                    key={id}
                    variant={provider === id ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setProvider(id)}
                    disabled={isChaptersLoading && !isPlaceholderData}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {isChaptersInitialLoading && chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500 mb-3" />
                  <p className="text-gray-400 text-sm">Loading chapters...</p>
                </div>
              ) : chapters.length > 0 ? (
                <div
                  className={`max-h-[60vh] overflow-y-auto rounded-lg pr-1 ${
                    isPlaceholderData && isChaptersLoading ? 'opacity-60' : ''
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {chapters.map((chapter) => {
                      const num = chapter.chapter;
                      const titleExtra = isRedundantChapterTitle(chapter.title, num)
                        ? null
                        : chapter.title;
                      return (
                        <button
                          key={chapter.id}
                          onClick={() => handleReadChapter(chapter)}
                          className="bg-gray-700/50 hover:bg-amber-600/20 hover:border-amber-500/50 rounded-md px-3 py-2 transition-all text-left border border-transparent"
                        >
                          <div className="text-white text-sm font-semibold leading-tight">
                            {num ? `Ch. ${num}` : chapter.title || 'Chapter'}
                          </div>
                          {titleExtra && (
                            <div className="text-gray-400 text-xs mt-0.5 line-clamp-1 leading-snug">
                              {titleExtra}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-2">
                    {unavailableReason === 'title_mismatch'
                      ? `No matching chapters on ${provider} for this title.`
                      : `No chapters available on ${provider}.`}
                  </p>
                  <p className="text-gray-500 text-sm mb-2">
                    Try another provider tab above. We only show chapters that match this manga —
                    sources won&apos;t silently swap.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
              <button
                type="button"
                onClick={() => setSynopsisExpanded((e) => !e)}
                className="flex items-center gap-2 w-full text-left mb-3 group"
                aria-expanded={synopsisExpanded}
              >
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${synopsisExpanded ? 'rotate-180' : ''}`}
                />
                <h2 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                  Synopsis
                </h2>
              </button>
              <p
                className={`text-gray-300 leading-relaxed text-sm ${synopsisExpanded ? '' : 'line-clamp-4'}`}
              >
                {description}
              </p>
            </div>

            {manga.status && (
              <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-bold text-white mb-2">Status</h3>
                <p className="text-gray-300 capitalize">{manga.status.toLowerCase().replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
