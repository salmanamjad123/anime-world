/**
 * Watchlist / List Store
 * Manage user's anime list with status: Watching, On-Hold, Plan to watch, Dropped, Completed
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem, ListStatus } from '@/types';

const DEFAULT_STATUS: ListStatus = 'plan-to-watch';

interface WatchlistStore {
  watchlist: WatchlistItem[];

  // Actions
  addToList: (animeId: string, title: string, image: string, status?: ListStatus) => void;
  setListStatus: (animeId: string, status: ListStatus) => void;
  removeFromList: (animeId: string) => void;
  getListStatus: (animeId: string) => ListStatus | null;
  getItemsByStatus: (status: ListStatus) => WatchlistItem[];
  isInList: (animeId: string) => boolean;
  clearList: () => void;
  clearByStatus: (status: ListStatus) => void;

  // Legacy / Firebase sync
  addToWatchlist: (animeId: string, title: string, image: string) => void;
  removeFromWatchlist: (animeId: string) => void;
  syncWithFirebase: (items: WatchlistItem[]) => void;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: [],

      addToList: (animeId, title, image, status = DEFAULT_STATUS) => {
        const { watchlist } = get();
        const existing = watchlist.find((item) => item.animeId === animeId);
        if (existing) {
          set({
            watchlist: watchlist.map((item) =>
              item.animeId === animeId ? { ...item, status, title, image } : item
            ),
          });
        } else {
          const newItem: WatchlistItem = {
            animeId,
            title,
            image,
            addedAt: new Date(),
            status,
          };
          set({ watchlist: [newItem, ...watchlist] });
        }
      },

      setListStatus: (animeId, status) => {
        const { watchlist } = get();
        const item = watchlist.find((i) => i.animeId === animeId);
        if (!item) return;
        set({
          watchlist: watchlist.map((i) =>
            i.animeId === animeId ? { ...i, status } : i
          ),
        });
      },

      removeFromList: (animeId) => {
        set((state) => ({
          watchlist: state.watchlist.filter((item) => item.animeId !== animeId),
        }));
      },

      getListStatus: (animeId) => {
        const item = get().watchlist.find((i) => i.animeId === animeId);
        return item ? (item.status || DEFAULT_STATUS) : null;
      },

      getItemsByStatus: (status) => {
        return get().watchlist.filter(
          (item) => (item.status || DEFAULT_STATUS) === status
        );
      },

      isInList: (animeId) => {
        return get().watchlist.some((item) => item.animeId === animeId);
      },

      clearList: () => set({ watchlist: [] }),
      clearByStatus: (status) =>
        set((s) => ({
          watchlist: s.watchlist.filter((i) => (i.status || DEFAULT_STATUS) !== status),
        })),

      // Legacy
      addToWatchlist: (animeId, title, image) => {
        get().addToList(animeId, title, image, 'plan-to-watch');
      },
      removeFromWatchlist: (animeId) => {
        get().removeFromList(animeId);
      },

      syncWithFirebase: (items) => {
        set({
          watchlist: items.map((item) => ({
            ...item,
            addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(item.addedAt),
            status: item.status || DEFAULT_STATUS,
          })),
        });
      },
    }),
    {
      name: 'anime-watchlist',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          if (data.state?.watchlist) {
            data.state.watchlist = data.state.watchlist.map((item: any) => ({
              ...item,
              addedAt: new Date(item.addedAt),
              status: item.status || DEFAULT_STATUS,
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
