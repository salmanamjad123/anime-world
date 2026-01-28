/**
 * HiAnime API Client (Aniwatch API)
 * Direct integration with aniwatch-api for reliable HiAnime streaming
 * 
 * This is the PRIMARY streaming provider - most reliable and best quality
 */

import { axiosInstance } from './axios';
import type { Episode, EpisodeListResponse, StreamSourcesResponse } from '@/types';
import { getCached, CACHE_TTL } from '@/lib/cache/memory-cache';

// HiAnime API base URL (default to localhost, override via env)
const HIANIME_API_URL = process.env.NEXT_PUBLIC_HIANIME_API_URL || 'http://localhost:4000';

/**
 * HiAnime search result
 */
export interface HiAnimeSearchResult {
  id: string;
  name: string;
  poster: string;
  duration?: string;
  type?: string;
  rating?: string;
  episodes?: {
    sub: number;
    dub: number;
  };
}

/**
 * HiAnime anime info
 */
export interface HiAnimeInfo {
  id: string;
  name: string;
  poster: string;
  description: string;
  stats: {
    rating: string;
    quality: string;
    episodes: {
      sub: number;
      dub: number;
    };
    type: string;
    duration: string;
  };
  seasons?: Array<{
    id: string;
    name: string;
    title: string;
    poster: string;
    isCurrent: boolean;
  }>;
  genres?: string[];
  /** From moreInfo */
  studios?: string;
  status?: string;
  aired?: string;
  /** MAL/AniList-style score (e.g. "8.3") - not content rating like PG-13 */
  malscore?: string;
  /** relatedAnimes from API (sequels, prequels, etc.) */
  relatedAnimes?: Array<{ id: string; name: string; poster: string; type?: string; episodes?: { sub: number; dub: number } }>;
}

/**
 * HiAnime episode
 */
export interface HiAnimeEpisode {
  title: string;
  episodeId: string; // Format: "anime-id?ep=12345"
  number: number;
  isFiller: boolean;
}

/**
 * Search for anime on HiAnime (with caching)
 */
export async function searchHiAnime(
  query: string,
  page: number = 1
): Promise<HiAnimeSearchResult[]> {
  const cacheKey = `hianime:search:${query}:${page}`;
  
  return getCached(
    cacheKey,
    async () => {
      console.log(`🔍 [HiAnime API] Searching: "${query}"`);
      
      const url = `${HIANIME_API_URL}/api/v2/hianime/search`;
      const response = await axiosInstance.get(url, {
        params: { q: query, page },
        timeout: 15000, // Increased to 15 seconds for better reliability
      });

      const results = response.data?.data?.animes || [];
      console.log(`✅ [HiAnime API] Found ${results.length} results`);
      
      return results;
    },
    CACHE_TTL.ANIME_SEARCH
  ).catch((error: any) => {
    console.error('[HiAnime API Error] searchHiAnime:', error.message);
    throw new Error(`HiAnime search failed: ${error.message}`);
  });
}

/**
 * Get anime info from HiAnime (with caching)
 * API returns data.anime as array with first element { info, moreInfo, seasons, ... }
 */
