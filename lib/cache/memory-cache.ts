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

    console.log(`💾 [Cache HIT] ${key}`);
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

    console.log(`💾 [Cache SET] ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`💾 [Cache DELETE] ${key}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log('💾 [Cache CLEAR] All entries cleared');
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

      if (expiredCount > 0) {
        console.log(`🧹 [Cache Cleanup] Removed ${expiredCount} expired entries`);
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
  EPISODE_LIST: 12 * 60 * 60 * 1000, // 12 hours
  STREAM_SOURCES: 5 * 60 * 1000,     // 5 minutes (links expire)
  PROVIDER_HEALTH: 1 * 60 * 1000,    // 1 minute
  MANGA_INFO: 60 * 60 * 1000,        // 1 hour
  MANGA_CHAPTERS_LIST: 30 * 60 * 1000, // 30 min - keep fresh for new chapters
  MANGA_CHAPTER_PAGES: 12 * 60 * 60 * 1000, // 12h for chapter content (Consumet)
  MANGA_DEX_CHAPTER_PAGES: 10 * 60 * 1000, // 10 min - MangaDex baseUrl expires in ~15 min
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
  console.log(`💾 [Cache MISS] ${key} - Fetching...`);
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

  if (keysToDelete.length > 0) {
    console.log(`💾 [Cache Invalidate] Removed ${keysToDelete.length} entries matching "${pattern}"`);
  }
}

export default memoryCache;
