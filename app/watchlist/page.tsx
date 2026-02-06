/**
 * Watchlist Page
 * Display user's saved anime
 */

'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Button } from '@/components/ui/Button';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import { Heart, Trash2 } from 'lucide-react';

export default function WatchlistPage() {
  const router = useRouter();
  const { user, isLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const { getItemsByStatus, removeFromList, clearByStatus } = useWatchlistStore();
  const planToWatch = getItemsByStatus('plan-to-watch');

  useEffect(() => {
    if (!user && !isLoading) router.replace(ROUTES.HOME);
    else if (user && !isLoading && !user.emailVerified) {
      router.replace(ROUTES.HOME);
      openAuthModal('verify');
    }
  }, [user, isLoading, router, openAuthModal]);

  if ((!user || !user.emailVerified) && !isLoading) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (planToWatch.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-md mx-auto">
            <Heart className="w-24 h-24 text-gray-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Plan to Watch is Empty</h1>
            <p className="text-gray-400 mb-6">
              Add anime to your list from the anime page using &quot;Add to List&quot; → &quot;Plan to watch&quot;.
            </p>
            <Button variant="primary" onClick={() => window.location.href = '/'}>
              Browse Anime
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Plan to Watch</h1>
            <p className="text-gray-400">{planToWatch.length} anime</p>
          </div>

          {planToWatch.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Are you sure you want to clear your Plan to watch list?')) {
                  clearByStatus('plan-to-watch');
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Watchlist Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {planToWatch.map((item) => (
            <div key={item.animeId} className="relative group">
              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  removeFromList(item.animeId);
                }}
                className="absolute top-2 right-2 z-10 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from watchlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Anime Card (simplified version) */}
              <a
                href={`/anime/${item.animeId}`}
                className="block bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <div className="relative aspect-[2/3]">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-white line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Added {new Date(item.addedAt).toLocaleDateString()}
                  </p>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
