/**
 * History Store
 * Manage watch history with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryItem, EpisodeProgress } from '@/types';

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
        set({ history: [newItem, ...filtered] });
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
        set({ history: items });
      },
    }),
    {
      name: 'anime-history',
      serialize: (state) => JSON.stringify(state),
      deserialize: (str) => {
        const data = JSON.parse(str);
        if (data.state?.history) {
          data.state.history = data.state.history.map((item: any) => ({
            ...item,
            lastWatched: new Date(item.lastWatched),
          }));
        }
        return data;
      },
    }
  )
);
