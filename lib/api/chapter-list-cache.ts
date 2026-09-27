/**
 * Manga chapter-list cache — stale-while-revalidate
 *
 * Tier: Redis → Firestore → source fetch
 * Soft TTL 24h: return cached list immediately, refresh in background
 * Hard TTL 7d: still serve; after that treat as miss
 */

import {
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import {
  CHAPTER_LIST_CACHE_COLLECTION,
  CHAPTER_LIST_CACHE_SCHEMA_VERSION,
  CHAPTER_LIST_EMPTY_TTL_MS,
  CHAPTER_LIST_HARD_TTL_MS,
  CHAPTER_LIST_REFRESH_LOCK_MS,
  CHAPTER_LIST_SOFT_TTL_MS,
  toChapterListCacheDocId,
  toChapterListRedisKey,
  type ChapterListCacheDocument,
  type ChapterListCacheEnvelope,
  type ChapterListPayload,
} from '@/lib/firebase/chapter-list-cache-schema';
import memoryCache from '@/lib/cache/memory-cache';

export {
  CHAPTER_LIST_SOFT_TTL_MS,
  CHAPTER_LIST_HARD_TTL_MS,
  CHAPTER_LIST_EMPTY_TTL_MS,
} from '@/lib/firebase/chapter-list-cache-schema';

export type { ChapterListPayload };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;
let redisFailed = false;

function getRedisClient(): typeof redisClient {
  const url = process.env.REDIS_URL;
  if (!url || redisFailed) return null;

  if (!redisClient) {
    try {
      const Redis = require('ioredis').default;
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 2,
        retryStrategy(times: number) {
          if (times > 2) return null;
          return Math.min(times * 100, 2000);
        },
      });
      redisClient.on('error', () => {
        redisFailed = true;
      });
    } catch {
      redisFailed = true;
      return null;
    }
  }
  return redisClient;
}

function ageMs(cachedAt: string): number {
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

export type ChapterListLookup =
  | { hit: true; payload: ChapterListPayload; shouldRefresh: boolean; cachedAt: string }
  | { hit: false };

function slimPayload(payload: ChapterListPayload): ChapterListPayload {
  return {
    ...payload,
    chapters: payload.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      chapter: c.chapter,
    })),
  };
}

function parseEnvelope(raw: ChapterListCacheEnvelope | null): ChapterListLookup | null {
  if (!raw?.payload || raw.schemaVersion !== CHAPTER_LIST_CACHE_SCHEMA_VERSION) {
    return null;
  }
  const age = ageMs(raw.cachedAt);
  const hasChapters = (raw.payload.chapters?.length ?? 0) > 0;

  if (hasChapters) {
    if (age > CHAPTER_LIST_HARD_TTL_MS) return null;
    return {
      hit: true,
      payload: raw.payload,
      shouldRefresh: age > CHAPTER_LIST_SOFT_TTL_MS,
      cachedAt: raw.cachedAt,
    };
  }

  // Negative cache — avoid hammering scrapers for empty results
  if (age <= CHAPTER_LIST_EMPTY_TTL_MS) {
    return {
      hit: true,
      payload: raw.payload,
      shouldRefresh: false,
      cachedAt: raw.cachedAt,
    };
  }

  return null;
}

async function readRedis(key: string): Promise<ChapterListCacheEnvelope | null> {
  const fromMemory = memoryCache.get<ChapterListCacheEnvelope>(key);
  if (fromMemory) return fromMemory;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChapterListCacheEnvelope;
    const remaining = CHAPTER_LIST_HARD_TTL_MS - ageMs(parsed.cachedAt);
    if (remaining > 0) {
      memoryCache.set(key, parsed, remaining);
    }
    return parsed;
  } catch (err) {
    console.warn('[ChapterList Cache] Redis read failed:', (err as Error).message);
    return null;
  }
}

async function writeRedis(key: string, envelope: ChapterListCacheEnvelope, ttlMs: number): Promise<void> {
  memoryCache.set(key, envelope, ttlMs);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(key, Math.max(1, Math.floor(ttlMs / 1000)), JSON.stringify(envelope));
  } catch (err) {
    console.warn('[ChapterList Cache] Redis write failed:', (err as Error).message);
  }
}

async function readFirestore(
  anilistId: string,
  mode: string,
  mangadexIdHint?: string | null
): Promise<ChapterListCacheEnvelope | null> {
  const db = getAdminFirestore();
  if (!db) return null;

  try {
    const docId = toChapterListCacheDocId(anilistId, mode, mangadexIdHint);
    const snap = await db.collection(CHAPTER_LIST_CACHE_COLLECTION).doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data() as ChapterListCacheDocument;
    if (!data?.payload || data.schemaVersion !== CHAPTER_LIST_CACHE_SCHEMA_VERSION) {
      return null;
    }
    return {
      payload: data.payload,
      cachedAt: data.cachedAt,
      schemaVersion: data.schemaVersion,
    };
  } catch (err) {
    console.warn('[ChapterList Cache] Firestore read failed:', (err as Error).message);
    return null;
  }
}

