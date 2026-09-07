/**
 * Reading History Store
 * Manage continue reading with localStorage persistence (max 5 in progress)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReadingHistoryItem } from '@/types';

const CONTINUE_READING_MAX = 5;

function isContinueReading(item: ReadingHistoryItem): boolean {
  return !item.completed && item.percentage < 90;
}

interface ReadingHistoryStore {
  history: ReadingHistoryItem[];
  updateProgress: (
    mangaId: string,
    chapterId: string,
    chapterNumber: string | undefined,
    pageIndex: number,
    totalPages: number,
    mangaTitle: string,
    mangaImage: string,
    chapterTitle?: string,
    provider?: string
  ) => void;
  getProgress: (mangaId: string) => ReadingHistoryItem | undefined;
  clearHistory: () => void;
  removeFromHistory: (mangaId: string) => void;
  syncWithFirebase: (items: ReadingHistoryItem[]) => void;
}

export const useReadingHistoryStore = create<ReadingHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      updateProgress: (
        mangaId,
        chapterId,
        chapterNumber,
        pageIndex,
        totalPages,
        mangaTitle,
        mangaImage,
        chapterTitle,
        provider
      ) => {
        const { history } = get();
        const percentage =
          totalPages > 0 ? Math.round(((pageIndex + 1) / totalPages) * 100) : 0;
        const completed = percentage >= 90;

        const newItem: ReadingHistoryItem = {
          mangaId,
          chapterId,
          chapterNumber,
          pageIndex,
          totalPages,
          percentage,
          completed,
          lastRead: new Date(),
          mangaTitle,
          mangaImage,
          chapterTitle,
          provider,
        };

        const filtered = history.filter((item) => item.mangaId !== mangaId);
        const updated = [newItem, ...filtered];

        const inProgress = updated.filter(isContinueReading);
        if (inProgress.length > CONTINUE_READING_MAX) {
          const sorted = [...inProgress].sort(
            (a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
          );
          const toRemove = new Set(sorted.slice(CONTINUE_READING_MAX).map((i) => i.mangaId));
          set({ history: updated.filter((item) => !toRemove.has(item.mangaId)) });
        } else {
          set({ history: updated });
        }
      },

      getProgress: (mangaId) => get().history.find((item) => item.mangaId === mangaId),

      clearHistory: () => set({ history: [] }),

      removeFromHistory: (mangaId) => {
        set((state) => ({
          history: state.history.filter((item) => item.mangaId !== mangaId),
        }));
      },

      syncWithFirebase: (items) => {
        const inProgress = items.filter(isContinueReading);
        if (inProgress.length <= CONTINUE_READING_MAX) {
          set({ history: items });
          return;
        }
        const sorted = [...inProgress].sort(
          (a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
        );
        const toRemove = new Set(sorted.slice(CONTINUE_READING_MAX).map((i) => i.mangaId));
        set({ history: items.filter((item) => !toRemove.has(item.mangaId)) });
      },
    }),
    {
      name: 'manga-reading-history',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          if (data.state?.history) {
            data.state.history = data.state.history.map(
              (item: ReadingHistoryItem & { lastRead: string }) => ({
                ...item,
                lastRead: new Date(item.lastRead),
              })
            );
          }
          return data;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
