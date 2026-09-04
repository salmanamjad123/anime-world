/**
 * Stream Cache - 3-tier: Redis → Firestore → HiAnime
 *
 * HLS CDN links expire in ~5–8 minutes (Megaplay). Keep cache TTL short.
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
import { deleteCacheKey, getCached } from '@/lib/cache';
import type { StreamSourcesResponse } from '@/types';

/** Megaplay/CDN m3u8 links expire quickly — align with streaming-api megaplay cache (~8 min) */
export const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;

/** Redis cache key */
function toRedisKey(
  episodeId: string,
  server: string,
  category: string
): string {
  return `stream:${episodeId}:${server}:${category}`;
}

function isCacheExpired(doc: StreamCacheDocument): boolean {
  if (doc.expiresAt) {
    return Date.parse(doc.expiresAt) <= Date.now();
  }
  if (doc.cachedAt) {
    return Date.parse(doc.cachedAt) + STREAM_CACHE_TTL_MS <= Date.now();
  }
  return true;
}

function toCachedDocument(
  data: StreamSourcesResponse,
  episodeId: string,
  server: string,
  category: string
): StreamCacheDocument {
  const now = Date.now();
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
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + STREAM_CACHE_TTL_MS).toISOString(),
    schemaVersion: STREAM_CACHE_SCHEMA_VERSION,
  };
  if (data.embedUrl != null) doc.embedUrl = data.embedUrl;
  if (data.headers != null) doc.headers = data.headers;
  if (data.intro && data.intro.end != null && data.intro.end > 0) doc.intro = data.intro;
  if (
    data.outro &&
    data.outro.start != null &&
    data.outro.end != null &&
    data.outro.end - data.outro.start > 0
  ) {
    doc.outro = data.outro;
  }
  return doc;
}

function fromCachedDocument(doc: StreamCacheDocument): StreamSourcesResponse {
  const defaultHeaders = {
    Referer: 'https://hianime.to',
    Origin: 'https://hianime.to',
  } as const;
  const intro =
    doc.intro && typeof doc.intro.end === 'number' && doc.intro.end > 0
      ? doc.intro
      : undefined;
  const outro =
    doc.outro &&
    typeof doc.outro.end === 'number' &&
    typeof doc.outro.start === 'number' &&
    doc.outro.end - doc.outro.start > 0
      ? doc.outro
      : undefined;
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
 * Get stream from Firestore (L2) — skips expired entries
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

    if (isCacheExpired(data)) {
      await docRef.delete().catch(() => {});
      return null;
    }

    return fromCachedDocument(data);
  } catch (err) {
    console.warn('[Stream Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

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
    await db.collection(STREAM_CACHE_COLLECTION).doc(docId).set(doc);
  } catch (err) {
    console.warn('[Stream Cache] Firestore write failed:', (err as Error).message);
  }
}

export async function deleteStreamFromFirestore(
  episodeId: string,
  server: string,
  category: string
): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  try {
    const docId = toStreamCacheDocId(episodeId, server, category);
    await db.collection(STREAM_CACHE_COLLECTION).doc(docId).delete();
  } catch (err) {
    console.warn('[Stream Cache] Firestore delete failed:', (err as Error).message);
  }
}

/** Clear Redis + Firestore for an episode/server (use before force refresh) */
export async function invalidateStreamCache(
  episodeId: string,
  server: string,
  category: string
): Promise<void> {
  deleteCacheKey(toRedisKey(episodeId, server, category));
  await deleteStreamFromFirestore(episodeId, server, category);
}

/**
 * Get stream with 3-tier cache: Redis → Firestore → HiAnime.
 * forceRefresh=true: bypass cache, fetch fresh, update stores.
 */
export async function getStreamCached(
  episodeId: string,
  server: string,
  category: string,
  fetchFn: () => Promise<StreamSourcesResponse>,
  forceRefresh: boolean = false
): Promise<StreamSourcesResponse> {
  if (forceRefresh) {
    await invalidateStreamCache(episodeId, server, category);
    // Also clear alternate server cache (route tries hd-1 then hd-2)
    const altServer = server === 'hd-1' ? 'hd-2' : 'hd-1';
    await invalidateStreamCache(episodeId, altServer, category);

    const fresh = await fetchFn();
    if (isFirebaseAdminConfigured()) {
      await saveStreamToFirestore(episodeId, server, category, fresh);
    }
    deleteCacheKey(toRedisKey(episodeId, server, category));
    return fresh;
  }

  const redisKey = toRedisKey(episodeId, server, category);

  return getCached(
    redisKey,
    async () => {
      if (isFirebaseAdminConfigured()) {
        const fromFirestore = await getStreamFromFirestore(
          episodeId,
          server,
          category
        );
        if (fromFirestore) return fromFirestore;
      }

      const fresh = await fetchFn();
      if (isFirebaseAdminConfigured()) {
        await saveStreamToFirestore(episodeId, server, category, fresh);
      }
      return fresh;
    },
    STREAM_CACHE_TTL_MS
  );
}
