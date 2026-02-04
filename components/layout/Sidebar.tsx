/**
 * Sidebar Component
 * Slide-out navigation with links and genre filters.
 * Smooth animation, responsive overlay with blurred backdrop.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { GENRES } from '@/constants/genres';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: 'anime' | 'manga';
};

const ANIME_NAV_ITEMS: Array<{ label: string; href: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Manga', href: ROUTES.MANGA, icon: BookOpen },
  { label: 'Most Popular', href: `${ROUTES.SEARCH}?sort=POPULARITY_DESC` },
  { label: 'Movies', href: `${ROUTES.SEARCH}?format=MOVIE` },
  { label: 'TV Series', href: `${ROUTES.SEARCH}?format=TV` },
  { label: 'OVAs', href: `${ROUTES.SEARCH}?format=OVA` },
  { label: 'ONAs', href: `${ROUTES.SEARCH}?format=ONA` },
  { label: 'Specials', href: `${ROUTES.SEARCH}?format=SPECIAL` },
  { label: 'Filter Anime', href: ROUTES.SEARCH },
];

const MANGA_NAV_ITEMS: Array<{ label: string; href: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Manga', href: ROUTES.MANGA, icon: BookOpen },
  { label: 'Most Popular', href: ROUTES.MANGA },
  { label: 'Filter Manga', href: ROUTES.MANGA },
];

export function Sidebar({ isOpen, onClose, activeTab = 'anime' }: Props) {
  const navItems = activeTab === 'manga' ? MANGA_NAV_ITEMS : ANIME_NAV_ITEMS;
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - blurred overlay */}
          <motion.div
            className="fixed inset-0 z-[100] bg-gray-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <motion.aside
            className="fixed left-0 top-0 bottom-0 z-[101] w-[280px] max-w-[85vw] bg-gray-900 border-r border-gray-800 shadow-2xl overflow-y-auto"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="p-4">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors mb-4"
                aria-label="Close menu"
              >
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span className="font-medium">Close menu</span>
              </button>

              {/* Navigation links */}
              <nav className="space-y-1">
                <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Browse
                </h3>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isMangaLink = item.href === ROUTES.MANGA;
                  const isActive = isMangaLink && activeTab === 'manga';
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                        isMangaLink || isActive
                          ? 'text-amber-400 hover:bg-gray-800 hover:text-amber-300'
                          : 'text-gray-200 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 shrink-0" />}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Genre section - anime genres or manga genres based on context */}
              <div className="mt-6">
                <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Genre
                </h3>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {GENRES.slice(0, 16).map((genre) => (
                    <Link
                      key={genre}
                      href={activeTab === 'manga' ? ROUTES.MANGA_GENRE(genre) : `${ROUTES.SEARCH}?genres=${encodeURIComponent(genre)}`}
                      onClick={onClose}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                        activeTab === 'manga'
                          ? 'text-gray-300 hover:bg-gray-800 hover:text-amber-400'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
                {activeTab !== 'manga' && (
                  <Link
                    href={ROUTES.SEARCH}
                    onClick={onClose}
                    className="flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-blue-400 hover:bg-gray-800 hover:text-blue-300 transition-colors"
                  >
                    <span>+ More genres</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
