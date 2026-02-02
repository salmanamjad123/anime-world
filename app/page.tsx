'use client';

import { Header } from '@/components/layout/Header';
import { SpotlightSlider } from '@/components/anime/SpotlightSlider';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { RecommendedAnimeRow } from '@/components/anime/RecommendedAnimeRow';
import { useTrendingAnime, usePopularAnime } from '@/hooks/useAnime';
import { TrendingUp, Star } from 'lucide-react';

export default function Home() {
  const { data: trendingData, isLoading: isTrendingLoading } = useTrendingAnime(1, 18);
  const { data: popularData, isLoading: isPopularLoading } = usePopularAnime(1, 18);

  const trendingAnime = trendingData?.data?.Page?.media || [];
  const popularAnime = popularData?.data?.Page?.media || [];

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <section className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
            Watch Anime Online Free
          </h1>
          {/* <p className="text-gray-400 text-sm sm:text-base max-w-2xl">
            Like Aniwatch, Anilab, HiAnime. Stream One Piece, Naruto, Jujutsu Kaisen, Demon Slayer and 10000+ anime with sub and dub.
          </p> */}
        </section>
        {/* Spotlight Slider (first section) */}
        <SpotlightSlider
          anime={trendingAnime.slice(0, 8)}
          isLoading={isTrendingLoading}
          autoPlayInterval={8000}
        />

        {/* Hero Section */}
        {/* <section className="mb-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              Welcome to Anime World
            </h1>
            <p className="text-gray-400 text-lg">
              Stream thousands of anime series with subtitles and dubs. Your ultimate anime streaming platform.
            </p>
          </div>
        </section> */}

        {/* Trending Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Trending Now</h2>
          </div>
          <AnimeGrid anime={trendingAnime} isLoading={isTrendingLoading} />
        </section>

        {/* Popular Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-white">Popular Anime</h2>
          </div>
          <AnimeGrid anime={popularAnime} isLoading={isPopularLoading} />
        </section>

        {/* Recommended for you (trending) */}
        <RecommendedAnimeRow
          title="Recommended for you"
          anime={trendingAnime.slice(0, 12)}
          isLoading={isTrendingLoading}
          className="mb-4"
        />
      </main>
    </div>
  );
}
