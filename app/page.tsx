'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { SpotlightSlider } from '@/components/anime/SpotlightSlider';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { RecommendedAnimeRow } from '@/components/anime/RecommendedAnimeRow';
import { ScheduleSection } from '@/components/schedule/ScheduleSection';
import { useTrendingAnime, usePopularAnime } from '@/hooks/useAnime';
import { TrendingUp, Star } from 'lucide-react';

function useSlowLoad(isLoading: boolean, isFetching: boolean, resetKey?: string) {
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    setSlowLoad(false);
    if (!isLoading && !isFetching) return;

    const timer = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading, isFetching, resetKey]);

  return slowLoad;
}

export default function Home() {
  const {
    data: trendingData,
    isLoading: isTrendingLoading,
    isFetching: isTrendingFetching,
    isError: isTrendingError,
    error: trendingError,
    refetch: refetchTrending,
  } = useTrendingAnime(1, 18);
  const {
    data: popularData,
    isLoading: isPopularLoading,
    isFetching: isPopularFetching,
    isError: isPopularError,
    error: popularError,
    refetch: refetchPopular,
  } = usePopularAnime(1, 18);

  const trendingSlow = useSlowLoad(isTrendingLoading, isTrendingFetching, 'trending');
  const popularSlow = useSlowLoad(isPopularLoading, isPopularFetching, 'popular');

  const trendingAnime = trendingData?.data?.Page?.media || [];
  const popularAnime = popularData?.data?.Page?.media || [];

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-4">
        <section className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-300 mb-1">
            Anime Village – Watch Anime Online Free
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm max-w-2xl">
            Anime Village is a free place to watch anime online. Stream thousands of series in English sub and dub.
          </p>
        </section>

        <SpotlightSlider
          anime={trendingAnime.slice(0, 8)}
          isLoading={isTrendingLoading && trendingAnime.length === 0}
          autoPlayInterval={8000}
        />

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Trending Now</h2>
          </div>
          <AnimeGrid
            anime={trendingAnime}
            isLoading={isTrendingLoading}
            isError={isTrendingError}
            errorMessage={trendingError instanceof Error ? trendingError.message : undefined}
            onRetry={() => refetchTrending()}
            slowLoad={trendingSlow}
          />
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-white">Popular Anime</h2>
          </div>
          <AnimeGrid
            anime={popularAnime}
            isLoading={isPopularLoading}
            isError={isPopularError}
            errorMessage={popularError instanceof Error ? popularError.message : undefined}
            onRetry={() => refetchPopular()}
            slowLoad={popularSlow}
          />
        </section>

        <RecommendedAnimeRow
          title="Recommended for you"
          anime={trendingAnime.slice(0, 12)}
          isLoading={isTrendingLoading && trendingAnime.length === 0}
          className="mb-12"
        />

        <ScheduleSection />
      </main>
    </div>
  );
}
