/**
 * Genre landing page - SEO-optimized pages for each genre
 * Renders search results filtered by genre
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { useSearchAnime } from '@/hooks/useAnime';
import { slugToGenre } from '@/lib/utils/genre-slug';
import { ROUTES } from '@/constants/routes';
import { ArrowLeft } from 'lucide-react';

export default function GenrePage() {
  const params = useParams();
  const slug = params.slug as string;
  const genre = slugToGenre(slug);

  const { data, isLoading } = useSearchAnime(
    { genres: genre ? [genre] : [], sort: 'POPULARITY_DESC' },
    1,
    48
  );

  const results = data?.data?.Page?.media ?? [];
  const totalResults = data?.data?.Page?.pageInfo?.total ?? 0;

  if (!genre) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Genre not found</h1>
          <Link href={ROUTES.SEARCH} className="text-blue-400 hover:underline">
            Browse all anime
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <nav className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-400">
          <Link href={ROUTES.HOME} className="hover:text-blue-400 transition-colors">
            Home
          </Link>
          <span className="mx-2">•</span>
          <Link href={ROUTES.SEARCH} className="hover:text-blue-400 transition-colors">
            Search
          </Link>
          <span className="mx-2">•</span>
          <span className="text-gray-300">{genre} Anime</span>
        </nav>

        <div className="mb-6 flex items-center gap-4">
          <Link
            href={ROUTES.SEARCH}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All genres
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
            {genre} Anime
          </h1>
          <p className="text-gray-400">
            Watch the best {genre.toLowerCase()} anime. {totalResults} series available with sub and dub.
          </p>
        </div>

        <AnimeGrid anime={results} isLoading={isLoading} />
      </div>
    </div>
  );
}
