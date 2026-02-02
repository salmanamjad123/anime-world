/**
 * Spotlight Slider
 * Aniwatch-style hero slider with dynamic anime spotlight (responsive).
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

export function SpotlightSlider({ anime, isLoading, autoPlayInterval = 10000 }: Props) {
  const total = anime.length;
  const [index, setIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const isJumpingRef = useRef(false);

  const touchState = useRef<{
    startX: number;
    startY: number;
    startTime: number;
  } | null>(null);

  const extendedAnime = useMemo(() => {
    if (total <= 1) return anime;
    return [anime[total - 1], ...anime, anime[0]];
  }, [anime, total]);

  const displayIndex = total <= 1 ? 0 : index;
  const realIndex = total <= 1 ? 0 : ((index - 1 + total) % total);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    if (isJumpingRef.current) return;
    setIndex((i) => (i >= total ? total + 1 : i + 1));
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    if (isJumpingRef.current) return;
    setIndex((i) => (i <= 1 ? 0 : i - 1));
  }, [total]);

  const handleTransitionEnd = useCallback(() => {
    if (total <= 1) return;
    if (index === 0) {
      isJumpingRef.current = true;
      setIsTransitioning(false);
      setIndex(total);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          isJumpingRef.current = false;
        });
      });
    } else if (index === total + 1) {
      isJumpingRef.current = true;
      setIsTransitioning(false);
      setIndex(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          isJumpingRef.current = false;
        });
      });
    }
  }, [index, total]);

  const handleSwipeStart = useCallback(
    (clientX: number, clientY: number) => {
      if (total <= 1) return;
      touchState.current = { startX: clientX, startY: clientY, startTime: Date.now() };
      setDragOffset(0);
    },
    [total]
  );

  const handleSwipeMove = useCallback(
    (clientX: number, clientY: number) => {
      if (total <= 1 || !touchState.current || isJumpingRef.current) return;
      const { startX, startY } = touchState.current;
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        setDragOffset(deltaX);
      }
    },
    [total]
  );

  const handleSwipeEnd = useCallback(
    (clientX: number, clientY: number) => {
      if (total <= 1 || !touchState.current) return;
      const { startX, startY, startTime } = touchState.current;
      touchState.current = null;
      setDragOffset(0);

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);

      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      const isStrongSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD;

      if (isHorizontalSwipe && isStrongSwipe) {
        if (deltaX > 0) goPrev();
        else goNext();
      }
    },
    [total, goNext, goPrev]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY),
    [handleSwipeStart]
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => handleSwipeMove(e.touches[0].clientX, e.touches[0].clientY),
    [handleSwipeMove]
  );
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) =>
      handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
    [handleSwipeEnd]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (total <= 1) return;
      handleSwipeStart(e.clientX, e.clientY);
      const onMouseMove = (ev: MouseEvent) => handleSwipeMove(ev.clientX, ev.clientY);
      const onMouseUp = (ev: MouseEvent) => {
        handleSwipeEnd(ev.clientX, ev.clientY);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [total, handleSwipeStart, handleSwipeMove, handleSwipeEnd]
  );

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
    <section className="relative w-full h-[340px] sm:h-[360px] md:h-[360px] lg:h-[420px] rounded-xl overflow-hidden bg-gray-900 mb-8">
      {/* Slides container - swipeable on touch and mouse drag */}
      <div
        className="relative w-full h-full overflow-hidden touch-pan-y select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        <div
          className={`flex h-full ease-out ${isTransitioning && dragOffset === 0 ? 'transition-transform duration-700' : ''}`}
          style={{
            transform: `translateX(calc(-${displayIndex * 100}% + ${dragOffset}px))`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extendedAnime.map((item, slideIndex) => {
            const title = getPreferredTitle(item.title);
            const description = item.description ? stripHtml(item.description) : '';
            const imageUrl = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large;
            const dateStr = formatSpotlightDate(item.startDate);
            const formatLabel =
              item.format === 'TV_SHORT' ? 'TV Short' : item.format?.replace('_', ' ') || 'TV';

            return (
              <div key={`spotlight-${slideIndex}-${item.id}`} className="relative min-w-full h-full">
                {/* Background image for this slide */}
                {imageUrl && (
                  <>
                    <Image
                      src={imageUrl}
                      alt={title}
                      fill
                      className="object-cover object-center"
                      quality={90}
                      priority={slideIndex === 1 || (total <= 1 && slideIndex === 0)}
                      sizes="100vw"
                    />
                    {/* Dark fade from left so text stays readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-900/20" />
                  </>
                )}

                {/* Content sits on top, aligned to left - mobile: compact, desktop: spacious */}
                <div className="relative z-10 h-full flex flex-col justify-center p-4 sm:p-6 md:p-8 lg:p-10 max-w-3xl">
                  <span className="text-blue-400 font-semibold text-xs sm:text-sm mb-1 sm:mb-2">
                    #{total > 1 ? ((slideIndex - 1 + total) % total) + 1 : slideIndex + 1} Spotlight
                  </span>
                  <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-4 line-clamp-2 leading-tight">
                    {title}
                  </h2>

                  {/* Metadata row - tighter on mobile */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-300 mb-2 sm:mb-4">
                    <span className="flex items-center gap-1">
                      <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
                      <span className="truncate">{formatLabel}</span>
                    </span>
                    {item.duration != null && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        {item.duration}m
                      </span>
                    )}
                    {dateStr && (
                      <span className="hidden sm:flex items-center gap-1 shrink-0">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        <span className="truncate">{dateStr}</span>
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 sm:px-2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-medium shrink-0">
                      HD
                    </span>
                    {item.episodes != null && (
                      <span className="hidden sm:inline px-1.5 py-0.5 sm:px-2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-medium shrink-0">
                        CC {item.episodes}
                      </span>
                    )}
                  </div>

                  {/* Synopsis - fewer lines on mobile */}
                  {description && (
                    <p className="text-gray-300 text-xs sm:text-sm md:text-base line-clamp-2 sm:line-clamp-3 mb-3 sm:mb-6 max-w-xl">
                      {description}
                    </p>
                  )}

                  {/* Actions - stacked on mobile for easier tap, row on desktop */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Link
                      href={ROUTES.ANIME_DETAIL(item.id)}
                      className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-semibold transition-colors"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                      Watch Now
                    </Link>
                    <Link
                      href={ROUTES.ANIME_DETAIL(item.id)}
                      className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-white text-sm sm:text-base font-medium transition-colors"
                    >
                      Detail
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Slider arrows + dots: bottom bar on mobile, separate on desktop */}
        {total > 1 && (
          <>
            {/* Arrows - bottom right on mobile, right side on desktop */}
            <div className="absolute bottom-3 right-4 sm:bottom-auto sm:right-3 sm:top-1/2 sm:-translate-y-1/2 flex flex-row sm:flex-col gap-2 z-20">
              <button
                type="button"
                onClick={goPrev}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors touch-manipulation"
                aria-label="Previous spotlight"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors touch-manipulation"
                aria-label="Next spotlight"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dots - bottom left on mobile, same on desktop */}
            <div className="absolute bottom-3 sm:bottom-4 left-4 sm:left-6 lg:left-10 flex gap-1.5 sm:gap-2 z-20">
            {anime.slice(0, Math.min(total, 8)).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => total > 1 && setIndex(i + 1)}
                className={`h-2 rounded-full transition-all ${
                  i === realIndex ? 'bg-blue-500 w-6' : 'bg-gray-500 hover:bg-gray-400 w-2'
                }`}
                aria-label={`Go to spotlight ${i + 1}`}
              />
            ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
