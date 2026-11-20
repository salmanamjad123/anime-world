/**
 * Episode Cache - read-only Firestore backup
 *
 * Existing `episode_cache` docs may still be read when HiAnime fails.
 * New writes are disabled to protect Spark quota (AniList + HiAnime + Redis
 * are enough for normal traffic).
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  firestoreBudget,
  isFirestoreQuotaBlocked,
  noteFirestoreError,
} from '@/lib/firebase/quota';
import {
  EPISODE_CACHE_COLLECTION,
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
  if (isFirestoreQuotaBlocked()) return null;
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toEpisodeCacheDocId(animeId, category);
    const docRef = db.collection(EPISODE_CACHE_COLLECTION).doc(docId);
    const doc = await firestoreBudget(docRef.get(), null);

    if (!doc?.exists) return null;

    const data = doc.data() as EpisodeCacheDocument;
    if (!data?.episodes?.length) return null;

    return {
      animeId: data.animeId,
      totalEpisodes: data.totalEpisodes,
      episodes: data.episodes,
    };
  } catch (err) {
    noteFirestoreError(err);
    console.warn('[Episode Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

/**
 * Writes disabled — keep call sites unchanged; no-op to save Spark write quota.
 */
export function saveEpisodesToFirestoreBackground(
  _animeId: string,
  _category: 'sub' | 'dub',
  _hiAnimeId: string,
  _data: EpisodeListResponse
): void {
  // intentionally empty
}
