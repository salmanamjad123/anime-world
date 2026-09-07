/**
 * Manga Read List Store
 * Manage user's manga list with status: Reading, On-Hold, Plan to read, Dropped, Completed
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MangaListItem, ListStatus } from '@/types';

const DEFAULT_STATUS: ListStatus = 'plan-to-watch';

interface MangaListStore {
  readlist: MangaListItem[];
  addToList: (
    mangaId: string,
    title: string,
    image: string,
    status?: ListStatus
  ) => void;
  setListStatus: (mangaId: string, status: ListStatus) => void;
  removeFromList: (mangaId: string) => void;
  getListStatus: (mangaId: string) => ListStatus | null;
  getItemsByStatus: (status: ListStatus) => MangaListItem[];
  isInList: (mangaId: string) => boolean;
  clearList: () => void;
  syncWithFirebase: (items: MangaListItem[]) => void;
}

export const useMangaListStore = create<MangaListStore>()(
  persist(
    (set, get) => ({
      readlist: [],

      addToList: (mangaId, title, image, status = DEFAULT_STATUS) => {
        const { readlist } = get();
        const existing = readlist.find((item) => item.mangaId === mangaId);
        if (existing) {
          set({
            readlist: readlist.map((item) =>
              item.mangaId === mangaId ? { ...item, status, title, image } : item
            ),
          });
        } else {
          const newItem: MangaListItem = {
            mangaId,
            title,
            image,
            addedAt: new Date(),
            status,
          };
          set({ readlist: [newItem, ...readlist] });
        }
      },

      setListStatus: (mangaId, status) => {
        const { readlist } = get();
        if (!readlist.find((i) => i.mangaId === mangaId)) return;
        set({
          readlist: readlist.map((i) =>
            i.mangaId === mangaId ? { ...i, status } : i
          ),
        });
      },

      removeFromList: (mangaId) => {
        set((state) => ({
          readlist: state.readlist.filter((item) => item.mangaId !== mangaId),
        }));
      },

      getListStatus: (mangaId) => {
        const item = get().readlist.find((i) => i.mangaId === mangaId);
        return item ? (item.status || DEFAULT_STATUS) : null;
      },

      getItemsByStatus: (status) => {
        return get().readlist.filter(
          (item) => (item.status || DEFAULT_STATUS) === status
        );
      },

      isInList: (mangaId) => get().readlist.some((item) => item.mangaId === mangaId),

      clearList: () => set({ readlist: [] }),

      syncWithFirebase: (items) => {
        set({
          readlist: items.map((item) => ({
            ...item,
            addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(item.addedAt),
            status: item.status || DEFAULT_STATUS,
          })),
        });
      },
    }),
    {
      name: 'manga-readlist',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          if (data.state?.readlist) {
            data.state.readlist = data.state.readlist.map((item: MangaListItem & { addedAt: string }) => ({
              ...item,
              addedAt: new Date(item.addedAt),
              status: item.status || DEFAULT_STATUS,
            }));
          }
          return data;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
