/**
 * Anime Card Component
 * Display anime in a card format
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getPreferredTitle, formatNumber } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import type { Anime } from '@/types';
import { Star } from 'lucide-react';

interface AnimeCardProps {
  anime: Anime;
}

export function AnimeCard({ anime }: AnimeCardProps) {
  const title = getPreferredTitle(anime.title);
  const score = anime.averageScore ? anime.averageScore / 10 : null;

  return (
    <Link href={ROUTES.ANIME_DETAIL(anime.id)}>
      <Card hover className="overflow-hidden group">
        {/* Image Container */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={anime.coverImage.large}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {anime.genres.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs px-2 py-1 rounded-full bg-blue-600/80 text-white"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Score Badge */}
          {score && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-white">{score.toFixed(1)}</span>
            </div>
          )}

          {/* Format Badge */}
          {anime.format && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
              <span className="text-xs font-semibold text-white">{anime.format}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-semibold text-sm line-clamp-2 text-white group-hover:text-blue-400 transition-colors">
            {title}
          </h3>
          
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            {anime.episodes && <span>{anime.episodes} eps</span>}
            {anime.status && <span className="capitalize">{anime.status.toLowerCase()}</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}
