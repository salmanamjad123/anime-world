/**
 * Subtitle Cache Utility
 * File-based caching for unlimited subtitle serving
 */

import fs from 'fs/promises';
import path from 'path';
import { Subtitle } from '@/types/stream';

// Cache directory in public folder (served statically by Next.js)
const CACHE_DIR = path.join(process.cwd(), 'public', 'subtitles');

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`✅ Created subtitle cache directory: ${CACHE_DIR}`);
  }
}

/**
 * Generate cache key from anime details
 */
export function generateCacheKey(
  animeId: string,
  episodeNumber: number,
  language: string
): string {
  // Sanitize anime ID for filename
  const sanitized = animeId
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  
  return `${sanitized}-e${episodeNumber}-${language}.vtt`;
}

/**
 * Check if subtitle is cached
 */
export async function isCached(cacheKey: string): Promise<boolean> {
  try {
    const filePath = path.join(CACHE_DIR, cacheKey);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached subtitle
 */
export async function getCachedSubtitle(cacheKey: string): Promise<string | null> {
  try {
    const filePath = path.join(CACHE_DIR, cacheKey);
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`✅ [Cache HIT] Serving cached subtitle: ${cacheKey}`);
    return content;
  } catch (error) {
    console.log(`⚠️ [Cache MISS] ${cacheKey}`);
    return null;
  }
}

/**
 * Save subtitle to cache
 */
export async function cacheSubtitle(
  cacheKey: string,
  content: string
): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, cacheKey);
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`✅ [Cache SAVE] Cached subtitle: ${cacheKey}`);
  } catch (error: any) {
    console.error('[Cache Error]:', error.message);
  }
}

/**
 * Get public URL for cached subtitle
 */
export function getCachedSubtitleUrl(cacheKey: string): string {
  return `/subtitles/${cacheKey}`;
}

/**
 * Clear old cache files (optional cleanup)
 */
export async function clearOldCache(daysOld: number = 30): Promise<number> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🗑️ Cleaned up ${deletedCount} old subtitle cache files`);
    }

    return deletedCount;
  } catch (error: any) {
    console.error('[Cache Cleanup Error]:', error.message);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile: string | null;
  newestFile: string | null;
}> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestFile: string | null = null;
    let newestFile: string | null = null;

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;

      if (stats.mtimeMs < oldestTime) {
        oldestTime = stats.mtimeMs;
        oldestFile = file;
      }

      if (stats.mtimeMs > newestTime) {
        newestTime = stats.mtimeMs;
        newestFile = file;
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      oldestFile,
      newestFile,
    };
  } catch (error) {
    return {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: null,
      newestFile: null,
    };
  }
}

/**
 * Bulk cache subtitles (for pre-caching popular anime)
 */
export async function bulkCacheSubtitles(
  subtitles: Array<{
    cacheKey: string;
    content: string;
  }>
): Promise<number> {
  let successCount = 0;

  for (const { cacheKey, content } of subtitles) {
    try {
      await cacheSubtitle(cacheKey, content);
      successCount++;
    } catch (error) {
      console.error(`Failed to cache: ${cacheKey}`);
    }
  }

  console.log(`✅ Bulk cached ${successCount}/${subtitles.length} subtitles`);
  return successCount;
}
