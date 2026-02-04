/**
 * Chapter Cache - 3-tier: Redis → Firestore → Consumet
 *
 * When a chapter is opened, content is saved to Firestore in background.
 * Next user (or same user) gets from Redis or Firestore.
 */

import {
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import {
  CHAPTER_CACHE_COLLECTION,
  CHAPTER_CACHE_SCHEMA_VERSION,
  toChapterCacheDocId,
  type ChapterCacheDocument,
} from '@/lib/firebase/chapter-cache-schema';
import { getCached } from '@/lib/cache';
import { CACHE_TTL } from '@/lib/cache';
import type { MangaChapterPage } from '@/types';

const CHAPTER_CACHE_TTL = CACHE_TTL.MANGA_CHAPTER_PAGES;

/** Redis cache key */
function toRedisKey(chapterId: string, provider: string): string {
  return `chapter:${chapterId}:${provider}`;
}

/**
 * Get chapter pages from Firestore (L2)
 */
export async function getChapterFromFirestore(
  chapterId: string,
  provider: string
): Promise<MangaChapterPage[] | null> {
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toChapterCacheDocId(chapterId, provider);
    const docRef = db.collection(CHAPTER_CACHE_COLLECTION).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data() as ChapterCacheDocument;
    if (!data?.pages?.length) return null;

    console.log(`💾 [Chapter Cache HIT] ${CHAPTER_CACHE_COLLECTION}/${docId}`);
    return data.pages;
  } catch (err) {
    console.warn('[Chapter Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

/**
 * Save chapter pages to Firestore - fire-and-forget
 */
export function saveChapterToFirestoreBackground(
  chapterId: string,
  provider: string,
  pages: MangaChapterPage[]
): void {
  if (!isFirebaseAdminConfigured()) return;
  if (!pages?.length) return;

  const doc: ChapterCacheDocument = {
    chapterId,
    provider,
    pages,
    cachedAt: new Date().toISOString(),
    schemaVersion: CHAPTER_CACHE_SCHEMA_VERSION,
  };

  saveChapterToFirestoreInternal(doc).catch((err) =>
    console.warn('[Chapter Cache] Background save failed:', (err as Error).message)
  );
}

async function saveChapterToFirestoreInternal(doc: ChapterCacheDocument): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  const docId = toChapterCacheDocId(doc.chapterId, doc.provider);
  const docRef = db.collection(CHAPTER_CACHE_COLLECTION).doc(docId);
  await docRef.set(doc);
  console.log(`💾 [Chapter Cache SET] ${CHAPTER_CACHE_COLLECTION}/${docId}`);
}

/**
 * Get chapter pages with 3-tier cache: Redis → Firestore → fetchFn.
 * @param ttlOverride - Optional TTL in ms (e.g. MangaDex baseUrl expires in ~15 min, use 10 min)
 */
export async function getChapterCached(
  chapterId: string,
  provider: string,
  fetchFn: () => Promise<MangaChapterPage[]>,
  forceRefresh = false,
  ttlOverride?: number
): Promise<MangaChapterPage[]> {
  const redisKey = toRedisKey(chapterId, provider);
  const ttl = ttlOverride ?? CHAPTER_CACHE_TTL;
  const useFirestore = provider !== 'mangadex'; // MangaDex URLs expire, skip Firestore for it

  if (forceRefresh) {
    const fresh = await fetchFn();
    if (useFirestore && isFirebaseAdminConfigured() && fresh.length > 0) {
      saveChapterToFirestoreBackground(chapterId, provider, fresh);
    }
    return fresh;
  }

  return getCached(
    redisKey,
    async () => {
      if (useFirestore && isFirebaseAdminConfigured()) {
        const fromFirestore = await getChapterFromFirestore(chapterId, provider);
        if (fromFirestore?.length) return fromFirestore;
      }

      const fresh = await fetchFn();
      if (useFirestore && isFirebaseAdminConfigured() && fresh.length > 0) {
        saveChapterToFirestoreBackground(chapterId, provider, fresh);
      }
      return fresh;
    },
    ttl
  );
}