export async function getHiAnimeInfo(animeId: string): Promise<HiAnimeInfo> {
  const cacheKey = `hianime:info:${animeId}`;
  
  return getCached(
    cacheKey,
    async () => {
      console.log(`📺 [HiAnime API] Getting info for: ${animeId}`);
      
      const url = `${HIANIME_API_URL}/api/v2/hianime/anime/${animeId}`;
      const response = await axiosInstance.get(url, {
        timeout: 15000, // Increased to 15 seconds for better reliability
      });

      const raw = response.data?.data?.anime;
      const first = Array.isArray(raw) ? raw[0] : raw;
      const info = first?.info ?? first;
      if (!info?.id && !info?.name) {
        throw new Error('Invalid anime response');
      }
      const moreInfo = first?.moreInfo;
      const seasons = first?.seasons ?? info?.seasons;
      const genres = moreInfo?.genres ?? info?.genres;
      const relatedAnimes = first?.relatedAnimes ?? first?.recommendedAnimes;
      console.log(`✅ [HiAnime API] Got info for: ${info?.name ?? animeId}`);

      return {
        id: info.id ?? animeId,
        name: info.name ?? '',
        poster: info.poster ?? '',
        description: info.description ?? '',
        stats: info.stats ?? { rating: '', quality: '', episodes: { sub: 0, dub: 0 }, type: '', duration: '' },
        seasons: Array.isArray(seasons) ? seasons : undefined,
        genres: Array.isArray(genres) ? genres : undefined,
        studios: moreInfo?.studios ?? undefined,
        status: moreInfo?.status ?? info?.status ?? undefined,
        aired: moreInfo?.aired ?? undefined,
        malscore: info?.stats?.malscore ?? info?.malscore ?? moreInfo?.score ?? undefined,
        relatedAnimes: Array.isArray(relatedAnimes) ? relatedAnimes : undefined,
      };
    },
    CACHE_TTL.ANIME_INFO
  ).catch((error: any) => {
    console.error('[HiAnime API Error] getHiAnimeInfo:', error.message);
    throw new Error(`HiAnime info failed: ${error.message}`);
  });
}

/**
 * Get episode list from HiAnime (with caching)
 */
export async function getHiAnimeEpisodes(animeId: string): Promise<HiAnimeEpisode[]> {
  const cacheKey = `hianime:episodes:${animeId}`;
  
  return getCached(
    cacheKey,
    async () => {
      console.log(`📺 [HiAnime API] Getting episodes for: ${animeId}`);
      
      const url = `${HIANIME_API_URL}/api/v2/hianime/anime/${animeId}/episodes`;
      const response = await axiosInstance.get(url, {
        timeout: 15000, // Increased to 15 seconds for better reliability
      });

      const episodes = response.data?.data?.episodes || [];
      console.log(`✅ [HiAnime API] Found ${episodes.length} episodes`);
      console.log(`🎬 [HiAnime API] Sample episode ID: ${episodes[0]?.episodeId}`);
      
      return episodes;
    },
    CACHE_TTL.EPISODE_LIST
  ).catch((error: any) => {
    console.error('[HiAnime API Error] getHiAnimeEpisodes:', error.message);
    throw new Error(`HiAnime episodes failed: ${error.message}`);
  });
}

/**
 * Get available servers for an episode
 */
export async function getHiAnimeServers(episodeId: string): Promise<any> {
  try {
    const url = `${HIANIME_API_URL}/api/v2/hianime/episode/servers`;
    const response = await axiosInstance.get(url, {
      params: { animeEpisodeId: episodeId },
      timeout: 10000, // Increased to 10 seconds for better reliability
    });
    
    return response.data?.data || { sub: [], dub: [], raw: [] };
  } catch (error) {
    console.error('[HiAnime API] Failed to get servers:', error);
    return { sub: [], dub: [], raw: [] };
  }
}

/**
 * Get streaming sources for an episode from HiAnime
 * Tries multiple servers to find subtitles
 * Automatically detects and uses available category (sub/dub/raw)
 */
