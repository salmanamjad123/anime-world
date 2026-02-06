/**
 * Firestore Helpers
 * Database operations for watchlist and history
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { WatchlistItem, HistoryItem, EpisodeProgress, ListStatus } from '@/types';

const DEFAULT_LIST_STATUS: ListStatus = 'plan-to-watch';

/**
 * Add/update anime in list with status
 */
export async function setListItem(
  userId: string,
  animeId: string,
  title: string,
  image: string,
  status: ListStatus = DEFAULT_LIST_STATUS
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const watchlistRef = doc(db, 'watchlist', userId, 'anime', animeId);
  await setDoc(watchlistRef, {
    animeId,
    title,
    image,
    status,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** @deprecated Use setListItem */
export async function addToWatchlist(
  userId: string,
  animeId: string,
  title: string,
  image: string
): Promise<void> {
  await setListItem(userId, animeId, title, image, DEFAULT_LIST_STATUS);
}

/**
 * Remove anime from watchlist
 */
export async function removeFromWatchlist(userId: string, animeId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const watchlistRef = doc(db, 'watchlist', userId, 'anime', animeId);
  await deleteDoc(watchlistRef);
}

/**
 * Get user's watchlist
 */
export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const watchlistRef = collection(db, 'watchlist', userId, 'anime');
  const q = query(watchlistRef, orderBy('addedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data() as DocumentData;
    return {
      animeId: data.animeId,
      title: data.title,
      image: data.image,
      status: (data.status as ListStatus) || DEFAULT_LIST_STATUS,
      addedAt: data.addedAt?.toDate() || new Date(),
    };
  });
}

/**
 * Update watch progress
 */
export async function updateWatchProgress(
  userId: string,
  progress: EpisodeProgress,
  animeTitle: string,
  animeImage: string,
  episodeTitle?: string
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const historyRef = doc(db, 'history', userId, 'watching', progress.animeId);
  await setDoc(historyRef, {
    ...progress,
    animeTitle,
    animeImage,
    episodeTitle,
    lastWatched: serverTimestamp(),
  });
}

/**
 * Get watch history
 */
export async function getWatchHistory(userId: string): Promise<HistoryItem[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const historyRef = collection(db, 'history', userId, 'watching');
  const q = query(historyRef, orderBy('lastWatched', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data() as DocumentData;
    return {
      animeId: data.animeId,
      episodeId: data.episodeId,
      episodeNumber: data.episodeNumber,
      timestamp: data.timestamp,
      duration: data.duration,
      percentage: data.percentage,
      lastWatched: data.lastWatched?.toDate() || new Date(),
      completed: data.completed || false,
      animeTitle: data.animeTitle,
      animeImage: data.animeImage,
      episodeTitle: data.episodeTitle,
    };
  });
}

/**
 * Remove a single anime from watch history
 */
export async function removeFromWatchHistory(userId: string, animeId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const historyRef = doc(db, 'history', userId, 'watching', animeId);
  await deleteDoc(historyRef);
}

/**
 * Clear watch history
 */
export async function clearWatchHistory(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const historyRef = collection(db, 'history', userId, 'watching');
  const snapshot = await getDocs(historyRef);

  const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}
