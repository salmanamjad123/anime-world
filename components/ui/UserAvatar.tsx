'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Profile image URL (Cloudinary, Firebase Auth, etc.) */
  photoURL?: string | null;
  /** Fallback: display name or email for initial */
  name?: string | null;
  /** Size: sm=32, md=40, lg=64, xl=128 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: { w: 32, h: 32, text: 'text-sm' },
  md: { w: 40, h: 40, text: 'text-base' },
  lg: { w: 64, h: 64, text: 'text-xl' },
  xl: { w: 128, h: 128, text: 'text-3xl' },
};

/**
 * Reusable user avatar - used in profile, comments, replies, header
 * Single source for consistent display everywhere user interacts
 */
export function UserAvatar({ photoURL, name, size = 'md', className }: UserAvatarProps) {
  const { w, h, text } = SIZE_MAP[size];
  const initial = (name || '?')[0].toUpperCase();

  if (photoURL) {
    return (
      <Image
        src={photoURL}
        alt=""
        width={w}
        height={h}
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gray-600 flex items-center justify-center text-gray-400 font-medium shrink-0',
        text,
        className
      )}
      style={{ width: w, height: h }}
    >
      {initial}
    </div>
  );
}
