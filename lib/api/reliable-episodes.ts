/**
 * Reliable Episodes API
 * Multi-provider approach: HiAnime (primary) → Consumet providers (fallback)
 * This ensures maximum anime coverage and reliability
 */

import { axiosInstance } from './axios';
import type { Episode, EpisodeListResponse } from '@/types';
import { 
  findHiAnimeMatch, 
  getHiAnimeEpisodesStandard, 
  isHiAnimeAvailable 
} from './hianime';

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
  try {
    const hiAnimeAvailable = await isHiAnimeAvailable();
    
    if (hiAnimeAvailable) {
      console.log('🎯 [TIER 1] Trying HiAnime API...');
      const match = await findHiAnimeMatch(animeTitle, isDub, episodeCount);
      
      if (match) {
        console.log(`✅ [HiAnime API] Found anime: ${match.id}`);
        const episodes = await getHiAnimeEpisodesStandard(animeId, match.id);
        
        if (episodes.episodes.length > 0) {
          console.log(`🎉 [HiAnime API] SUCCESS! ${episodes.episodes.length} episodes`);
          console.log(`🎬 [HiAnime API] First episode:`, episodes.episodes[0].id);
          console.log('═══════════════════════════════════════════════');
          return episodes;
        }
      }
    }
  } catch (error: any) {
    console.warn('⚠️ [TIER 1] HiAnime API failed:', error.message);
  }

  // TIER 2: Fallback - Generate episodes from AniList count (no streaming when server is down)
  console.log('═══════════════════════════════════════════════');
  console.log('🔄 [FALLBACK] HiAnime unavailable - using AniList episode count:', episodeCount);
  console.log('⚠️  [FALLBACK] Streaming will show "Server down" until HiAnime API is running');
  console.log('═══════════════════════════════════════════════');
  
  return generateEpisodesFromCount(animeId, animeTitle, episodeCount);
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
 * Multi-source episode fetcher with fallbacks
 */
export async function getEpisodesMultiSource(
  anilistId: string,
  malId: number | undefined,
  animeTitle: string,
  episodeCount: number,
  isDub: boolean = false
): Promise<EpisodeListResponse> {
  // Strategy 1: Try HiAnime API
  try {
    const result = await getReliableEpisodes(anilistId, animeTitle, episodeCount, isDub);
    if (result.episodes.length > 0) {
      console.log('[Episodes] Success via HiAnime');
      return result;
    }
  } catch (error) {
    console.log('[Episodes] HiAnime failed, trying next source');
  }

  // Strategy 2: Try Jikan if MAL ID is available
  if (malId) {
    try {
      const jikanResult = await getEpisodesFromJikan(malId, episodeCount);
      if (jikanResult.episodes.length > 0) {
        console.log('[Episodes] Success via Jikan');
        return jikanResult;
      }
    } catch (error) {
      console.log('[Episodes] Jikan failed, using generated episodes');
    }
  }

  // Strategy 3: Always works - generate from AniList count
  console.log('[Episodes] Using generated episodes from AniList data');
  return generateEpisodesFromCount(anilistId, animeTitle, episodeCount);
}
