/**
 * Manga Detail Page
 * Manga info and chapters list
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useMangaInfo, useMangaChapters } from '@/hooks/useManga';
import { getPreferredTitle, stripHtml, getScoreColor } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { BookOpen, Star, ChevronDown, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import type { MangaChapter } from '@/types';

export default function MangaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mangaId = params.id as string;
  const [provider, setProvider] = useState('mangapill');
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const { data: infoData, isLoading: isInfoLoading, isError: isInfoError } = useMangaInfo(mangaId);
  const { data: chaptersData, isFetching: isChaptersLoading } = useMangaChapters(mangaId, provider);

  const manga = infoData?.manga;
  const chapters: MangaChapter[] = chaptersData?.chapters || [];
  const resolvedProvider = chaptersData?.provider || provider;

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
    router.push(ROUTES.MANGA_READ(mangaId, chapter.id, resolvedProvider));
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
            <Image
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
                <Image
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
              {isChaptersLoading && chapters.length > 0 && (
                <div className="absolute inset-0 bg-gray-900/50 rounded-lg flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-white">Chapters</h2>
                <div className="flex gap-2">
                  {['mangapill', 'mangadex', 'mangareader'].map((p) => (
                    <Button
                      key={p}
                      variant={provider === p ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setProvider(p)}
                      disabled={isChaptersLoading}
                      className="capitalize"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              {isChaptersLoading && chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500 mb-3" />
                  <p className="text-gray-400 text-sm">Loading chapters...</p>
                </div>
              ) : chapters.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto rounded-lg pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {chapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        onClick={() => handleReadChapter(chapter)}
                        className="bg-gray-700/50 hover:bg-amber-600/20 hover:border-amber-500/50 rounded-lg p-4 transition-all text-left border border-transparent"
                      >
                        <div className="text-white font-semibold">
                          {chapter.chapter ? `Ch. ${chapter.chapter}` : 'Chapter'}
                        </div>
                        {chapter.title && (
                          <div className="text-gray-400 text-sm mt-1 line-clamp-2">{chapter.title}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-2">No chapters available for this provider.</p>
                  <p className="text-gray-500 text-sm mb-2">
                    Try switching to another provider above. We also try MangaDex automatically.
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
