/**
 * Simple In-Memory Cache
 * Reduces API calls and improves performance for multiple users
 * 
 * For production with multiple servers, consider Redis
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL (time to live in milliseconds)
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    // Default TTL: 5 minutes (300000 ms)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      for (const [key, entry] of this.cache.entries()) {
        const isExpired = now - entry.timestamp > entry.ttl;
        if (isExpired) {
          this.cache.delete(key);
          expiredCount++;
        }
      }
    }, 300000); // 5 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const memoryCache = new MemoryCache();

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  ANIME_SEARCH: 30 * 60 * 1000,      // 30 minutes
  ANIME_INFO: 24 * 60 * 60 * 1000,   // 24 hours (rarely changes)
  ANIME_LIST: 5 * 60 * 1000,         // 5 minutes (trending, popular, top-rated, season)
  EPISODE_LIST: 15 * 60 * 1000, // 15 minutes (new episodes visible within 15 min)
  STREAM_SOURCES: 5 * 60 * 1000,     // 5 minutes (links expire)
  PROVIDER_HEALTH: 1 * 60 * 1000,    // 1 minute
} as const;

/**
 * Helper: Get or fetch with caching
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.ANIME_INFO
): Promise<T> {
  // Try cache first
  const cached = memoryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch data
  const data = await fetchFn();

  // Store in cache
  memoryCache.set(key, data, ttl);

  return data;
}

/**
 * Helper: Invalidate cache by pattern
 */
export function invalidateCache(pattern: string): void {
  const stats = memoryCache.stats();
  const keysToDelete = stats.keys.filter((key) => key.includes(pattern));

  keysToDelete.forEach((key) => memoryCache.delete(key));
}

export default memoryCache;
