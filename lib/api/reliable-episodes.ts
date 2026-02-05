/**
 * Reliable Episodes API
 * HiAnime (primary) → Firebase cache (when HiAnime fails) → Server down (no wrong fallbacks)
 *
 * - Save to Firebase in background when HiAnime succeeds (no extra latency)
 * - Serve from Firebase when HiAnime is down
 * - If Firebase miss: show "server down" instead of broken fallback episodes
 */

import { axiosInstance } from './axios';
import type { Episode, EpisodeListResponse } from '@/types';
import {
  findHiAnimeMatch,
  getHiAnimeEpisodesStandard,
  isHiAnimeAvailable,
  searchHiAnime,
} from './hianime';
import {
  getEpisodesFromFirestore,
  saveEpisodesToFirestoreBackground,
} from './episode-cache';
import { deleteCacheKey } from '@/lib/cache';

/** Thrown when no episodes available (HiAnime down + Firebase miss) */
export class EpisodesUnavailableError extends Error {
  constructor(message = 'Streaming server is temporarily unavailable. Please try again later.') {
    super(message);
    this.name = 'EpisodesUnavailableError';
  }
}

/** AniList IDs that must use HiAnime for episodes (AniList lacks full episode data) */
const HIANIME_REQUIRED_SEARCH: Record<string, string> = {
  '21': 'one piece', // One Piece - AniList doesn't have full 1000+ episode list
};

/**
 * Generate episodes based on AniList episode count
 * This creates a reliable episode list structure
 */
export function generateEpisodesFromCount(
  animeId: string,
  animeTitle: string,
  episodeCount: number
): EpisodeListResponse {
  if (!episodeCount || episodeCount === 0) {
    return {
      animeId,
      totalEpisodes: 0,
      episodes: [],
    };
  }

  const episodes: Episode[] = [];
  
  for (let i = 1; i <= episodeCount; i++) {
    episodes.push({
      id: `${animeId}-episode-${i}`,
      number: i,
      title: `Episode ${i}`,
    });
  }

  return {
    animeId,
    totalEpisodes: episodeCount,
    episodes,
  };
}

/**
 * Multi-Provider Search Result
 */
export interface ProviderSearchResult {
  provider: 'hianime';
  id: string;
  title: string;
}

/**
 * Search for anime on HiAnime only (no Consumet fallback)
 */
export async function searchAnimeMultiProvider(
  animeTitle: string,
  isDub: boolean = false
): Promise<ProviderSearchResult | null> {
  try {
    const hiAnimeAvailable = await isHiAnimeAvailable();
    if (!hiAnimeAvailable) {
      console.warn('⚠️ [HiAnime API] Not available');
      return null;
    }
    const match = await findHiAnimeMatch(animeTitle, isDub);
    if (match) {
      console.log(`✅ [HiAnime API] Found: ${match.id}`);
      return { provider: 'hianime', id: match.id, title: match.name };
    }
    return null;
  } catch (error: any) {
    console.warn('⚠️ [HiAnime API] Search failed:', error.message);
    return null;
  }
}

/**
 * Fetch episodes from multiple providers
 * TIER 1: HiAnime API (direct, fastest, most reliable)
 * TIER 2: Consumet providers (fallback)
 * TIER 3: Generated from AniList count (no streaming)
 */
