/**
 * History Store
 * Manage watch history with localStorage persistence
 * Continue Watching limited to max 5 anime (oldest removed when exceeded)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryItem, EpisodeProgress } from '@/types';

const CONTINUE_WATCHING_MAX = 5;

function isContinueWatching(item: HistoryItem): boolean {
  return !item.completed && item.percentage < 90;
}

interface HistoryStore {
  history: HistoryItem[];
  
  // Actions
  updateProgress: (
    animeId: string,
    episodeId: string,
    episodeNumber: number,
    timestamp: number,
    duration: number,
    animeTitle: string,
    animeImage: string,
    episodeTitle?: string
  ) => void;
  getProgress: (animeId: string) => HistoryItem | undefined;
  clearHistory: () => void;
  removeFromHistory: (animeId: string) => void;
  
  // Sync with Firebase
  syncWithFirebase: (items: HistoryItem[]) => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      updateProgress: (
        animeId,
        episodeId,
        episodeNumber,
        timestamp,
        duration,
        animeTitle,
        animeImage,
        episodeTitle
      ) => {
        const { history } = get();
        const percentage = duration > 0 ? Math.round((timestamp / duration) * 100) : 0;
        const completed = percentage >= 90; // Consider completed if watched 90%+

        const newItem: HistoryItem = {
          animeId,
          episodeId,
          episodeNumber,
          timestamp,
          duration,
          percentage,
          completed,
          lastWatched: new Date(),
          animeTitle,
          animeImage,
          episodeTitle,
        };

        // Remove existing entry for this anime and add the new one at the beginning
        const filtered = history.filter((item) => item.animeId !== animeId);
        const updated = [newItem, ...filtered];

        // Limit Continue Watching to max 5 - remove oldest in-progress items
        const inProgress = updated.filter(isContinueWatching);
        if (inProgress.length > CONTINUE_WATCHING_MAX) {
          const sorted = [...inProgress].sort(
            (a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()
          );
          const toRemove = sorted.slice(CONTINUE_WATCHING_MAX).map((i) => i.animeId);
          const toRemoveSet = new Set(toRemove);
          set({
            history: updated.filter((item) => !toRemoveSet.has(item.animeId)),
          });
        } else {
          set({ history: updated });
        }
      },

      getProgress: (animeId) => {
        return get().history.find((item) => item.animeId === animeId);
      },

      clearHistory: () => {
        set({ history: [] });
      },

      removeFromHistory: (animeId) => {
        set((state) => ({
          history: state.history.filter((item) => item.animeId !== animeId),
        }));
      },

      syncWithFirebase: (items) => {
        const inProgress = items.filter(isContinueWatching);
        if (inProgress.length <= CONTINUE_WATCHING_MAX) {
          set({ history: items });
          return;
        }
        const sorted = [...inProgress].sort(
          (a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()
        );
        const toRemove = new Set(sorted.slice(CONTINUE_WATCHING_MAX).map((i) => i.animeId));
        set({
          history: items.filter((item) => !toRemove.has(item.animeId)),
        });
      },
    }),
    {
      name: 'anime-history',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          const data = JSON.parse(str);
          if (data.state?.history) {
            data.state.history = data.state.history.map((item: any) => ({
              ...item,
              lastWatched: new Date(item.lastWatched),
            }));
          }
          return data;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
