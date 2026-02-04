/**
 * Manga Page Content - Client component with useSearchParams
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MangaGrid } from '@/components/manga/MangaGrid';
import { useTrendingManga, usePopularManga, useMangaByGenre } from '@/hooks/useManga';
import { TrendingUp, Star, BookOpen } from 'lucide-react';

export function MangaPageContent() {
  const searchParams = useSearchParams();
  const genresParam = searchParams.get('genres') || '';
  const genres = genresParam ? genresParam.split(',').map((g) => g.trim()).filter(Boolean) : [];

  const { data: trendingData, isLoading: isTrendingLoading } = useTrendingManga(1, 18);
  const { data: popularData, isLoading: isPopularLoading } = usePopularManga(1, 18);
  const { data: genreData, isLoading: isGenreLoading } = useMangaByGenre(genres, 1, 24);

  const trendingManga = trendingData?.data?.Page?.media || [];
  const popularManga = popularData?.data?.Page?.media || [];
  const genreManga = genreData?.data?.Page?.media || [];
  const showGenreView = genres.length > 0;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {showGenreView ? (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-8 h-8 text-amber-500" />
              <h1 className="text-2xl sm:text-4xl font-bold text-white">
                {genres.join(', ')} Manga
              </h1>
            </div>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mb-6">
              Manga in {genres.join(', ')}. Read chapters free.
            </p>
            <MangaGrid manga={genreManga} isLoading={isGenreLoading} />
          </section>
        ) : (
          <>
            <section className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl sm:text-4xl font-bold text-white">
                  Read Manga Online
                </h1>
              </div>
              <p className="text-gray-400 text-sm sm:text-base max-w-2xl">
                Discover trending and popular manga. Read chapters free with fast loading.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-amber-500" />
                <h2 className="text-2xl font-bold text-white">Trending Now</h2>
              </div>
              <MangaGrid manga={trendingManga} isLoading={isTrendingLoading} />
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Star className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold text-white">Popular Manga</h2>
              </div>
              <MangaGrid manga={popularManga} isLoading={isPopularLoading} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
