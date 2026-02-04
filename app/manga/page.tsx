/**
 * Manga List Page
 * Trending and popular manga, or genre-filtered
 */

import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { MangaPageContent } from './MangaPageContent';

export default function MangaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900">
          <Header />
          <div className="container mx-auto px-4 py-8 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500" />
          </div>
        </div>
      }
    >
      <MangaPageContent />
    </Suspense>
  );
}
