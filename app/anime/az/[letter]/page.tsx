'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { AnimeGrid } from '@/components/anime/AnimeGrid';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import type { Anime } from '@/types';
import type { HiAnimeAZItem } from '@/lib/api/hianime';

function mapHiAnimeToAnime(item: HiAnimeAZItem): Anime {
  const name = item.name || 'Unknown';
  const poster = item.poster || '';
  const sub = item.episodes?.sub ?? 0;
  const dub = item.episodes?.dub ?? 0;
  const episodes = Math.max(sub, dub) || undefined;

  return {
    id: item.id || '',
    title: { romaji: name, english: name },
    coverImage: {
      large: poster,
      medium: poster,
    },
    genres: item.type ? [item.type] : [],
    averageScore: item.rating ? parseFloat(item.rating) * 10 : undefined,
    episodes,
    status: undefined,
    format: undefined,
  };
}

export default function AnimeAZPage() {
  const params = useParams();
  const letter = decodeURIComponent((params.letter as string) || 'a');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['azlist', letter, page],
    queryFn: async () => {
      const res = await fetch(`/api/azlist/${encodeURIComponent(letter)}?page=${page}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const anime: Anime[] = (data?.animes || []).map(mapHiAnimeToAnime);
  const totalPages = data?.totalPages ?? 1;
  const hasNextPage = data?.hasNextPage ?? false;
  const currentPage = data?.currentPage ?? page;

  const displayLetter = letter === '0-9' ? '0-9' : letter === 'other' ? 'Other' : letter.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold text-white mb-2">
          Anime List – {displayLetter}
        </h1>
        <p className="text-gray-400 mb-8">
          Browse all anime starting with &quot;{displayLetter}&quot;
        </p>

        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Failed to load anime list. Please try again.</p>
          </div>
        )}

        <AnimeGrid anime={anime} isLoading={isLoading} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Previous
            </Button>
            <span className="text-gray-400 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
