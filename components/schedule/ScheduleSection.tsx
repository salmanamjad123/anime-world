/**
 * Schedule Section
 * Estimated anime airing schedule - Aniwatch style
 * Matches site theme (blue accents, gray-900) and responsive
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, Play, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSchedule } from '@/hooks/useSchedule';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function ScheduleSection() {
  const { data, isLoading } = useSchedule();
  const isMobile = useIsMobile();
  const [currentTime, setCurrentTime] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setCurrentTime(formatTime(new Date()));
    const interval = setInterval(() => setCurrentTime(formatTime(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data?.days?.length) {
      const today = new Date().toISOString().slice(0, 10);
      const idx = data.days.findIndex((d) => d.date === today);
      setSelectedIndex(idx >= 0 ? idx : 0);
    }
  }, [data?.days]);

  useEffect(() => {
    setExpanded(false);
  }, [selectedIndex]);

  useEffect(() => {
    tabRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIndex]);

  const days = data?.days ?? [];
  const selectedDay = days[selectedIndex];
  const getDatePart = (dateStr: string) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const INITIAL_COUNT = isMobile ? 5 : 7;
  const visibleItems = selectedDay?.items ?? [];
  const hasMore = visibleItems.length > INITIAL_COUNT;
  const displayedItems = expanded ? visibleItems : visibleItems.slice(0, INITIAL_COUNT);

  if (isLoading) {
    return (
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl md:text-2xl font-bold text-white">Estimated Schedule</h2>
          </div>
          <div className="h-8 w-24 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 w-24 bg-gray-700 rounded-lg animate-pulse shrink-0" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-3 border-b border-gray-700/50 last:border-0">
                <div className="h-4 w-14 bg-gray-700 rounded animate-pulse shrink-0" />
                <div className="h-4 flex-1 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-700 rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!days.length) return null;

  return (
    <section className="mb-12 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl md:text-2xl font-bold text-white">Estimated Schedule</h2>
        </div>
        <div className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full text-sm font-medium tabular-nums shrink-0">
          {currentTime}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 md:p-6 pb-6 overflow-visible">
        {/* Day tabs - mobile: tabs scroll behind arrow overlays, desktop: all 7 */}
        <div className="relative mb-4 md:mb-6">
          {/* Prev arrow overlay - mobile only, tabs scroll behind */}
          <div className="md:hidden absolute left-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
            <div className="w-8 h-full bg-gradient-to-r from-gray-800/80 to-transparent" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                disabled={selectedIndex === 0}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors shadow-md"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs - scrollable on mobile, padding so tabs go behind arrows, wrap on desktop */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide min-w-0 md:overflow-visible md:flex-wrap pl-12 pr-12 md:pl-0 md:pr-0">
            {days.map((day, i) => (
              <button
                ref={(el) => { tabRefs.current[i] = el; }}
                key={day.date}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  'shrink-0 rounded-lg transition-colors text-left',
                  selectedIndex === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700/70 text-gray-300 hover:bg-gray-700 hover:text-white',
                  'px-4 py-3 md:px-3 md:py-2 min-w-[90px] md:min-w-0'
                )}
              >
                <div className="md:hidden">
                  <div className="font-bold text-sm">{day.shortLabel}</div>
                  <div className="text-xs mt-0.5 opacity-90">{getDatePart(day.date)}</div>
                </div>
                <span className="hidden md:inline font-medium text-sm whitespace-nowrap">
                  {day.label}
                </span>
              </button>
            ))}
          </div>

          {/* Next arrow overlay - mobile only, tabs scroll behind */}
          <div className="md:hidden absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end pointer-events-none">
            <div className="w-8 h-full bg-gradient-to-l from-gray-800/80 to-transparent" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setSelectedIndex((i) => Math.min(days.length - 1, i + 1))}
                disabled={selectedIndex === days.length - 1}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors shadow-md"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Schedule list - mobile: 5 items no scroll until See more, then scroll in same height; desktop: 7 items */}
        <div
          className={cn(
            'rounded-lg transition-[max-height] duration-300 shrink-0',
            visibleItems.length > 0 && 'min-h-[300px]',
            isMobile
              ? expanded
                ? 'max-h-[430px] overflow-y-auto'
                : 'max-h-[430px] overflow-hidden'
              : expanded
                ? 'max-h-[60vh] overflow-y-auto'
                : 'max-h-none overflow-y-visible'
          )}
        >
          {visibleItems.length ? (
            <div className="divide-y divide-gray-700/50">
              {displayedItems.map((item) => (
                <Link
                  key={`${item.animeId}-${item.episode}-${item.time}`}
                  href={ROUTES.ANIME_DETAIL(item.animeId)}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-1 hover:bg-gray-700/30 rounded-lg transition-colors group"
                >
                  <span className="text-gray-400 text-sm font-medium w-14 shrink-0 tabular-nums">
                    {item.time}
                  </span>
                  <span className="flex-1 text-white group-hover:text-blue-400 transition-colors line-clamp-2 sm:line-clamp-1 min-w-0">
                    {item.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-400 text-sm shrink-0">
                    <Play className="w-3.5 h-3.5 text-blue-500" />
                    Episode {item.episode}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-400">No episodes scheduled for this day.</p>
            </div>
          )}
        </div>

        {/* See more / See less - always below list, no overlap */}
        {(hasMore || expanded) && (
          <div className="mt-4 flex justify-start shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-medium text-sm transition-colors"
            >
              {expanded ? (
                <>
                  See less
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  See more
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
