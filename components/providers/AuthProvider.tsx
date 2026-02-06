/**
 * Auth Provider
 * Firebase authentication listener
 */

'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { onAuthChange, getUserDocument } from '@/lib/firebase/auth';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { getWatchlist, getWatchHistory, trimContinueWatchingToMax } from '@/lib/firebase/firestore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useHistoryStore } from '@/store/useHistoryStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, clearUser } = useUserStore();
  const { syncWithFirebase: syncWatchlist, clearList } = useWatchlistStore();
  const { syncWithFirebase: syncHistory, clearHistory } = useHistoryStore();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User doc only exists after email verification – treat unverified as not logged in
        const userDoc = await getUserDocument(firebaseUser.uid);
        if (!userDoc) {
          clearUser();
          return;
        }

        const user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: userDoc.displayName ?? firebaseUser.displayName ?? undefined,
          photoURL: userDoc.photoURL ?? firebaseUser.photoURL ?? undefined,
          createdAt: userDoc.createdAt ?? new Date(),
          emailVerified: userDoc.emailVerified ?? false,
        };
        setUser(user);

        // Sync data from Firebase
        try {
          const [watchlist, history] = await Promise.all([
            getWatchlist(firebaseUser.uid),
            getWatchHistory(firebaseUser.uid),
          ]);
          syncWatchlist(watchlist);
          syncHistory(history);
          // Trim Continue Watching to max 5 in Firestore (cleans up if user had more)
          trimContinueWatchingToMax(firebaseUser.uid).catch(() => {});
        } catch (error) {
          console.error('Failed to sync user data:', error);
        }
      } else {
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading, clearUser, syncWatchlist, syncHistory, clearList, clearHistory]);

  return <>{children}</>;
}
