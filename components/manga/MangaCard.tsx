/**
 * Manga Card Component
 * Display manga in a card format - matches AnimeCard style
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getPreferredTitle } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import type { Manga } from '@/types';
import { Star, BookOpen } from 'lucide-react';

interface MangaCardProps {
  manga: Manga;
}

export function MangaCard({ manga }: MangaCardProps) {
  const title = getPreferredTitle(manga.title);
  const score = manga.averageScore ? manga.averageScore / 10 : null;

  return (
    <Link href={ROUTES.MANGA_DETAIL(manga.id)} className="block h-full">
      <Card hover className="overflow-hidden group h-full flex flex-col">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={manga.coverImage.large}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {manga.genres && manga.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {manga.genres.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs px-2 py-1 rounded-full bg-amber-600/80 text-white"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {score && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-white">{score.toFixed(1)}</span>
            </div>
          )}

          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-semibold text-white">Manga</span>
          </div>
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between">
          <h3 className="font-semibold text-sm line-clamp-2 text-white group-hover:text-amber-400 transition-colors">
            {title}
          </h3>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            {manga.chapters && <span>{manga.chapters} ch</span>}
            {manga.status && <span className="capitalize">{manga.status.toLowerCase()}</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}
