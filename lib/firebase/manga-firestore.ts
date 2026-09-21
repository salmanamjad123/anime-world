/**
 * Firestore Helpers — manga read list and reading history
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { MangaListItem, ReadingHistoryItem, ReadingProgress, ListStatus, SavedChapter } from '@/types';

const DEFAULT_LIST_STATUS: ListStatus = 'plan-to-watch';
const CONTINUE_READING_MAX = 5;

function isContinueReading(item: ReadingHistoryItem): boolean {
  return !item.completed && (item.percentage ?? 0) < 90;
}

function toSavedChapterDocId(mangaId: string, chapterId: string): string {
  return `${mangaId}__${chapterId.replace(/[/#.$[\]]/g, '_')}`;
}

export async function setMangaListItem(
  userId: string,
  mangaId: string,
  title: string,
  image: string,
  status: ListStatus = DEFAULT_LIST_STATUS
): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');

  const ref = doc(db, 'mangaWatchlist', userId, 'manga', mangaId);
  await setDoc(ref, {
    mangaId,
    title,
    image,
    status,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFromMangaList(userId: string, mangaId: string): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  await deleteDoc(doc(db, 'mangaWatchlist', userId, 'manga', mangaId));
}

export async function getMangaList(userId: string): Promise<MangaListItem[]> {
  if (!isFirebaseConfigured()) return [];

  const ref = collection(db, 'mangaWatchlist', userId, 'manga');
  const snapshot = await getDocs(query(ref, orderBy('addedAt', 'desc')));

  return snapshot.docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      mangaId: data.mangaId,
      title: data.title,
      image: data.image,
      status: (data.status as ListStatus) || DEFAULT_LIST_STATUS,
      addedAt: data.addedAt?.toDate() || new Date(),
    };
  });
}

export async function trimContinueReadingToMax(
  userId: string,
  maxCount: number = CONTINUE_READING_MAX
): Promise<void> {
  if (!isFirebaseConfigured()) return;

  const history = await getReadingHistory(userId);
  const inProgress = history.filter(isContinueReading);
  if (inProgress.length <= maxCount) return;

  const sorted = [...inProgress].sort(
    (a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
  );
  await Promise.all(
    sorted.slice(maxCount).map((item) => removeFromReadingHistory(userId, item.mangaId))
  );
}

export async function updateReadingProgress(
  userId: string,
  progress: ReadingProgress,
  mangaTitle: string,
  mangaImage: string,
  chapterTitle?: string
): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');

  const ref = doc(db, 'mangaHistory', userId, 'reading', progress.mangaId);
  const snap = await getDoc(ref);
  const prevIds = (snap.data()?.readChapterIds as string[] | undefined) ?? progress.readChapterIds ?? [];
  const readChapterIds = prevIds.includes(progress.chapterId)
    ? prevIds
    : [...prevIds, progress.chapterId];

  await setDoc(
    ref,
    {
      ...progress,
      mangaTitle,
      mangaImage,
      chapterTitle,
      readChapterIds,
      lastRead: serverTimestamp(),
    },
    { merge: true }
  );

  await trimContinueReadingToMax(userId);
}

export async function markMangaChapterRead(
  userId: string,
  mangaId: string,
  chapterId: string
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = doc(db, 'mangaHistory', userId, 'reading', mangaId);
  const snap = await getDoc(ref);
  const prev = (snap.data()?.readChapterIds as string[] | undefined) ?? [];
  if (prev.includes(chapterId)) return;
  await setDoc(
    ref,
    {
      mangaId,
      readChapterIds: [...prev, chapterId],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setSavedChapter(userId: string, item: SavedChapter): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const id = toSavedChapterDocId(item.mangaId, item.chapterId);
  await setDoc(doc(db, 'mangaSaved', userId, 'chapters', id), {
    mangaId: item.mangaId,
    chapterId: item.chapterId,
    chapterNumber: item.chapterNumber ?? null,
    chapterTitle: item.chapterTitle ?? null,
    mangaTitle: item.mangaTitle,
    mangaImage: item.mangaImage,
    provider: item.provider ?? null,
    savedAt: serverTimestamp(),
  });
}

export async function removeSavedChapter(
  userId: string,
  mangaId: string,
  chapterId: string
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await deleteDoc(
    doc(db, 'mangaSaved', userId, 'chapters', toSavedChapterDocId(mangaId, chapterId))
  );
}

export async function getSavedChapters(userId: string): Promise<SavedChapter[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const ref = collection(db, 'mangaSaved', userId, 'chapters');
    const snapshot = await getDocs(query(ref, orderBy('savedAt', 'desc')));
    return snapshot.docs.map((d) => {
      const data = d.data() as DocumentData;
      return {
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        chapterNumber: data.chapterNumber,
        chapterTitle: data.chapterTitle,
        mangaTitle: data.mangaTitle,
        mangaImage: data.mangaImage,
        provider: data.provider,
        savedAt: data.savedAt?.toDate() || new Date(),
      };
    });
  } catch (err) {
    console.warn('[Manga] Saved chapters sync skipped:', (err as Error).message);
    return [];
  }
}

export async function getReadingHistory(userId: string): Promise<ReadingHistoryItem[]> {
  if (!isFirebaseConfigured()) return [];

  const ref = collection(db, 'mangaHistory', userId, 'reading');
  const snapshot = await getDocs(query(ref, orderBy('lastRead', 'desc')));

  return snapshot.docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      mangaId: data.mangaId,
      chapterId: data.chapterId,
      chapterNumber: data.chapterNumber,
      pageIndex: data.pageIndex ?? 0,
      totalPages: data.totalPages ?? 0,
      percentage: data.percentage ?? 0,
      completed: data.completed || false,
      lastRead: data.lastRead?.toDate() || new Date(),
      mangaTitle: data.mangaTitle,
      mangaImage: data.mangaImage,
      chapterTitle: data.chapterTitle,
      provider: data.provider,
      readChapterIds: Array.isArray(data.readChapterIds) ? data.readChapterIds : undefined,
    };
  });
}

export async function removeFromReadingHistory(userId: string, mangaId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await deleteDoc(doc(db, 'mangaHistory', userId, 'reading', mangaId));
}

export async function clearReadingHistory(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');

  const ref = collection(db, 'mangaHistory', userId, 'reading');
  const snapshot = await getDocs(ref);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}
