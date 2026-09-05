/**
 * Long-lived stale cache for AniList outage fallback.
 * Fresh cache (5 min) is in getCached; stale keeps last good response up to 7 days.
 */

import memoryCache from './memory-cache';

const STALE_PREFIX = 'stale:';
/** 7 days — survives AniList multi-day outages */
export const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_TTL_SECONDS = 7 * 24 * 60 * 60;

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

function staleKey(key: string): string {
  return `${STALE_PREFIX}${key}`;
}

/** Persist last successful response for outage fallback. */
export async function saveStaleCache<T>(key: string, data: T): Promise<void> {
  const sk = staleKey(key);
  memoryCache.set(sk, data, STALE_TTL_MS);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(sk, STALE_TTL_SECONDS, JSON.stringify(data));
  } catch (err) {
    console.warn('[Stale Cache] Redis write failed:', (err as Error).message);
  }
}

/** Read stale data (memory first, then Redis). Returns null if none. */
export async function getStaleCache<T>(key: string): Promise<T | null> {
  const sk = staleKey(key);

  const fromMemory = memoryCache.get<T>(sk);
  if (fromMemory !== null) return fromMemory;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get(sk);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as T;
    memoryCache.set(sk, parsed, STALE_TTL_MS);
    return parsed;
  } catch (err) {
    console.warn('[Stale Cache] Redis read failed:', (err as Error).message);
    return null;
  }
}
