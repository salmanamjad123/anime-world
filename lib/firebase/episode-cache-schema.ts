/**
 * Firestore Episode Cache Schema
 *
 * Collection: episode_cache
 * Document ID: SHA256(animeId|category).slice(0,32)
 *
 * Stores episode lists from HiAnime when successful.
 * Served from cache when HiAnime is down (no wrong fallbacks).
 */

import { createHash } from 'crypto';
import type { Episode } from '@/types';

export const EPISODE_CACHE_COLLECTION = 'episode_cache';
export const EPISODE_CACHE_SCHEMA_VERSION = '1.0';

/** Generate deterministic document ID */
export function toEpisodeCacheDocId(animeId: string, category: string): string {
  const key = `${animeId}|${category}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/** Firestore document schema */
export interface EpisodeCacheDocument {
  animeId: string;
  category: 'sub' | 'dub';
  hiAnimeId: string;
  episodes: Episode[];
  totalEpisodes: number;
  cachedAt: string;
  schemaVersion: string;
}
