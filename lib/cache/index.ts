/**
 * Unified Cache Layer
 * Uses Redis when REDIS_URL is set (shared across Vercel instances), else in-memory.
 */

import { getCached as getCachedMemory, CACHE_TTL } from './memory-cache';

export { CACHE_TTL };

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

/**
 * Get or fetch with caching.
 * Uses Redis when REDIS_URL is set, otherwise in-memory (per instance).
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.ANIME_INFO
): Promise<T> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`💾 [Redis HIT] ${key}`);
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.warn('[Redis] Cache read failed, falling back to memory:', (err as Error).message);
    }
  }

  const data = await getCachedMemory(key, fetchFn, ttl);

  if (redis) {
    try {
      const ttlSeconds = Math.floor(ttl / 1000);
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      console.warn('[Redis] Cache write failed:', (err as Error).message);
    }
  }

  return data;
}

export { invalidateCache } from './memory-cache';
export { default as memoryCache } from './memory-cache';

/**
 * Check if Redis is configured and reachable.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
