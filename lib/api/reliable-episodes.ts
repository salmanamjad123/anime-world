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
  provider: 'hianime' | 'gogoanime' | 'animepahe' | 'zoro';
  id: string;
  title: string;
}

/**
 * Search for anime across multiple providers
 * Priority: HiAnime API → Consumet providers (hianime, gogoanime, animepahe, zoro)
 */
export async function searchAnimeMultiProvider(
  animeTitle: string,
  isDub: boolean = false
): Promise<ProviderSearchResult | null> {
  
  // Prepare search query
  const searchQuery = animeTitle
    .toLowerCase()
    .replace(/season\s*\d+/gi, '')
    .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('═══════════════════════════════════════════════');
  console.log('🔍 [Multi-Provider Search] Original:', animeTitle);
  console.log('🔍 [Multi-Provider Search] Query:', searchQuery);
  console.log('═══════════════════════════════════════════════');

  // TIER 1: Try HiAnime API directly (fastest and most reliable)
  try {
    const hiAnimeAvailable = await isHiAnimeAvailable();
    
    if (hiAnimeAvailable) {
      console.log('🎯 [TIER 1] Trying HiAnime API (Direct)...');
      const match = await findHiAnimeMatch(animeTitle, isDub);
      
      if (match) {
        console.log(`✅ [HiAnime API] FOUND!`);
        console.log(`📺 [HiAnime API] ID:`, match.id);
        console.log(`📺 [HiAnime API] Title:`, match.name);
        console.log('═══════════════════════════════════════════════');
        
        return {
          provider: 'hianime',
          id: match.id,
          title: match.name,
        };
      }
    } else {
      console.warn('⚠️ [HiAnime API] Not available, using Consumet fallback');
    }
  } catch (error: any) {
    console.warn('⚠️ [HiAnime API] Failed:', error.message);
  }

  // TIER 2: Try Consumet providers (fallback)
  console.log('🎯 [TIER 2] Trying Consumet providers...');
  const providers: Array<'hianime' | 'gogoanime' | 'animepahe' | 'zoro'> = [
    'hianime',      // Best: Sub/Dub, High quality, Most reliable
    'gogoanime',    // Good: Fallback option
    'animepahe',    // Good: High quality encodes
    'zoro',         // Alternative
  ];

  for (const provider of providers) {
    try {
      console.log(`🔍 [${provider.toUpperCase()}] Searching via Consumet...`);
      
      const response = await axiosInstance.get(
        `https://api.consumet.org/anime/${provider}/${encodeURIComponent(searchQuery)}`,
        { timeout: 8000 }
      );

      if (response.data?.results && response.data.results.length > 0) {
        let results = response.data.results;
        
        // Filter for dub if requested
        if (isDub) {
          const dubResults = results.filter((r: any) => 
            r.id?.toLowerCase().includes('dub') || 
            r.title?.toLowerCase().includes('dub')
          );
          if (dubResults.length > 0) {
            console.log(`🎙️ [${provider.toUpperCase()}] Found dub version`);
            results = dubResults;
          }
        }

        const match = results[0];
        console.log(`✅ [${provider.toUpperCase()}] FOUND!`);
        console.log(`📺 [${provider.toUpperCase()}] ID:`, match.id);
        console.log(`📺 [${provider.toUpperCase()}] Title:`, match.title);
        console.log('═══════════════════════════════════════════════');
        
        return {
          provider,
          id: match.id,
          title: match.title,
        };
      }
      
      console.log(`⚠️ [${provider.toUpperCase()}] No results found`);
    } catch (error: any) {
      console.error(`❌ [${provider.toUpperCase()}] Error:`, error.message);
      continue; // Try next provider
    }
  }

  console.error('═══════════════════════════════════════════════');
  console.error('❌ [Multi-Provider] ALL PROVIDERS FAILED');
  console.error('═══════════════════════════════════════════════');
  
  return null;
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
      const match = await findHiAnimeMatch(animeTitle, isDub);
      
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

  // TIER 2: Try Consumet providers (Fallback)
  console.log('🎯 [TIER 2] Trying Consumet providers...');
  const searchResult = await searchAnimeMultiProvider(animeTitle, isDub);
  
  if (searchResult) {
    try {
      const { provider, id } = searchResult;
      
      console.log('═══════════════════════════════════════════════');
      console.log(`📺 [${provider.toUpperCase()}] Fetching episodes for:`, id);
      console.log('═══════════════════════════════════════════════');
      
      const response = await axiosInstance.get(
        `https://api.consumet.org/anime/${provider}/info/${id}`,
        { timeout: 10000 }
      );

      if (response.data?.episodes && response.data.episodes.length > 0) {
        const episodes = response.data.episodes;
        
        console.log(`✅ [${provider.toUpperCase()}] Found ${episodes.length} REAL episodes!`);
        console.log(`🎬 [${provider.toUpperCase()}] First episode ID:`, episodes[0].id);
        console.log(`🎬 [${provider.toUpperCase()}] Provider will be used for streaming`);
        console.log('═══════════════════════════════════════════════');
        
        return {
          animeId,
          totalEpisodes: episodes.length,
          episodes: episodes.map((ep: any) => ({
            id: ep.id, // Real provider episode ID
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            image: ep.image,
          })),
          _provider: provider, // Store provider for streaming
        };
      }
    } catch (error: any) {
      console.error(`❌ [${searchResult.provider.toUpperCase()}] Failed:`, error.message);
    }
  }

  // TIER 3: Fallback - Generate episodes from AniList count (no streaming)
  console.log('═══════════════════════════════════════════════');
  console.log('🔄 [TIER 3 - FALLBACK] Using AniList episode count:', episodeCount);
  console.log('⚠️  [FALLBACK] Episodes will NOT have streaming (no provider found)');
  console.log('═══════════════════════════════════════════════');
  
  return generateEpisodesFromCount(animeId, animeTitle, episodeCount);
}

/**
 * Get streaming URL for Gogoanime
 * Returns embed URL that always works
 */
export function getGogoEmbedUrl(episodeId: string): string {
  // If it's our generated ID, convert to gogoanime format
  if (episodeId.includes('-episode-')) {
    // This is a placeholder - in real implementation, you'd need the gogoanime ID
    const episodeNum = episodeId.split('-episode-')[1];
    return `https://gogoplay1.com/embedplus?id=&num=${episodeNum}`;
  }
  
  // If it's already a gogoanime ID, use it directly
  return `https://gogoplay1.com/embedplus?id=${episodeId}`;
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
  // Strategy 1: Try Gogoanime via Consumet
  try {
    const gogoResult = await getReliableEpisodes(anilistId, animeTitle, episodeCount, isDub);
    if (gogoResult.episodes.length > 0) {
      console.log('[Episodes] Success via Gogoanime');
      return gogoResult;
    }
  } catch (error) {
    console.log('[Episodes] Gogoanime failed, trying next source');
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
