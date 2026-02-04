/**
 * Firestore Chapter Cache Schema
 *
 * Collection: chapter_cache
 * Document ID: SHA256(chapterId|provider).slice(0,32)
 *
 * Stores manga chapter pages when successfully fetched from Consumet.
 * Served from cache when source API is down or for faster loads.
 */

import { createHash } from 'crypto';
import type { MangaChapterPage } from '@/types';

export const CHAPTER_CACHE_COLLECTION = 'chapter_cache';
export const CHAPTER_CACHE_SCHEMA_VERSION = '1.0';

/** Generate deterministic document ID */
export function toChapterCacheDocId(chapterId: string, provider: string): string {
  const key = `${chapterId}|${provider}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/** Firestore document schema */
export interface ChapterCacheDocument {
  chapterId: string;
  provider: string;
  pages: MangaChapterPage[];
  cachedAt: string;
  schemaVersion: string;
}
