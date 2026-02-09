/**
 * Consumet API Client
 * Client for fetching streaming data from Consumet API
 */

import { axiosInstance } from './axios';
import { CONSUMET_API_URL, API_ENDPOINTS } from '@/constants/api';
import type { Episode, EpisodeListResponse, StreamSourcesResponse, LanguageCategory } from '@/types';

/**
 * Get anime info with streaming metadata from Consumet
 * This includes episode counts for sub/dub
 */
export async function getAnimeInfo(anilistId: string): Promise<{
  id: string;
  title: string;
  totalEpisodes: number;
  episodes: Episode[];
  hasDub: boolean;
  hasSub: boolean;
}> {
  try {
    const url = `${CONSUMET_API_URL}${API_ENDPOINTS.CONSUMET.ANIME_INFO}/${anilistId}`;
    const response = await axiosInstance.get(url, { timeout: 10000 });
    
    return {
      id: response.data.id,
      title: response.data.title?.english || response.data.title?.romaji || 'Unknown',
      totalEpisodes: response.data.totalEpisodes || 0,
      episodes: response.data.episodes || [],
      hasDub: response.data.hasDub || false,
      hasSub: response.data.hasSub !== false, // Default to true if not specified
    };
  } catch (error: any) {
    console.error('[Consumet API Error] getAnimeInfo:', error.message);
    
    // Return default response instead of throwing
    return {
      id: anilistId,
      title: 'Unknown',
      totalEpisodes: 0,
      episodes: [],
      hasDub: false,
      hasSub: true,
    };
  }
}

/**
 * Get episode list for an anime
 */
export async function getEpisodes(
  anilistId: string,
  provider: string = 'gogoanime',
  dub: boolean = false
): Promise<EpisodeListResponse> {
  try {
    const url = `${CONSUMET_API_URL}${API_ENDPOINTS.CONSUMET.ANIME_EPISODES}/${anilistId}`;
    const params: Record<string, any> = { provider };
    
    if (dub) {
      params.dub = true;
    }
    
    const response = await axiosInstance.get(url, { params, timeout: 10000 });
    
    return {
      animeId: anilistId,
      totalEpisodes: response.data.length || 0,
      episodes: response.data.map((ep: any) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        description: ep.description,
        image: ep.image,
        airDate: ep.airDate,
      })),
    };
  } catch (error: any) {
    console.error('[Consumet API Error] getEpisodes:', error.message);
    
    // Return empty response instead of throwing
    // This allows the UI to handle the error gracefully
    return {
      animeId: anilistId,
      totalEpisodes: 0,
      episodes: [],
    };
  }
}

/**
 * Get streaming sources for an episode from any provider
 */
export async function getStreamingSources(
  episodeId: string,
  provider: string = 'hianime'
): Promise<StreamSourcesResponse> {
  try {
    const url = `https://api.consumet.org/anime/${provider}/watch/${episodeId}`;

    const response = await axiosInstance.get(url, { 
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.data || !response.data.sources) {
      throw new Error('No sources in response');
    }

    return {
      headers: response.data.headers || {},
      sources: response.data.sources.map((source: any) => ({
        url: source.url,
        quality: source.quality || 'default',
        isM3U8: source.isM3U8 !== false,
      })),
      subtitles: response.data.subtitles || [],
      download: response.data.download,
    };
  } catch (error: any) {
    console.error(`❌ [${provider.toUpperCase()}] Error:`, error.message);
    throw new Error(`Failed to fetch streaming sources: ${error.message}`);
  }
}

/**
 * Search for anime on Consumet (for ID mapping)
 */
export async function searchAnimeOnConsumet(
  query: string,
  page: number = 1
): Promise<Array<{ id: string; title: string; image: string; malId?: number }>> {
  try {
    const url = `${CONSUMET_API_URL}/meta/anilist/${query}`;
    const params = { page };
    
    const response = await axiosInstance.get(url, { params });
    
    return response.data.results || [];
  } catch (error) {
    console.error('[Consumet API Error] searchAnimeOnConsumet:', error);
    return [];
  }
}

/**
 * Get available servers for an episode
 */
export async function getAvailableServers(episodeId: string): Promise<string[]> {
  try {
    // Consumet supports multiple providers
    const providers = ['gogoanime', 'zoro', 'animepahe'];
    
    // In a real implementation, you'd check which servers have this episode
    // For now, return default providers
    return providers;
  } catch (error) {
    console.error('[Consumet API Error] getAvailableServers:', error);
    return ['gogoanime']; // Fallback to default
  }
}

/**
 * Helper: Try to get streaming sources with multi-provider fallback
 * Automatically detects provider from episode ID or tries all providers
 */
export async function getStreamingSourcesWithFallback(
  episodeId: string,
  preferredProvider?: string
): Promise<StreamSourcesResponse | null> {
  // Auto-detect provider from episode ID format
  let detectedProvider: string | null = null;
  
  if (episodeId.includes('?ep=')) {
    detectedProvider = 'hianime'; // HiAnime uses ?ep= format
  } else if (episodeId.includes('-episode-')) {
    detectedProvider = 'gogoanime'; // Gogoanime uses -episode- format
  }
  
  // Try providers in order
  const providersToTry = [
    preferredProvider,
    detectedProvider,
    'hianime',
    'gogoanime',
    'animepahe',
    'zoro'
  ].filter((p, i, arr) => p && arr.indexOf(p) === i) as string[]; // Remove duplicates and nulls

  for (const provider of providersToTry) {
    try {
      const sources = await getStreamingSources(episodeId, provider);

      if (sources?.sources && sources.sources.length > 0) {
        return sources;
      }
    } catch (error: any) {
      console.error(`❌ [${provider.toUpperCase()}] Failed:`, error.message);
      continue; // Try next provider
    }
  }

  console.error('═══════════════════════════════════════════════');
  console.error('🚫 [Stream Fetch] ALL PROVIDERS FAILED');
  console.error('❌ [Stream Fetch] No streaming sources available');
  console.error('⚠️  [Stream Fetch] Will show error (no placeholder)');
  console.error('═══════════════════════════════════════════════');
  
  return null;
}
