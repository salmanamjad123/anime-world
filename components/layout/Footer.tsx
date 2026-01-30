'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES, AZ_LETTERS } from '@/constants/routes';
import { cn } from '@/lib/utils';

export function Footer() {
  const pathname = usePathname();
  const match = pathname.match(/^\/anime\/az\/([^/]+)$/);
  const activeLetter = match ? decodeURIComponent(match[1]).toLowerCase() : null;

  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-900/50">
      <div className="container mx-auto px-4 py-8">
        {/* A-Z Anime List */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Browse Anime A–Z
          </h3>
          <div className="flex flex-wrap gap-2">
            {AZ_LETTERS.map((letter) => {
              const letterKey =
                letter === '0-9' ? '0-9' : letter === 'all' ? 'all' : letter.toLowerCase();
              const isActive = activeLetter === letterKey;

              return (
                <Link
                  key={letter}
                  href={ROUTES.ANIME_AZ(letterKey)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  )}
                >
                  {letter}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-gray-500 text-sm">
          <p className="mt-1 text-xs">2026. All rights reserved. Anime World</p>
        </div>
      </div>
    </footer>
  );
}
