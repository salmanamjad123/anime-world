'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  getMangaPageImageUrl,
  normalizeImageUrl,
} from '@/lib/utils/image-url';

interface MangaPageImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Load immediately (first pages above the fold) */
  priority?: boolean;
  /** Single-page modal: fit within viewport height */
  fitInView?: boolean;
}

/**
 * Manga chapter page image — proxied, lazy-loaded, with retry on failure.
 * Avoids MangaDex hotlink blocks and CDN rate limits from loading all pages at once.
 */
export function MangaPageImage({
  src,
  alt,
  className,
  priority = false,
  fitInView = false,
}: MangaPageImageProps) {
  const rawUrl = normalizeImageUrl(src) ?? '';
  const containerRef = useRef<HTMLDivElement>(null);
  const retryStage = useRef(0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [displaySrc, setDisplaySrc] = useState<string | null>(
    priority && rawUrl ? getMangaPageImageUrl(rawUrl) : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    retryStage.current = 0;
    setFailed(false);
    if (priority && rawUrl) {
      setShouldLoad(true);
      setDisplaySrc(getMangaPageImageUrl(rawUrl));
    } else {
      setShouldLoad(false);
      setDisplaySrc(null);
    }
  }, [rawUrl, priority]);

  useEffect(() => {
    if (shouldLoad || priority || !rawUrl) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          setDisplaySrc(getMangaPageImageUrl(rawUrl));
          observer.disconnect();
        }
      },
      { rootMargin: '500px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad, priority, rawUrl]);

  const handleError = useCallback(() => {
    if (!rawUrl) {
      setFailed(true);
      return;
    }

    if (retryStage.current === 0) {
      retryStage.current = 1;
      setDisplaySrc(rawUrl);
      return;
    }

    setFailed(true);
  }, [rawUrl]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-gray-800/40',
        fitInView ? 'flex items-center justify-center min-h-0 h-full' : 'min-h-[120px]'
      )}
    >
      {displaySrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt}
          className={cn(
            fitInView
              ? 'max-w-full max-h-[calc(100vh-12rem)] object-contain mx-auto block'
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
              retryStage.current = 0;
              setFailed(false);
              setDisplaySrc(getMangaPageImageUrl(rawUrl));
            }}
          >
            Tap to retry
          </button>
        </div>
      ) : (
        <div
          className="w-full aspect-[2/3] max-h-[85vh] animate-pulse bg-gray-800/80"
          aria-hidden
        />
      )}
    </div>
  );
}
