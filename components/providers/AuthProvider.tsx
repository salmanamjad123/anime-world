/**
 * Auth Provider
 * Firebase authentication listener
 */

'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { onAuthChange } from '@/lib/firebase/auth';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { getWatchlist, getWatchHistory } from '@/lib/firebase/firestore';
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
        // User is signed in
        const user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: new Date(),
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
        } catch (error) {
          console.error('Failed to sync user data:', error);
        }
      } else {
        // User is signed out
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading, clearUser, syncWatchlist, syncHistory, clearList, clearHistory]);

  return <>{children}</>;
}
