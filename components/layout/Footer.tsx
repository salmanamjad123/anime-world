'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Instagram } from 'lucide-react';
import { ROUTES, AZ_LETTERS } from '@/constants/routes';
import { genreToSlug } from '@/lib/utils/genre-slug';
import { cn } from '@/lib/utils';
import { SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL } from '@/constants/site';

const POPULAR_GENRES = ['Action', 'Romance', 'Comedy', 'Isekai', 'Shounen', 'Fantasy', 'Drama', 'Adventure', 'Sports', 'Mystery'];

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z" />
    </svg>
  );
}

export function Footer() {
  const pathname = usePathname();
  const match = pathname.match(/^\/anime\/az\/([^/]+)$/);
  const activeLetter = match ? decodeURIComponent(match[1]).toLowerCase() : null;

  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-900/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Popular Genres - SEO internal linking */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Anime by Genre
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_GENRES.map((genre) => (
                <Link
                  key={genre}
                  href={ROUTES.GENRE(genreToSlug(genre))}
                  className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  {genre}
                </Link>
              ))}
              <Link
                href={ROUTES.SEARCH}
                className="px-3 py-1.5 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                All genres →
              </Link>
            </div>
          </div>

          {/* A-Z Anime List */}
          <div>
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
        </div>

        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-gray-500 text-sm">
            <Link href={ROUTES.HOME} className="hover:text-blue-400 transition-colors">
              Anime Village
            </Link>
            {' — '}
            Stream thousands of anime free with sub and dub. One Piece, Naruto, Jujutsu Kaisen, Demon Slayer, Dragon Ball and more.
          </p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href={SOCIAL_INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label="Anime Village on Instagram"
              className="text-gray-500 hover:text-white transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href={SOCIAL_TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label="Anime Village on TikTok"
              className="text-gray-500 hover:text-white transition-colors"
            >
              <TikTokIcon className="h-5 w-5" />
            </a>
          </div>
          <p className="mt-3 text-xs text-gray-600">2026 Anime Village. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
