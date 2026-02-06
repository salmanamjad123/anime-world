/**
 * Continue Watching Page
 * Resume where you left off – same data as history, single purpose
 */

'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { clearWatchHistory, removeFromWatchHistory } from '@/lib/firebase/firestore';
import { ROUTES } from '@/constants/routes';
import { Play, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContinueWatchingPage() {
  const router = useRouter();
  const { user, isLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const { history, clearHistory, removeFromHistory } = useHistoryStore();

  const continueWatching = history.filter((item) => !item.completed && item.percentage < 90);

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

  if (continueWatching.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-md mx-auto">
            <Play className="w-24 h-24 text-gray-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Nothing to Continue</h1>
            <p className="text-gray-400 mb-6">
              Start watching an anime and it will appear here. Pick up where you left off anytime.
            </p>
            <Button variant="primary" onClick={() => router.push('/')}>
              Browse Anime
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleContinue = (item: { animeId: string; episodeId: string }) => {
    router.push(ROUTES.WATCH(item.animeId, item.episodeId));
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Continue Watching</h1>
            <p className="text-gray-400">{continueWatching.length} in progress</p>
          </div>

          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm('Clear all watch progress?')) return;
              clearHistory();
              if (user?.uid) {
                try {
                  await clearWatchHistory(user.uid);
                } catch (e) {
                  console.error('Failed to clear Firebase history:', e);
                }
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {continueWatching.map((item) => (
            <div
              key={item.animeId}
              className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors group"
            >
              <div className="flex gap-4 p-4">
                <div className="relative w-32 h-20 rounded overflow-hidden shrink-0">
                  <img
                    src={item.animeImage}
                    alt={item.animeTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white line-clamp-1 mb-1">
                    {item.animeTitle}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    Episode {item.episodeNumber}
                    {item.episodeTitle && ` - ${item.episodeTitle}`}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {item.percentage}% watched
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleContinue(item)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    removeFromHistory(item.animeId);
                    if (user?.uid) {
                      try {
                        await removeFromWatchHistory(user.uid, item.animeId);
                      } catch (e) {
                        console.error('Failed to remove from Firebase:', e);
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
