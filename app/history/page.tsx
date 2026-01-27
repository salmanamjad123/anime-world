/**
 * History Page
 * Display watch history and continue watching
 */

'use client';

import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ROUTES } from '@/constants/routes';
import { Clock, Play, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const router = useRouter();
  const { history, clearHistory, removeFromHistory } = useHistoryStore();

  // Separate into continue watching (incomplete) and completed
  const continueWatching = history.filter((item) => !item.completed && item.percentage < 90);
  const completed = history.filter((item) => item.completed || item.percentage >= 90);

  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-md mx-auto">
            <Clock className="w-24 h-24 text-gray-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">No Watch History</h1>
            <p className="text-gray-400 mb-6">
              Your watch history will appear here as you watch anime episodes.
            </p>
            <Button variant="primary" onClick={() => router.push('/')}>
              Start Watching
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleContinue = (item: any) => {
    router.push(ROUTES.WATCH(item.animeId, item.episodeId));
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Watch History</h1>
            <p className="text-gray-400">{history.length} episodes watched</p>
          </div>

          {history.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Are you sure you want to clear your watch history?')) {
                  clearHistory();
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear History
            </Button>
          )}
        </div>

        {/* Continue Watching Section */}
        {continueWatching.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Play className="w-6 h-6 text-blue-500" />
              Continue Watching
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueWatching.map((item) => (
                <div
                  key={item.animeId}
                  className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={item.animeImage}
                        alt={item.animeTitle}
                        className="w-full h-full object-cover"
                      />
                      {/* Progress Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Info */}
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

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromHistory(item.animeId)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full History */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-gray-500" />
            All History
          </h2>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={`${item.animeId}-${item.episodeId}`}
                className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Thumbnail */}
                  <div className="relative w-20 h-14 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={item.animeImage}
                      alt={item.animeTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{item.animeTitle}</h3>
                    <p className="text-sm text-gray-400">
                      Episode {item.episodeNumber}
                      {item.episodeTitle && ` - ${item.episodeTitle}`}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">
                      {item.completed ? (
                        <span className="text-green-500">✓ Completed</span>
                      ) : (
                        <span>{item.percentage}% watched</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(item.lastWatched).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleContinue(item)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <button
                    onClick={() => removeFromHistory(item.animeId)}
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
    </div>
  );
}