export async function getHiAnimeStreamSources(
  episodeId: string,
  category: 'sub' | 'dub' | 'raw' = 'sub',
  server: string = 'hd-1'
): Promise<StreamSourcesResponse> {
  try {
    console.log(`🎬 [HiAnime API] Getting stream for: ${episodeId} (${category}) on ${server}`);
    
    // STEP 1: Check available servers for this episode
    const serversData = await getHiAnimeServers(episodeId);
    const availableCategories = {
      sub: serversData.sub?.length > 0,
      dub: serversData.dub?.length > 0,
      raw: serversData.raw?.length > 0,
    };
    
    console.log(`📋 [HiAnime API] Available categories - SUB: ${availableCategories.sub}, DUB: ${availableCategories.dub}, RAW: ${availableCategories.raw}`);
    
    // STEP 2: Auto-select category if requested one is not available
    let actualCategory = category;
    if (!availableCategories[category]) {
      // Fallback priority: sub -> raw -> dub
      if (availableCategories.sub) {
        actualCategory = 'sub';
      } else if (availableCategories.raw) {
        actualCategory = 'raw';
      } else if (availableCategories.dub) {
        actualCategory = 'dub';
      }
      console.log(`🔄 [HiAnime API] Category '${category}' not available, using '${actualCategory}' instead`);
    }
    
    // STEP 3: Fetch streaming sources
    const url = `${HIANIME_API_URL}/api/v2/hianime/episode/sources`;
    const response = await axiosInstance.get(url, {
      params: {
        animeEpisodeId: episodeId,
        server,
        category: actualCategory,
      },
      timeout: 30000, // Increased to 30 seconds for slow source extraction
    });

    if (!response.data || !response.data.data || !response.data.data.sources) {
      throw new Error('No sources in response');
    }

    const data = response.data.data;
    
    // DEBUG: Log raw response
    console.log('🔍 [DEBUG] Raw API response:', JSON.stringify({
      sourcesCount: data.sources?.length,
      tracksCount: data.tracks?.length,
      sources: data.sources,
      tracks: data.tracks,
    }, null, 2));

    // Convert HiAnime response to our standard format
    const sources = data.sources.map((source: any) => ({
      url: source.url,
      quality: source.quality || 'default',
      isM3U8: source.type === 'hls' || source.url.includes('.m3u8'),
    }));

    // Convert tracks to subtitles from current server
    // Filter: Include tracks with kind='captions/subtitles' OR no kind (but exclude thumbnails)
    let subtitles: any[] = (data.tracks || [])
      .filter((track: any) => {
        // Exclude thumbnail tracks
        if (track.lang === 'thumbnails' || track.label === 'thumbnails' || track.kind === 'thumbnails') {
          return false;
        }
        // Include if it has subtitle/caption kind, or no kind at all (valid subtitle)
        return track.kind === 'captions' || track.kind === 'subtitles' || !track.kind;
      })
      .map((track: any) => ({
        url: track.url || track.file, // Some APIs use 'url', others use 'file'
        lang: track.label?.toLowerCase().includes('english') ? 'en' : 
              track.label?.toLowerCase().includes('japanese') ? 'ja' :
              track.label?.toLowerCase().includes('spanish') ? 'es' :
              track.label?.toLowerCase().includes('french') ? 'fr' :
              track.label?.toLowerCase() || track.lang?.toLowerCase() || 'en',
        label: track.label || track.lang || 'English',
      }));

    console.log(`✅ [HiAnime API] Found ${sources.length} sources`);
    console.log(`🎥 [HiAnime API] Quality: ${sources[0]?.quality}`);
    console.log(`📝 [HiAnime API] Found ${subtitles.length} subtitles on ${server}`);
    if (subtitles.length > 0) {
      console.log(`   Languages: ${subtitles.map((s: any) => s.label).join(', ')}`);
    }

    // Try ALL working servers to collect as many subtitles as possible
    // This maximizes subtitle availability
    const allWorkingServers = ['hd-1', 'hd-2'];
    const serversToTry = allWorkingServers.filter(s => s !== server);
    
    if (serversToTry.length > 0) {
      console.log(`🔄 [HiAnime API] Checking ${serversToTry.length} more server(s) for additional subtitles...`);
      
      for (const altServer of serversToTry) {
        try {
          console.log(`🔄 [HiAnime API] Checking ${altServer} for subtitles...`);
          const altResponse = await axiosInstance.get(url, {
            params: { animeEpisodeId: episodeId, server: altServer, category },
            timeout: 10000, // Increased to 10 seconds for better reliability
          });
          
          if (altResponse.data?.data?.tracks) {
            const altTracks = (altResponse.data.data.tracks || [])
              .filter((track: any) => {
                // Exclude thumbnail tracks
                if (track.lang === 'thumbnails' || track.label === 'thumbnails' || track.kind === 'thumbnails') {
                  return false;
                }
                // Include if it has subtitle/caption kind, or no kind at all (valid subtitle)
                return track.kind === 'captions' || track.kind === 'subtitles' || !track.kind;
              })
              .map((track: any) => ({
                url: track.url || track.file, // Some APIs use 'url', others use 'file'
                lang: track.label?.toLowerCase().includes('english') ? 'en' : 
                      track.label?.toLowerCase().includes('japanese') ? 'ja' :
                      track.label?.toLowerCase().includes('spanish') ? 'es' :
                      track.label?.toLowerCase().includes('french') ? 'fr' :
                      track.label?.toLowerCase() || track.lang?.toLowerCase() || 'en',
                label: track.label || track.lang || 'English',
              }));
            
            if (altTracks.length > 0) {
              console.log(`✅ [HiAnime API] Found ${altTracks.length} additional subtitle(s) on ${altServer}`);
              // Merge with existing subtitles
              subtitles.push(...altTracks);
            } else {
              console.log(`⚠️ [HiAnime API] No subtitles on ${altServer}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [HiAnime API] ${altServer} failed or unavailable`);
        }
      }
    }
    
    // Remove duplicate subtitles (keep unique by language)
    const uniqueSubtitles: any[] = Array.from(
      new Map(subtitles.map((sub: any) => [sub.lang, sub])).values()
    );
    
    console.log(`📝 [HiAnime API] Total unique subtitles: ${uniqueSubtitles.length}`);
    
    // Check if English subtitle is available
    const hasEnglish = uniqueSubtitles.some((s: any) => s.lang === 'en' || s.label?.toLowerCase().includes('english'));
    if (!hasEnglish && uniqueSubtitles.length > 0) {
      console.log(`⚠️ [HiAnime API] No English subtitle found. Available: ${uniqueSubtitles.map((s: any) => s.label).join(', ')}`);
    }

    return {
      headers: {
        Referer: 'https://hianime.to',
        Origin: 'https://hianime.to',
      },
      sources,
      subtitles: uniqueSubtitles,
      intro: data.intro,
      outro: data.outro,
    };
  } catch (error: any) {
    console.error('[HiAnime API Error] getHiAnimeStreamSources:', error.message);
    throw new Error(`HiAnime stream failed: ${error.message}`);
  }
}

/**
 * Search and get the best match for an anime
 * Returns null if not found
 */
export async function findHiAnimeMatch(
  animeTitle: string,
  isDub: boolean = false
): Promise<HiAnimeSearchResult | null> {
  try {
    // Clean up the title for better search results
    const cleanTitle = animeTitle
      .toLowerCase()
      .replace(/season\s*\d+/gi, '')
      .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const results = await searchHiAnime(cleanTitle);

    if (results.length === 0) {
      return null;
    }

    // Filter for dub if requested
    let matches = results;
    if (isDub) {
      const dubMatches = results.filter(
        (r) => r.id.includes('-dub') || r.name.toLowerCase().includes('dub')
      );
      if (dubMatches.length > 0) {
        matches = dubMatches;
      }
    }

    // Return the first/best match
    return matches[0];
  } catch (error) {
    console.error('[HiAnime API Error] findHiAnimeMatch:', error);
    return null;
  }
}

/**
 * Get episodes in our standard format
 */
export async function getHiAnimeEpisodesStandard(
  animeId: string,
  hiAnimeId: string
): Promise<EpisodeListResponse> {
  try {
    const hiAnimeEpisodes = await getHiAnimeEpisodes(hiAnimeId);

    return {
      animeId,
      totalEpisodes: hiAnimeEpisodes.length,
      episodes: hiAnimeEpisodes.map((ep) => ({
        id: ep.episodeId,
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
      })),
      _provider: 'hianime',
    };
  } catch (error: any) {
    console.error('[HiAnime API Error] getHiAnimeEpisodesStandard:', error.message);
    throw error;
  }
}

/**
 * Check if HiAnime API is available
 */
export async function isHiAnimeAvailable(): Promise<boolean> {
  try {
    const response = await axiosInstance.get(`${HIANIME_API_URL}/api/v2/hianime/home`, {
      timeout: 8000, // Increased to 8 seconds for slower API responses
    });
    return response.status === 200;
  } catch (error) {
    console.warn('[HiAnime API] Not available:', error);
    return false;
  }
}

