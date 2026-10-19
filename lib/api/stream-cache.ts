/**
 * Stream cache: Redis/memory → HiAnime.
 * HLS CDN links expire in ~5–8 minutes. Firestore is not used on the play path
 * (Spark write/delete caps).
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  firestoreBudget,
  isFirestoreQuotaBlocked,
  noteFirestoreError,
} from '@/lib/firebase/quota';
import {
  STREAM_CACHE_COLLECTION,
  STREAM_CACHE_SCHEMA_VERSION,
  toStreamCacheDocId,
  type StreamCacheDocument,
} from '@/lib/firebase/stream-cache-schema';
import { deleteCacheKey, getCachedWhen } from '@/lib/cache';
import type { StreamSourcesResponse } from '@/types';

/** Megaplay/CDN m3u8 links expire quickly — align with streaming-api megaplay cache (~8 min) */
export const STREAM_CACHE_TTL_MS = 5 * 60 * 1000;

/** Redis cache key */
function toRedisKey(
  episodeId: string,
  server: string,
  category: string
): string {
  return `stream:v2:${episodeId}:${server}:${category}`;
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
  if (isFirestoreQuotaBlocked()) return null;
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toStreamCacheDocId(episodeId, server, category);
    const docRef = db.collection(STREAM_CACHE_COLLECTION).doc(docId);
    const doc = await firestoreBudget(docRef.get(), null);
    if (!doc?.exists) return null;

    const data = doc.data() as StreamCacheDocument;
    // Stale/wrong schema: ignore. Do not delete — Spark delete quota is 20k/day.
    if (data?.schemaVersion !== STREAM_CACHE_SCHEMA_VERSION) return null;
    if (!data?.sources?.length && !data?.embedUrl) return null;
    if (isCacheExpired(data)) return null;

    return fromCachedDocument(data);
  } catch (err) {
    noteFirestoreError(err);
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
  if (isFirestoreQuotaBlocked()) return;
  const db = getAdminFirestore();
  if (!db) return;

  try {
    const doc = toCachedDocument(data, episodeId, server, category);
    const docId = toStreamCacheDocId(episodeId, server, category);
    await db.collection(STREAM_CACHE_COLLECTION).doc(docId).set(doc);
  } catch (err) {
    noteFirestoreError(err);
    console.warn('[Stream Cache] Firestore write failed:', (err as Error).message);
  }
}

/** Memory/Redis only. Do not delete Firestore docs (Spark delete cap). */
export async function invalidateStreamCache(
  episodeId: string,
  server: string,
  category: string
): Promise<void> {
  deleteCacheKey(toRedisKey(episodeId, server, category));
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
  const redisKey = toRedisKey(episodeId, server, category);
  const hasStableHls = (data: StreamSourcesResponse) =>
    Boolean(data?.sources?.some((s) => s?.url?.includes('.m3u8')));

  // HLS TTL is ~5 min — Redis/memory only. Firestore L2 burned Spark write/delete quota.
  if (forceRefresh) {
    deleteCacheKey(redisKey);
    const altServer = server === 'hd-1' ? 'hd-2' : 'hd-1';
    deleteCacheKey(toRedisKey(episodeId, altServer, category));
    return fetchFn();
  }

  return getCachedWhen(redisKey, fetchFn, STREAM_CACHE_TTL_MS, hasStableHls);
}
