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
    const response = await axiosInstance.get(url);
    
    return {
      id: response.data.id,
      title: response.data.title?.english || response.data.title?.romaji || 'Unknown',
      totalEpisodes: response.data.totalEpisodes || 0,
      episodes: response.data.episodes || [],
      hasDub: response.data.hasDub || false,
      hasSub: response.data.hasSub !== false, // Default to true if not specified
    };
  } catch (error) {
    console.error('[Consumet API Error] getAnimeInfo:', error);
    throw new Error('Failed to fetch anime info from Consumet');
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
    
    const response = await axiosInstance.get(url, { params });
    
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
  } catch (error) {
    console.error('[Consumet API Error] getEpisodes:', error);
    throw new Error('Failed to fetch episodes from Consumet');
  }
}

/**
 * Get streaming sources for an episode
 */
export async function getStreamingSources(
  episodeId: string,
  provider: string = 'gogoanime'
): Promise<StreamSourcesResponse> {
  try {
    const url = `${CONSUMET_API_URL}${API_ENDPOINTS.CONSUMET.STREAMING_LINKS}/${episodeId}`;
    const params = { provider };
    
    const response = await axiosInstance.get(url, { params });
    
    return {
      headers: response.data.headers,
      sources: response.data.sources.map((source: any) => ({
        url: source.url,
        quality: source.quality || 'default',
        isM3U8: source.isM3U8 || source.url.includes('.m3u8'),
      })),
      subtitles: response.data.subtitles || [],
      download: response.data.download,
    };
  } catch (error) {
    console.error('[Consumet API Error] getStreamingSources:', error);
    throw new Error('Failed to fetch streaming sources from Consumet');
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
 * Helper: Try to get streaming sources with fallback servers
 */
export async function getStreamingSourcesWithFallback(
  episodeId: string,
  preferredProvider: string = 'gogoanime'
): Promise<StreamSourcesResponse | null> {
  const providers = [preferredProvider, 'gogoanime', 'zoro', 'animepahe'].filter(
    (p, i, arr) => arr.indexOf(p) === i // Remove duplicates
  );

  for (const provider of providers) {
    try {
      console.log(`[Consumet] Trying provider: ${provider}`);
      const sources = await getStreamingSources(episodeId, provider);
      
      if (sources.sources && sources.sources.length > 0) {
        console.log(`[Consumet] Success with provider: ${provider}`);
        return sources;
      }
    } catch (error) {
      console.warn(`[Consumet] Provider ${provider} failed, trying next...`);
      continue;
    }
  }

  console.error('[Consumet] All providers failed');
  return null;
}
