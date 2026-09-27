/**
 * Firestore Manga Chapter List Cache
 *
 * Collection: manga_chapter_lists
 * Document ID: SHA256(anilistId|mode|mdHint).slice(0, 32)
 *
 * Stores chapter metadata only (id / number / title) — not page images.
 */

import { createHash } from 'crypto';
import type { MangaChapter } from '@/types';

export const CHAPTER_LIST_CACHE_COLLECTION = 'manga_chapter_lists';
export const CHAPTER_LIST_CACHE_SCHEMA_VERSION = '1.0';

/** Soft TTL: serve immediately, refresh in background when older */
export const CHAPTER_LIST_SOFT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
/** Hard TTL: still serve stale; drop / force refetch after this */
export const CHAPTER_LIST_HARD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
/** Empty / failed lists — retry sooner */
export const CHAPTER_LIST_EMPTY_TTL_MS = 5 * 60 * 1000; // 5 min
/** Prevent refresh stampedes */
export const CHAPTER_LIST_REFRESH_LOCK_MS = 2 * 60 * 1000; // 2 min

export function toChapterListCacheDocId(
  anilistId: string,
  mode: string,
  mangadexIdHint?: string | null
): string {
  const key = `${anilistId}|${mode}|${mangadexIdHint ?? ''}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export function toChapterListRedisKey(
  anilistId: string,
  mode: string,
  mangadexIdHint?: string | null
): string {
  return `manga:chapters:list:v1:${anilistId}:${mode}:${mangadexIdHint ?? ''}`;
}

export interface ChapterListPayload {
  chapters: MangaChapter[];
  provider: string;
  mode: string;
  mangadexId?: string | null;
  source: 'mangadex' | 'consumet' | 'asura' | 'none';
  unavailableReason?: 'empty' | 'title_mismatch';
}

export interface ChapterListCacheDocument {
  anilistId: string;
  requestMode: string;
  mangadexIdHint?: string | null;
  payload: ChapterListPayload;
  cachedAt: string;
  schemaVersion: string;
}

export interface ChapterListCacheEnvelope {
  payload: ChapterListPayload;
  cachedAt: string;
  schemaVersion: string;
}
