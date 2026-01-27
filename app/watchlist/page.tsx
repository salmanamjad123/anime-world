/**
 * Watchlist Page
 * Display user's saved anime
 */

'use client';

import { Header } from '@/components/layout/Header';
import { AnimeCard } from '@/components/anime/AnimeCard';
import { Button } from '@/components/ui/Button';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { Heart, Trash2 } from 'lucide-react';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, clearWatchlist } = useWatchlistStore();

  // Note: For now, we'll use the cached data from watchlist
  // In production, you'd fetch full anime data for each ID

  if (watchlist.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-md mx-auto">
            <Heart className="w-24 h-24 text-gray-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Your Watchlist is Empty</h1>
            <p className="text-gray-400 mb-6">
              Start adding anime to your watchlist to keep track of series you want to watch.
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
            <h1 className="text-4xl font-bold text-white mb-2">My Watchlist</h1>
            <p className="text-gray-400">{watchlist.length} anime saved</p>
          </div>

          {watchlist.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Are you sure you want to clear your entire watchlist?')) {
                  clearWatchlist();
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
          {watchlist.map((item) => (
            <div key={item.animeId} className="relative group">
              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  removeFromWatchlist(item.animeId);
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