async function writeFirestore(
  anilistId: string,
  mode: string,
  mangadexIdHint: string | null | undefined,
  envelope: ChapterListCacheEnvelope
): Promise<void> {
  const db = getAdminFirestore();
  if (!db) return;

  const docId = toChapterListCacheDocId(anilistId, mode, mangadexIdHint);
  const doc: ChapterListCacheDocument = {
    anilistId,
    requestMode: mode,
    mangadexIdHint: mangadexIdHint ?? null,
    payload: envelope.payload,
    cachedAt: envelope.cachedAt,
    schemaVersion: envelope.schemaVersion,
  };

  await db.collection(CHAPTER_LIST_CACHE_COLLECTION).doc(docId).set(doc);
  console.log(`💾 [ChapterList Cache SET] ${CHAPTER_LIST_CACHE_COLLECTION}/${docId}`);
}

export async function saveChapterListCache(
  anilistId: string,
  mode: string,
  mangadexIdHint: string | null | undefined,
  payload: ChapterListPayload
): Promise<void> {
  const hasChapters = (payload.chapters?.length ?? 0) > 0;
  if (!hasChapters) {
    // Short-lived empty marker in Redis/memory only — do not pollute Firestore
    const key = toChapterListRedisKey(anilistId, mode, mangadexIdHint);
    const envelope: ChapterListCacheEnvelope = {
      payload: slimPayload(payload),
      cachedAt: new Date().toISOString(),
      schemaVersion: CHAPTER_LIST_CACHE_SCHEMA_VERSION,
    };
    await writeRedis(key, envelope, CHAPTER_LIST_EMPTY_TTL_MS);
    return;
  }

  const envelope: ChapterListCacheEnvelope = {
    payload: slimPayload(payload),
    cachedAt: new Date().toISOString(),
    schemaVersion: CHAPTER_LIST_CACHE_SCHEMA_VERSION,
  };

  const key = toChapterListRedisKey(anilistId, mode, mangadexIdHint);
  await writeRedis(key, envelope, CHAPTER_LIST_HARD_TTL_MS);

  if (isFirebaseAdminConfigured()) {
    writeFirestore(anilistId, mode, mangadexIdHint, envelope).catch((err) =>
      console.warn('[ChapterList Cache] Background Firestore save failed:', (err as Error).message)
    );
  }
}

/**
 * Read durable chapter list (Redis → Firestore). Does not fetch from source.
 */
export async function lookupChapterListCache(
  anilistId: string,
  mode: string,
  mangadexIdHint?: string | null
): Promise<ChapterListLookup> {
  const key = toChapterListRedisKey(anilistId, mode, mangadexIdHint);

  const fromRedis = parseEnvelope(await readRedis(key));
  if (fromRedis?.hit) {
    console.log(`⚡ [ChapterList Cache HIT] Redis ${key}`);
    return fromRedis;
  }

  const fromFs = parseEnvelope(await readFirestore(anilistId, mode, mangadexIdHint));
  if (fromFs?.hit) {
    const remaining = CHAPTER_LIST_HARD_TTL_MS - ageMs(fromFs.cachedAt);
    if (remaining > 0 && fromFs.payload.chapters.length > 0) {
      await writeRedis(
        key,
        {
          payload: fromFs.payload,
          cachedAt: fromFs.cachedAt,
          schemaVersion: CHAPTER_LIST_CACHE_SCHEMA_VERSION,
        },
        remaining
      );
    }
    console.log(`💾 [ChapterList Cache HIT] Firestore → Redis ${key}`);
    return fromFs;
  }

  return { hit: false };
}

/**
 * Acquire a short lock so only one instance refreshes a stale list.
 */
export async function tryAcquireChapterListRefreshLock(
  anilistId: string,
  mode: string,
  mangadexIdHint?: string | null
): Promise<boolean> {
  const lockKey = `lock:${toChapterListRedisKey(anilistId, mode, mangadexIdHint)}`;
  const ttlSec = Math.max(1, Math.floor(CHAPTER_LIST_REFRESH_LOCK_MS / 1000));

  const redis = getRedisClient();
  if (redis) {
    try {
      const ok = await redis.set(lockKey, '1', 'EX', ttlSec, 'NX');
      return ok === 'OK';
    } catch {
      // fall through to memory
    }
  }

  const existing = memoryCache.get<number>(lockKey);
  if (existing !== null) return false;
  memoryCache.set(lockKey, Date.now(), CHAPTER_LIST_REFRESH_LOCK_MS);
  return true;
}
