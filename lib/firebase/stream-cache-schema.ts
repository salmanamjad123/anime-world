/**
 * Firestore Stream Cache Schema
 *
 * Collection: stream_cache
 * Document ID: SHA256(episodeId|server|category).slice(0,32) - deterministic, clean
 *
 * Structure designed for:
 * - Clean, queryable data
 * - Schema versioning for migrations
 * - Consistent document IDs (no special chars)
 */

import { createHash } from 'crypto';

export const STREAM_CACHE_COLLECTION = 'stream_cache';
export const STREAM_CACHE_SCHEMA_VERSION = '1.0';

/** Generate deterministic document ID from lookup key */
export function toStreamCacheDocId(
  episodeId: string,
  server: string,
  category: string
): string {
  const key = `${episodeId}|${server}|${category}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/** Cached video source */
export interface CachedVideoSource {
  url: string;
  quality: string;
  isM3U8: boolean;
}

/** Cached subtitle track */
export interface CachedSubtitle {
  url: string;
  lang: string;
  label?: string;
}

/** Firestore document schema - stream_cache collection */
export interface StreamCacheDocument {
  /** Lookup key - episode identifier from HiAnime */
  episodeId: string;
  /** Server ID (hd-1, hd-2, megacloud, etc.) */
  server: string;
  /** Language category (sub, dub, raw) */
  category: string;

  /** Embed URL for iframe playback (optional) */
  embedUrl?: string;
  /** Video sources (HLS, MP4, etc.) */
  sources: CachedVideoSource[];
  /** Subtitle tracks */
  subtitles: CachedSubtitle[];
  /** Request headers for playback */
  headers?: Record<string, string>;
  /** Intro skip range (seconds) */
  intro?: { start: number; end: number };
  /** Outro skip range (seconds) */
  outro?: { start: number; end: number };

  /** When cached (ISO string) */
  cachedAt: string;
  /** Schema version for migrations */
  schemaVersion: string;
}
