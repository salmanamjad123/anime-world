'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getPreferredTitle } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import type { Anime } from '@/types';

interface RelatedAnimeSidebarProps {
  anime: Anime[];
  isLoading?: boolean;
  title?: string;
  className?: string;
}

export function RelatedAnimeSidebar({
  anime,
  isLoading,
  title = 'Related',
  className,
}: RelatedAnimeSidebarProps) {
  return (
    <section className={className}>
      <h3 className="text-base font-bold text-white mb-4">{title}</h3>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-14 w-10 shrink-0 bg-gray-700 rounded" />
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-700 rounded w-3/4" />
                <div className="mt-2 h-3 bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : !anime || anime.length === 0 ? (
        <p className="text-gray-500 text-sm">No related anime.</p>
      ) : (
        <div className="space-y-3">
          {anime.slice(0, 8).map((item) => {
            const titleText = getPreferredTitle(item.title);
            return (
              <Link
                key={item.id}
                href={ROUTES.ANIME_DETAIL(item.id)}
                className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-700/50 transition-colors group"
              >
                <div className="relative h-14 w-10 shrink-0 rounded overflow-hidden bg-gray-800">
                  <Image
                    src={item.coverImage.medium}
                    alt={titleText}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
                    {titleText}
                  </h4>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.episodes && (
                      <span className="text-xs text-gray-400">{item.episodes} eps</span>
                    )}
                    {item.format && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                        {item.format}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-600 text-gray-400 group-hover:text-white transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
