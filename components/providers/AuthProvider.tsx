/**
 * Auth Provider
 * Firebase authentication listener
 */

'use client';

import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useUserStore } from '@/store/useUserStore';
import { onAuthChange } from '@/lib/firebase/auth';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import { getWatchlist, getWatchHistory, trimContinueWatchingToMax } from '@/lib/firebase/firestore';
import {
  getMangaList,
  getReadingHistory,
  getSavedChapters,
  trimContinueReadingToMax,
} from '@/lib/firebase/manga-firestore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useMangaListStore } from '@/store/useMangaListStore';
import { useReadingHistoryStore } from '@/store/useReadingHistoryStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, clearUser } = useUserStore();
  const { syncWithFirebase: syncWatchlist, clearList } = useWatchlistStore();
  const { syncWithFirebase: syncHistory, clearHistory } = useHistoryStore();
  const { syncWithFirebase: syncMangaList } = useMangaListStore();
  const { syncWithFirebase: syncReadingHistory, syncSavedChapters } = useReadingHistoryStore();
  const listsSyncedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthChange((firebaseUser) => {
      unsubUserDoc?.();
      unsubUserDoc = null;

      if (!firebaseUser) {
        listsSyncedForUid.current = null;
        clearUser();
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      unsubUserDoc = onSnapshot(
        userRef,
        (snap) => {
          // User doc only exists after email verification – treat unverified as not logged in
          if (!snap.exists()) {
            listsSyncedForUid.current = null;
            clearUser();
            return;
          }

          const data = snap.data();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName:
              (data.displayName as string | undefined) ??
              firebaseUser.displayName ??
              undefined,
            photoURL:
              (data.photoURL as string | undefined) ??
              firebaseUser.photoURL ??
              undefined,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            lastLogin: data.lastLogin?.toDate?.(),
            emailVerified: data.emailVerified ?? false,
            gameDemoAccess: data.gameDemoAccess === true,
            adsHidden: data.adsHidden === true,
          });

          // Sync lists once per uid (not on every gameDemoAccess toggle)
          if (listsSyncedForUid.current === firebaseUser.uid) return;
          listsSyncedForUid.current = firebaseUser.uid;

          void (async () => {
            try {
              const [watchlist, history, mangaList, readingHistory, savedChapters] = await Promise.all([
                getWatchlist(firebaseUser.uid),
                getWatchHistory(firebaseUser.uid),
                getMangaList(firebaseUser.uid),
                getReadingHistory(firebaseUser.uid),
                getSavedChapters(firebaseUser.uid),
              ]);
              syncWatchlist(watchlist);
              syncHistory(history);
              syncMangaList(mangaList);
              syncReadingHistory(readingHistory);
              syncSavedChapters(savedChapters);
              trimContinueWatchingToMax(firebaseUser.uid).catch(() => {});
              trimContinueReadingToMax(firebaseUser.uid).catch(() => {});
            } catch (error) {
              console.error('Failed to sync user data:', error);
            }
          })();
        },
        (error) => {
          console.error('User doc listener failed:', error);
          clearUser();
        }
      );
    });

    return () => {
      unsubUserDoc?.();
      unsubscribe();
    };
  }, [
    setUser,
    setLoading,
    clearUser,
    syncWatchlist,
    syncHistory,
    syncMangaList,
    syncReadingHistory,
    syncSavedChapters,
    clearList,
    clearHistory,
  ]);

  return <>{children}</>;
}
