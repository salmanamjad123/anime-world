'use client';

import { useCallback, useEffect, useState } from 'react';
import NextImage, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';
import { ANIME_PLACEHOLDER, normalizeImageUrl } from '@/lib/utils/image-url';

function isRemoteUrl(src: ImageProps['src']): src is string {
  return typeof src === 'string' && /^https?:\/\//.test(src);
}

function resolveSrc(src: ImageProps['src']): ImageProps['src'] {
  if (typeof src === 'string') {
    return normalizeImageUrl(src) ?? ANIME_PLACEHOLDER;
  }
  return src;
}

/**
 * Remote URLs render as native <img> (no Vercel /_next/image).
 * Failed loads fall back to the local placeholder. referrerPolicy helps
 * HiAnime/MAL CDNs that block cross-site hotlinking.
 */
export function SafeImage({
  className,
  fill,
  width,
  height,
  priority,
  sizes,
  alt,
  src,
  onError,
  unoptimized,
  ...rest
}: ImageProps) {
  const [currentSrc, setCurrentSrc] = useState<ImageProps['src']>(() => resolveSrc(src));

  useEffect(() => {
    setCurrentSrc(resolveSrc(src));
  }, [src]);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (typeof currentSrc === 'string' && currentSrc !== ANIME_PLACEHOLDER) {
        setCurrentSrc(ANIME_PLACEHOLDER);
      }
      onError?.(event);
    },
    [currentSrc, onError]
  );

  if (isRemoteUrl(currentSrc)) {
    const loading = priority ? 'eager' : 'lazy';

    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={alt ?? ''}
          className={cn('absolute inset-0 h-full w-full', className)}
          sizes={sizes}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt ?? ''}
        width={width}
        height={height}
        className={className}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={handleError}
      />
    );
  }

  return (
    <NextImage
      src={currentSrc}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      unoptimized={unoptimized ?? true}
      onError={handleError}
      {...rest}
    />
  );
}
