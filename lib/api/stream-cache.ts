/**
 * Stream Cache - 3-tier: Redis → Firestore → HiAnime
 *
 * Firestore: stream_cache collection with clean schema
 * - Document ID: hash(episodeId|server|category)
 * - Fields: episodeId, server, category, sources, subtitles, metadata
 */

import {
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import {
  STREAM_CACHE_COLLECTION,
  STREAM_CACHE_SCHEMA_VERSION,
  toStreamCacheDocId,
  type StreamCacheDocument,
} from '@/lib/firebase/stream-cache-schema';
import { getCached } from '@/lib/cache';
import type { StreamSourcesResponse } from '@/types';

/** Redis cache key */
function toRedisKey(
  episodeId: string,
  server: string,
  category: string
): string {
  return `stream:${episodeId}:${server}:${category}`;
}

function toCachedDocument(
  data: StreamSourcesResponse,
  episodeId: string,
  server: string,
  category: string
): StreamCacheDocument {
  const doc: StreamCacheDocument = {
    episodeId,
    server,
    category,
    sources: data.sources.map((s) => ({
      url: s.url,
      quality: s.quality,
      isM3U8: s.isM3U8,
    })),
    subtitles: data.subtitles.map((s) => ({
      url: s.url,
      lang: s.lang,
      label: s.label,
    })),
    cachedAt: new Date().toISOString(),
    schemaVersion: STREAM_CACHE_SCHEMA_VERSION,
  };
  // Firestore rejects undefined - only include optional fields when defined
  if (data.embedUrl != null) doc.embedUrl = data.embedUrl;
  if (data.headers != null) doc.headers = data.headers;
  // Only store real intro/outro - not default { start: 0, end: 0 }
  if (data.intro && data.intro.end != null && data.intro.end > 0) doc.intro = data.intro;
  if (data.outro && data.outro.start != null && data.outro.end != null && (data.outro.end - data.outro.start) > 0) doc.outro = data.outro;
  return doc;
}

function fromCachedDocument(doc: StreamCacheDocument): StreamSourcesResponse {
  const defaultHeaders = {
    Referer: 'https://hianime.to',
    Origin: 'https://hianime.to',
  } as const;
  // Only pass intro/outro when real data - filter default { start: 0, end: 0 }
  const intro = doc.intro && typeof doc.intro.end === 'number' && doc.intro.end > 0 ? doc.intro : undefined;
  const outro = doc.outro && typeof doc.outro.end === 'number' && typeof doc.outro.start === 'number' && (doc.outro.end - doc.outro.start) > 0 ? doc.outro : undefined;
  return {
    headers: { ...defaultHeaders, ...doc.headers },
    sources: doc.sources as StreamSourcesResponse['sources'],
    subtitles: doc.subtitles,
    embedUrl: doc.embedUrl,
    intro,
    outro,
  };
}

/**
 * Get stream from Firestore (L2 - permanent)
 */
export async function getStreamFromFirestore(
  episodeId: string,
  server: string,
  category: string
): Promise<StreamSourcesResponse | null> {
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toStreamCacheDocId(episodeId, server, category);
    const docRef = db.collection(STREAM_CACHE_COLLECTION).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data() as StreamCacheDocument;
    if (!data?.sources?.length) return null;

    console.log(`💾 [Firestore HIT] ${STREAM_CACHE_COLLECTION}/${docId}`);
    return fromCachedDocument(data);
  } catch (err) {
    console.warn('[Stream Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

/**
 * Save stream to Firestore (permanent storage)
 */
export async function saveStreamToFirestore(
  episodeId: string,
  server: string,
  category: string,
  data: StreamSourcesResponse
): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  try {
    const doc = toCachedDocument(data, episodeId, server, category);
    const docId = toStreamCacheDocId(episodeId, server, category);
    const docRef = db.collection(STREAM_CACHE_COLLECTION).doc(docId);
    await docRef.set(doc);
    console.log(`💾 [Firestore SET] ${STREAM_CACHE_COLLECTION}/${docId}`);
  } catch (err) {
    console.warn(
      '[Stream Cache] Firestore write failed:',
      (err as Error).message
    );
  }
}

/**
 * Delete stream from Firestore (for broken link refresh)
 */
export async function deleteStreamFromFirestore(
  episodeId: string,
  server: string,
  category: string
): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  try {
    const docId = toStreamCacheDocId(episodeId, server, category);
    const docRef = db.collection(STREAM_CACHE_COLLECTION).doc(docId);
    await docRef.delete();
    console.log(`💾 [Firestore DELETE] ${STREAM_CACHE_COLLECTION}/${docId}`);
  } catch (err) {
    console.warn(
      '[Stream Cache] Firestore delete failed:',
      (err as Error).message
    );
  }
}

/** Redis TTL for stream cache - 12h for embed URLs (stable) */
const STREAM_CACHE_TTL = 12 * 60 * 60 * 1000;

/**
 * Get stream with 3-tier cache: Redis → Firestore → HiAnime.
 * forceRefresh=true: bypass cache, fetch fresh, update Firestore.
 */
export async function getStreamCached(
  episodeId: string,
  server: string,
  category: string,
  fetchFn: () => Promise<StreamSourcesResponse>,
  forceRefresh: boolean = false
): Promise<StreamSourcesResponse> {
  if (forceRefresh) {
    await deleteStreamFromFirestore(episodeId, server, category);
    const fresh = await fetchFn();
    if (isFirebaseAdminConfigured()) {
      await saveStreamToFirestore(episodeId, server, category, fresh);
    }
    return fresh;
  }

  const redisKey = toRedisKey(episodeId, server, category);

  return getCached(
    redisKey,
    async () => {
      // L2: Firestore
      if (isFirebaseAdminConfigured()) {
        const fromFirestore = await getStreamFromFirestore(
          episodeId,
          server,
          category
        );
        if (fromFirestore) return fromFirestore;
      }

      // L3: HiAnime
      const fresh = await fetchFn();
      if (isFirebaseAdminConfigured()) {
        await saveStreamToFirestore(episodeId, server, category, fresh);
      }
      return fresh;
    },
    STREAM_CACHE_TTL
  );
}
