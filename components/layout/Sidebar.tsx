/**
 * Sidebar Component
 * Slide-out navigation with links and genre filters.
 * Smooth animation, responsive overlay with blurred backdrop.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { GENRES } from '@/constants/genres';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const NAV_ITEMS = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Most Popular', href: `${ROUTES.SEARCH}?sort=POPULARITY_DESC` },
  { label: 'Movies', href: `${ROUTES.SEARCH}?format=MOVIE` },
  { label: 'TV Series', href: `${ROUTES.SEARCH}?format=TV` },
  { label: 'OVAs', href: `${ROUTES.SEARCH}?format=OVA` },
  { label: 'ONAs', href: `${ROUTES.SEARCH}?format=ONA` },
  { label: 'Specials', href: `${ROUTES.SEARCH}?format=SPECIAL` },
  { label: 'Filter Anime', href: ROUTES.SEARCH },
];

export function Sidebar({ isOpen, onClose }: Props) {
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
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="block px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Genre section */}
              <div className="mt-6">
                <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Genre
                </h3>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {GENRES.slice(0, 16).map((genre) => (
                    <Link
                      key={genre}
                      href={`${ROUTES.SEARCH}?genres=${encodeURIComponent(genre)}`}
                      onClick={onClose}
                      className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors truncate"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
                <Link
                  href={ROUTES.SEARCH}
                  onClick={onClose}
                  className="flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-blue-400 hover:bg-gray-800 hover:text-blue-300 transition-colors text-sm font-medium"
                >
                  <span>+ More genres</span>
                </Link>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
