/**
 * Spotlight Slider
 * Aniwatch-style hero slider with dynamic anime spotlight (responsive).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, ChevronRight, ChevronLeft, Tv, Clock, Calendar } from 'lucide-react';
import { getPreferredTitle, stripHtml } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import type { Anime } from '@/types';

function formatSpotlightDate(startDate?: { year?: number; month?: number; day?: number }): string | null {
  if (!startDate?.year) return null;
  const { year, month = 1, day = 1 } = startDate;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Props = {
  anime: Anime[];
  isLoading?: boolean;
  autoPlayInterval?: number; // ms, 0 = off
};

export function SpotlightSlider({ anime, isLoading, autoPlayInterval = 6000 }: Props) {
  const [index, setIndex] = useState(0);
  const total = anime.length;

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(total, 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setIndex((i) => (total ? (i - 1 + total) % total : 0));
  }, [total]);

  useEffect(() => {
    if (!autoPlayInterval || total <= 1) return;
    const id = setInterval(goNext, autoPlayInterval);
    return () => clearInterval(id);
  }, [autoPlayInterval, total, goNext]);

  if (isLoading) {
    return (
      <section className="relative w-full min-h-[320px] md:min-h-[400px] lg:min-h-[420px] rounded-xl overflow-hidden bg-gray-800/50 mb-8">
        <div className="absolute inset-0 flex flex-col lg:flex-row">
          <div className="flex-1 p-6 md:p-8 lg:p-10 flex flex-col justify-center lg:max-w-[55%]">
            <div className="h-5 w-24 bg-gray-700 rounded mb-4 animate-pulse" />
            <div className="h-9 w-3/4 bg-gray-700 rounded mb-4 animate-pulse" />
            <div className="flex gap-3 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 w-16 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
            <div className="h-4 w-full bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-4/5 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex-1 min-h-[240px] lg:min-h-full bg-gray-800 animate-pulse" />
        </div>
      </section>
    );
  }

  if (!anime || anime.length === 0) return null;

  return (
    <section className="relative w-full h-[260px] md:h-[360px] lg:h-[420px] rounded-xl overflow-hidden bg-gray-900 mb-8">
      {/* Slides container with smooth horizontal swipe */}
      <div className="relative w-full h-full overflow-hidden">
        <div
          className="flex h-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {anime.map((item, slideIndex) => {
            const title = getPreferredTitle(item.title);
            const description = item.description ? stripHtml(item.description) : '';
            const imageUrl = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large;
            const dateStr = formatSpotlightDate(item.startDate);
            const formatLabel =
              item.format === 'TV_SHORT' ? 'TV Short' : item.format?.replace('_', ' ') || 'TV';

            return (
              <div key={item.id} className="relative min-w-full h-full">
                {/* Background image for this slide */}
                {imageUrl && (
                  <>
                    <Image
                      src={imageUrl}
                      alt={title}
                      fill
                      className="object-contain object-center md:object-cover md:object-center"
                      quality={90}
                      priority={slideIndex === 0}
                      sizes="100vw"
                    />
                    {/* Dark fade from left so text stays readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-900/20" />
                  </>
                )}

                {/* Content sits on top, aligned to left */}
                <div className="relative z-10 h-full flex flex-col justify-center p-6 md:p-8 lg:p-10 max-w-3xl">
                  <span className="text-blue-400 font-semibold text-sm mb-2">
                    #{slideIndex + 1} Spotlight
                  </span>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 line-clamp-2">
                    {title}
                  </h2>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mb-4">
                    <span className="flex items-center gap-1">
                      <Tv className="w-4 h-4 text-gray-400" />
                      {formatLabel}
                    </span>
                    {item.duration != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {item.duration}m
                      </span>
                    )}
                    {dateStr && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {dateStr}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                      HD
                    </span>
                    {item.episodes != null && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                        CC {item.episodes}
                      </span>
                    )}
                  </div>

                  {/* Synopsis */}
                  {description && (
                    <p className="text-gray-300 text-sm md:text-base line-clamp-3 mb-6 max-w-xl">
                      {description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={ROUTES.ANIME_DETAIL(item.id)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Watch Now
                    </Link>
                    <Link
                      href={ROUTES.ANIME_DETAIL(item.id)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-white font-medium transition-colors"
                    >
                      Detail
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Slider arrows on the right edge */}
        {total > 1 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
            <button
              type="button"
              onClick={goPrev}
              className="w-10 h-10 rounded-full bg-gray-900/80 hover:bg-gray-800 text-white flex items-center justify-center transition-colors"
              aria-label="Previous spotlight"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-10 h-10 rounded-full bg-gray-900/80 hover:bg-gray-800 text-white flex items-center justify-center transition-colors"
              aria-label="Next spotlight"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Dots indicator (optional, mobile-friendly) */}
        {total > 1 && (
          <div className="absolute bottom-4 left-6 lg:left-10 flex gap-2 z-20">
            {anime.slice(0, Math.min(total, 8)).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'bg-blue-500 w-6' : 'bg-gray-500 hover:bg-gray-400 w-2'
                }`}
                aria-label={`Go to spotlight ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
