/**
 * Reading History Store
 * Continue reading + per-manga read chapters + saved chapters
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReadingHistoryItem, SavedChapter } from '@/types';

const CONTINUE_READING_MAX = 5;

function isContinueReading(item: ReadingHistoryItem): boolean {
  return !item.completed && item.percentage < 90;
}

function addUnique(ids: string[] | undefined, chapterId: string): string[] {
  const next = ids ?? [];
  return next.includes(chapterId) ? next : [...next, chapterId];
}

function savedKey(mangaId: string, chapterId: string): string {
  return `${mangaId}::${chapterId}`;
}

interface ReadingHistoryStore {
  history: ReadingHistoryItem[];
  readByManga: Record<string, string[]>;
  savedChapters: SavedChapter[];
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
  markChapterRead: (mangaId: string, chapterId: string) => void;
  isChapterRead: (mangaId: string, chapterId: string) => boolean;
  getReadCount: (mangaId: string) => number;
  getProgress: (mangaId: string) => ReadingHistoryItem | undefined;
  saveChapter: (item: Omit<SavedChapter, 'savedAt'> & { savedAt?: Date }) => void;
  unsaveChapter: (mangaId: string, chapterId: string) => void;
  isChapterSaved: (mangaId: string, chapterId: string) => boolean;
  clearHistory: () => void;
  removeFromHistory: (mangaId: string) => void;
  syncWithFirebase: (items: ReadingHistoryItem[]) => void;
  syncSavedChapters: (items: SavedChapter[]) => void;
}

export const useReadingHistoryStore = create<ReadingHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      readByManga: {},
      savedChapters: [],

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
        const { history, readByManga } = get();
        const percentage =
          totalPages > 0 ? Math.round(((pageIndex + 1) / totalPages) * 100) : 0;
        const completed = percentage >= 90;
        const nextRead = completed
          ? addUnique(readByManga[mangaId], chapterId)
          : readByManga[mangaId] ?? [];

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
          readChapterIds: nextRead,
        };

        const filtered = history.filter((item) => item.mangaId !== mangaId);
        const updated = [newItem, ...filtered];

        const inProgress = updated.filter(isContinueReading);
        const nextState: Partial<ReadingHistoryStore> = {
          readByManga: { ...readByManga, [mangaId]: nextRead },
        };
        if (inProgress.length > CONTINUE_READING_MAX) {
          const sorted = [...inProgress].sort(
            (a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
          );
          const toRemove = new Set(sorted.slice(CONTINUE_READING_MAX).map((i) => i.mangaId));
          nextState.history = updated.filter((item) => !toRemove.has(item.mangaId));
        } else {
          nextState.history = updated;
        }
        set(nextState);
      },

      markChapterRead: (mangaId, chapterId) => {
        const { readByManga, history } = get();
        const nextRead = addUnique(readByManga[mangaId], chapterId);
        if (nextRead === readByManga[mangaId]) return;
        set({
          readByManga: { ...readByManga, [mangaId]: nextRead },
          history: history.map((item) =>
            item.mangaId === mangaId ? { ...item, readChapterIds: nextRead } : item
          ),
        });
      },

      isChapterRead: (mangaId, chapterId) =>
        (get().readByManga[mangaId] ?? []).includes(chapterId),

      getReadCount: (mangaId) => (get().readByManga[mangaId] ?? []).length,

      getProgress: (mangaId) => get().history.find((item) => item.mangaId === mangaId),

      saveChapter: (item) => {
        const { savedChapters } = get();
        const key = savedKey(item.mangaId, item.chapterId);
        const without = savedChapters.filter(
          (c) => savedKey(c.mangaId, c.chapterId) !== key
        );
        set({
          savedChapters: [
            { ...item, savedAt: item.savedAt ?? new Date() },
            ...without,
          ],
        });
      },

      unsaveChapter: (mangaId, chapterId) => {
        const key = savedKey(mangaId, chapterId);
        set((state) => ({
          savedChapters: state.savedChapters.filter(
            (c) => savedKey(c.mangaId, c.chapterId) !== key
          ),
        }));
      },

      isChapterSaved: (mangaId, chapterId) =>
        get().savedChapters.some((c) => c.mangaId === mangaId && c.chapterId === chapterId),

      clearHistory: () => set({ history: [] }),

      removeFromHistory: (mangaId) => {
        set((state) => ({
          history: state.history.filter((item) => item.mangaId !== mangaId),
        }));
      },

      syncWithFirebase: (items) => {
        const readByManga: Record<string, string[]> = { ...get().readByManga };
        for (const item of items) {
          const ids = item.readChapterIds?.length
            ? item.readChapterIds
            : item.chapterId
              ? [item.chapterId]
              : [];
          const merged = [...(readByManga[item.mangaId] ?? [])];
          for (const id of ids) {
            if (!merged.includes(id)) merged.push(id);
          }
          readByManga[item.mangaId] = merged;
        }

        const inProgress = items.filter(isContinueReading);
        if (inProgress.length <= CONTINUE_READING_MAX) {
          set({ history: items, readByManga });
          return;
        }
        const sorted = [...inProgress].sort(
          (a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
        );
        const toRemove = new Set(sorted.slice(CONTINUE_READING_MAX).map((i) => i.mangaId));
        set({
          history: items.filter((item) => !toRemove.has(item.mangaId)),
          readByManga,
        });
      },

      syncSavedChapters: (items) => set({ savedChapters: items }),
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
          if (data.state?.savedChapters) {
            data.state.savedChapters = data.state.savedChapters.map(
              (item: SavedChapter & { savedAt: string }) => ({
                ...item,
                savedAt: new Date(item.savedAt),
              })
            );
          }
          if (!data.state?.readByManga) data.state.readByManga = {};
          if (!data.state?.savedChapters) data.state.savedChapters = [];
          return data;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
