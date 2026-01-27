/**
 * Watchlist Store
 * Manage user's watchlist with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem } from '@/types';

interface WatchlistStore {
  watchlist: WatchlistItem[];
  
  // Actions
  addToWatchlist: (animeId: string, title: string, image: string) => void;
  removeFromWatchlist: (animeId: string) => void;
  isInWatchlist: (animeId: string) => boolean;
  clearWatchlist: () => void;
  
  // Sync with Firebase (optional)
  syncWithFirebase: (items: WatchlistItem[]) => void;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: [],

      addToWatchlist: (animeId, title, image) => {
        const { watchlist } = get();
        
        // Don't add if already in watchlist
        if (watchlist.some((item) => item.animeId === animeId)) {
          return;
        }

        const newItem: WatchlistItem = {
          animeId,
          title,
          image,
          addedAt: new Date(),
        };

        set({ watchlist: [newItem, ...watchlist] });
      },

      removeFromWatchlist: (animeId) => {
        set((state) => ({
          watchlist: state.watchlist.filter((item) => item.animeId !== animeId),
        }));
      },

      isInWatchlist: (animeId) => {
        return get().watchlist.some((item) => item.animeId === animeId);
      },

      clearWatchlist: () => {
        set({ watchlist: [] });
      },

      syncWithFirebase: (items) => {
        set({ watchlist: items });
      },
    }),
    {
      name: 'anime-watchlist',
      // Serialize dates properly
      serialize: (state) => JSON.stringify(state),
      deserialize: (str) => {
        const data = JSON.parse(str);
        // Convert date strings back to Date objects
        if (data.state?.watchlist) {
          data.state.watchlist = data.state.watchlist.map((item: any) => ({
            ...item,
            addedAt: new Date(item.addedAt),
          }));
        }
        return data;
      },
    }
  )
);
