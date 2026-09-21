'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  getMangaPageImageCandidates,
  normalizeImageUrl,
} from '@/lib/utils/image-url';

interface MangaPageImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Load immediately (first pages above the fold) */
  priority?: boolean;
  /** Page-view modal: full-width image, natural height (parent scrolls) */
  fitInView?: boolean;
  /** Optional CDN Referer from provider (headerForImage) */
  referer?: string;
}

/**
 * Manga chapter page image — proxied, lazy-loaded, with retry on failure.
 * Avoids MangaDex/MangaHere hotlink blocks and CDN rate limits from loading all pages at once.
 */
export function MangaPageImage({
  src,
  alt,
  className,
  priority = false,
  fitInView = false,
  referer,
}: MangaPageImageProps) {
  const rawUrl = normalizeImageUrl(src) ?? '';
  const containerRef = useRef<HTMLDivElement>(null);
  const candidateIndex = useRef(0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => {
    if (!priority || !rawUrl) return null;
    return getMangaPageImageCandidates(rawUrl, referer)[0] ?? null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    candidateIndex.current = 0;
    setFailed(false);
    const next = getMangaPageImageCandidates(rawUrl, referer);
    if (priority && next[0]) {
      setShouldLoad(true);
      setDisplaySrc(next[0]);
    } else {
      setShouldLoad(false);
      setDisplaySrc(null);
    }
  }, [rawUrl, priority, referer]);

  useEffect(() => {
    if (shouldLoad || priority || !rawUrl) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          setDisplaySrc(getMangaPageImageCandidates(rawUrl, referer)[0] ?? null);
          observer.disconnect();
        }
      },
      { rootMargin: '900px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad, priority, rawUrl, referer]);

  const handleError = useCallback(() => {
    const list = getMangaPageImageCandidates(rawUrl, referer);
    const next = candidateIndex.current + 1;
    if (next < list.length) {
      candidateIndex.current = next;
      setDisplaySrc(list[next]);
      return;
    }
    setFailed(true);
  }, [rawUrl, referer]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-gray-800/40',
        fitInView ? 'min-h-0' : 'min-h-[120px]'
      )}
    >
      {displaySrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt}
          className={cn(
            fitInView
              ? 'block h-auto w-full max-w-none select-none [image-rendering:auto]'
              : 'w-full h-auto block',
            className
          )}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={handleError}
        />
      ) : failed ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-gray-500 text-sm">Could not load this page</p>
          <button
            type="button"
            className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
            onClick={() => {
              candidateIndex.current = 0;
              setFailed(false);
              const base = getMangaPageImageCandidates(rawUrl, referer)[0];
              setDisplaySrc(
                base ? `${base}${base.includes('?') ? '&' : '?'}_r=${Date.now()}` : null
              );
            }}
          >
            Tap to retry
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'w-full animate-pulse bg-gray-800/80',
            fitInView ? 'min-h-[50vh]' : 'aspect-[2/3] max-h-[85vh]'
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