export async function getReliableEpisodes(
  animeId: string,
  animeTitle: string,
  episodeCount: number,
  isDub: boolean = false
): Promise<EpisodeListResponse & { _provider?: string }> {
  
  console.log('═══════════════════════════════════════════════');
  console.log('🎬 [Episode Fetch] Starting multi-tier search');
  console.log('📺 [Episode Fetch] Anime:', animeTitle);
  console.log('═══════════════════════════════════════════════');

  // TIER 1: Try HiAnime API directly (Primary source)
  // Skip health check - it blocks 15s on Railway cold start. Try HiAnime directly; fallback on failure.
  try {
    let match: Awaited<ReturnType<typeof findHiAnimeMatch>> = null;

    const requiredSearch = HIANIME_REQUIRED_SEARCH[animeId];
    if (requiredSearch) {
      console.log(`🎯 [TIER 1] HiAnime required for anime ${animeId} - searching "${requiredSearch}"`);
      const results = await searchHiAnime(requiredSearch, 1);
      const filtered = results.filter(
        (r) => !r.id.includes('-dub') && !r.name?.toLowerCase().includes('dub')
      );
      const candidates = filtered.length > 0 ? filtered : results;
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) => {
          const aCount = Math.max(a.episodes?.sub ?? 0, a.episodes?.dub ?? 0);
          const bCount = Math.max(b.episodes?.sub ?? 0, b.episodes?.dub ?? 0);
          return aCount >= bCount ? a : b;
        });
        match = best;
      }
      if (isDub && !match) {
        const dubResults = results.filter(
          (r) => r.id.includes('-dub') || r.name?.toLowerCase().includes('dub')
        );
        if (dubResults.length > 0) {
          match = dubResults.reduce((a, b) => {
            const aCount = Math.max(a.episodes?.sub ?? 0, a.episodes?.dub ?? 0);
            const bCount = Math.max(b.episodes?.sub ?? 0, b.episodes?.dub ?? 0);
            return aCount >= bCount ? a : b;
          });
        }
      }
    }

    if (!match) {
      console.log('🎯 [TIER 1] Trying HiAnime API...');
      match = await findHiAnimeMatch(animeTitle, isDub, episodeCount);
    }
    
    if (match) {
      console.log(`✅ [HiAnime API] Found anime: ${match.id}`);
      let episodes = await getHiAnimeEpisodesStandard(animeId, match.id);

      // Smart cache: if AniList has more episodes than cache, new episodes likely available - invalidate and refetch
      if (
        episodeCount > 0 &&
        episodes.episodes.length > 0 &&
        episodes.episodes.length < episodeCount
      ) {
        console.log(`🔄 [Episode Cache] AniList has ${episodeCount} episodes, cache has ${episodes.episodes.length} - refetching for new episodes`);
        deleteCacheKey(`hianime:episodes:${match.id}`);
        episodes = await getHiAnimeEpisodesStandard(animeId, match.id);
      }

      if (episodes.episodes.length > 0) {
        console.log(`🎉 [HiAnime API] SUCCESS! ${episodes.episodes.length} episodes`);
        console.log(`🎬 [HiAnime API] First episode:`, episodes.episodes[0].id);
        console.log('═══════════════════════════════════════════════');
        // Save to Firebase in background (fire-and-forget, no extra latency)
        saveEpisodesToFirestoreBackground(
          animeId,
          isDub ? 'dub' : 'sub',
          match.id,
          episodes
        );
        return episodes;
      }
    }
  } catch (error: any) {
    console.warn('⚠️ [TIER 1] HiAnime API failed:', error.message);
  }

  // TIER 2: Firebase cache (when HiAnime fails)
  const category = isDub ? 'dub' : 'sub';
  const cached = await getEpisodesFromFirestore(animeId, category);
  if (cached?.episodes?.length) {
    console.log(`💾 [Episode Cache] Serving ${cached.episodes.length} episodes from Firestore`);
    console.log('═══════════════════════════════════════════════');
    return cached;
  }

  // No cache: server down, don't show wrong fallbacks
  console.log('═══════════════════════════════════════════════');
  console.log('❌ [Episodes] HiAnime down + Firebase miss - server unavailable');
  console.log('═══════════════════════════════════════════════');
  throw new EpisodesUnavailableError();
}

/**
 * Check if episode ID is fallback format (no streaming - server was down when episodes were fetched)
 */
export function isFallbackEpisodeId(episodeId: string): boolean {
  return episodeId.includes('-episode-') && !episodeId.includes('?ep=');
}

/**
 * Alternative: Get episodes from Jikan (MyAnimeList)
 */
export async function getEpisodesFromJikan(
  malId: number,
  totalEpisodes: number
): Promise<EpisodeListResponse> {
  try {
    const response = await axiosInstance.get(
      `https://api.jikan.moe/v4/anime/${malId}/episodes`,
      { timeout: 5000 }
    );

    if (response.data && response.data.data) {
      return {
        animeId: malId.toString(),
        totalEpisodes: response.data.data.length,
        episodes: response.data.data.map((ep: any) => ({
          id: `mal-${malId}-ep-${ep.mal_id}`,
          number: ep.mal_id,
          title: ep.title || `Episode ${ep.mal_id}`,
          image: ep.images?.jpg?.image_url,
        })),
      };
    }
  } catch (error) {
    console.log('[Jikan API] Failed');
  }

  // Fallback to generated episodes
  return {
    animeId: malId.toString(),
    totalEpisodes,
    episodes: Array.from({ length: totalEpisodes }, (_, i) => ({
      id: `mal-${malId}-ep-${i + 1}`,
      number: i + 1,
      title: `Episode ${i + 1}`,
    })),
  };
}

/**
 * Multi-source episode fetcher
 * HiAnime → Firebase cache. Throws EpisodesUnavailableError when both fail.
 */
export async function getEpisodesMultiSource(
  anilistId: string,
  _malId: number | undefined,
  animeTitle: string,
  episodeCount: number,
  isDub: boolean = false
): Promise<EpisodeListResponse> {
  return getReliableEpisodes(anilistId, animeTitle, episodeCount, isDub);
}
