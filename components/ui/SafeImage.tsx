'use client';

import NextImage, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

function isRemoteUrl(src: ImageProps['src']): src is string {
  return typeof src === 'string' && /^https?:\/\//.test(src);
}

/**
 * Remote URLs render as native <img> (no Vercel /_next/image).
 * Local/static assets use next/image with unoptimized fallback.
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
  if (isRemoteUrl(src)) {
    const loading = priority ? 'eager' : 'lazy';

    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ''}
          className={cn('absolute inset-0 h-full w-full', className)}
          sizes={sizes}
          loading={loading}
          decoding="async"
          onError={onError}
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ''}
        width={width}
        height={height}
        className={className}
        loading={loading}
        decoding="async"
        onError={onError}
      />
    );
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      unoptimized={unoptimized ?? true}
      onError={onError}
      {...rest}
    />
  );
}
