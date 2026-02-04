/**
 * Episode Cache - Firestore backup when HiAnime succeeds
 *
 * - Save in background (fire-and-forget) when HiAnime returns episodes
 * - Read when HiAnime fails - serve cached instead of wrong fallbacks
 * - No Firebase = no cache, same behavior as before
 */

import {
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import {
  EPISODE_CACHE_COLLECTION,
  EPISODE_CACHE_SCHEMA_VERSION,
  toEpisodeCacheDocId,
  type EpisodeCacheDocument,
} from '@/lib/firebase/episode-cache-schema';
import type { EpisodeListResponse } from '@/types';

/**
 * Get episodes from Firestore (when HiAnime fails)
 */
export async function getEpisodesFromFirestore(
  animeId: string,
  category: 'sub' | 'dub'
): Promise<EpisodeListResponse | null> {
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toEpisodeCacheDocId(animeId, category);
    const docRef = db.collection(EPISODE_CACHE_COLLECTION).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data() as EpisodeCacheDocument;
    if (!data?.episodes?.length) return null;

    console.log(`💾 [Episode Cache HIT] ${EPISODE_CACHE_COLLECTION}/${docId}`);
    return {
      animeId: data.animeId,
      totalEpisodes: data.totalEpisodes,
      episodes: data.episodes,
    };
  } catch (err) {
    console.warn('[Episode Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

/**
 * Save episodes to Firestore - fire-and-forget (background, no await)
 * Call after HiAnime success; does not block response
 */
export function saveEpisodesToFirestoreBackground(
  animeId: string,
  category: 'sub' | 'dub',
  hiAnimeId: string,
  data: EpisodeListResponse
): void {
  if (!isFirebaseAdminConfigured()) return;
  if (!data.episodes?.length) return;

  const doc: EpisodeCacheDocument = {
    animeId,
    category,
    hiAnimeId,
    episodes: data.episodes,
    totalEpisodes: data.totalEpisodes,
    cachedAt: new Date().toISOString(),
    schemaVersion: EPISODE_CACHE_SCHEMA_VERSION,
  };

  saveEpisodesToFirestoreInternal(doc).catch((err) =>
    console.warn('[Episode Cache] Background save failed:', (err as Error).message)
  );
}

async function saveEpisodesToFirestoreInternal(
  doc: EpisodeCacheDocument
): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  const docId = toEpisodeCacheDocId(doc.animeId, doc.category);
  const docRef = db.collection(EPISODE_CACHE_COLLECTION).doc(docId);
  await docRef.set(doc);
  console.log(`💾 [Episode Cache SET] ${EPISODE_CACHE_COLLECTION}/${docId}`);
}
