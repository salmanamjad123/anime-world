'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES, AZ_LETTERS } from '@/constants/routes';
import { GENRES } from '@/constants/genres';
import { genreToSlug } from '@/lib/utils/genre-slug';
import { cn } from '@/lib/utils';

const POPULAR_GENRES = ['Action', 'Romance', 'Comedy', 'Isekai', 'Shounen', 'Fantasy', 'Drama', 'Adventure', 'Sports', 'Mystery'];

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

        {/* SEO text - visible to users and crawlers */}
        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-gray-500 text-sm">
            <Link href={ROUTES.HOME} className="hover:text-blue-400 transition-colors">
              Anime Village
            </Link>
            {' — '}
            Watch anime online free. Like Aniwatch, Anilab, HiAnime. Stream One Piece, Naruto, Jujutsu Kaisen, Demon Slayer, Dragon Ball and 10000+ anime with sub and dub.
          </p>
          <p className="mt-1 text-xs text-gray-600">2026 Anime Village. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
