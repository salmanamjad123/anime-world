/**
 * HiAnime API Client (Aniwatch API)
 * Direct integration with aniwatch-api for reliable HiAnime streaming
 * 
 * This is the PRIMARY streaming provider - most reliable and best quality
 */

import { axiosInstance } from './axios';
import type { Episode, EpisodeListResponse, StreamSourcesResponse } from '@/types';
import { getCached, CACHE_TTL } from '@/lib/cache';

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
      embedUrl: data.embedURL,
      intro: data.intro,
      outro: data.outro,
    };
  } catch (error: any) {
    console.error('[HiAnime API Error] getHiAnimeStreamSources:', error.message);
    throw new Error(`HiAnime stream failed: ${error.message}`);
  }
}

const SEQUEL_KEYWORDS = [
  'culling game',
  'shibuya incident',
  'part 2',
  'part 3',
  '2nd season',
  '3rd season',
  'second season',
  'season 2',
  'season 3',
  'the movie',
  '-part-2',
  '-part-3',
];

function looksLikeSequel(id: string, name: string): boolean {
  const lower = `${id} ${name}`.toLowerCase();
  return SEQUEL_KEYWORDS.some((kw) => lower.includes(kw));
}

function searchTitleSuggestsSequel(cleanTitle: string): boolean {
  const lower = cleanTitle.toLowerCase();
  return SEQUEL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Check if result name/id reasonably matches the search (avoids cross-anime matches)
 */
function titleOverlap(searchWords: string[], resultId: string, resultName: string): boolean {
  const text = `${resultId} ${resultName}`.toLowerCase();
  const core = searchWords.filter((w) => w.length >= 3);
  if (core.length === 0) return true;
  return core.every((w) => text.includes(w));
}

/**
 * Normalize title for search while preserving season/part info (for multi-season matching)
 */
function buildSearchTitlePreservingSeason(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize title for fallback search (strips season info - used when full-title search returns nothing)
 */
function buildSearchTitleStripped(title: string): string {
  return title
    .toLowerCase()
    .replace(/season\s*\d+/gi, '')
    .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search and get the best match for an anime
 * When expectedEpisodeCount is provided, prefers results with matching episode count.
 * Only penalizes sequel results when we're clearly looking for the main season.
 * Preserves season/part info in search so multi-season anime (e.g. Frieren S1 vs S2) match correctly.
 */
export async function findHiAnimeMatch(
  animeTitle: string,
  isDub: boolean = false,
  expectedEpisodeCount?: number
): Promise<HiAnimeSearchResult | null> {
  try {
    const fullSearchTitle = buildSearchTitlePreservingSeason(animeTitle);
    const strippedTitle = buildSearchTitleStripped(animeTitle);
    const searchWords = strippedTitle.split(/\s+/).filter(Boolean);
    const weWantSequel = searchTitleSuggestsSequel(fullSearchTitle);

    // First try with full title (preserving "season 2", "2nd season", "part 2", etc.)
    // so HiAnime entries like "frieren-beyond-journeys-end-season-2" are found
    let results = await searchHiAnime(fullSearchTitle);

    if (results.length === 0 && fullSearchTitle !== strippedTitle) {
      results = await searchHiAnime(strippedTitle);
    }

    if (results.length === 0) return null;

    let matches = results;
    if (isDub) {
      const dubMatches = results.filter(
        (r) => r.id.includes('-dub') || r.name.toLowerCase().includes('dub')
      );
      if (dubMatches.length > 0) matches = dubMatches;
    }

    // Filter to results that actually match the search (avoid cross-anime like Sword Gai for Jujutsu Kaisen)
    const titleMatched = matches.filter((r) =>
      titleOverlap(searchWords, r.id, r.name ?? '')
    );
    if (titleMatched.length > 0) matches = titleMatched;

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    // When searching for a sequel (e.g. "Hell's Paradise Season 2"), prefer results whose id/name
    // contains sequel keywords (season 2, 2nd season, etc.) over the base series
    if (weWantSequel) {
      const sequelMatches = matches.filter((r) => looksLikeSequel(r.id, r.name ?? ''));
      if (sequelMatches.length > 0) matches = sequelMatches;
    }

    // Prefer best match when we have expected episode count
    if (expectedEpisodeCount != null && expectedEpisodeCount > 0) {
      const score = (r: HiAnimeSearchResult): number => {
        const sub = r.episodes?.sub ?? 0;
        const dub = r.episodes?.dub ?? 0;
        const count = Math.max(sub, dub) || sub + dub;
        const epDiff = count ? Math.abs(count - expectedEpisodeCount) : 999;
        // Only penalize sequel results when we're looking for the main season
        const sequelPenalty =
          looksLikeSequel(r.id, r.name ?? '') &&
          expectedEpisodeCount <= 24 &&
          !weWantSequel
            ? 50
            : 0;
        return epDiff + sequelPenalty;
      };
      const best = matches.reduce((a, b) => (score(a) <= score(b) ? a : b));
      return best;
    }

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
 * HiAnime AZ list item (from scraper)
 */
export interface HiAnimeAZItem {
  id: string | null;
  name: string | null;
  jname?: string | null;
  poster: string | null;
  duration?: string | null;
  type?: string | null;
  rating?: string | null;
  episodes?: { sub: number | null; dub: number | null };
}

/**
 * HiAnime AZ list response
 */
export interface HiAnimeAZListResponse {
  sortOption: string;
  animes: HiAnimeAZItem[];
  totalPages: number;
  hasNextPage: boolean;
  currentPage: number;
}

/**
 * Get A-Z anime list from HiAnime (with caching)
 */
export async function getHiAnimeAZList(
  sortOption: string,
  page: number = 1
): Promise<HiAnimeAZListResponse> {
  const normalized = sortOption.toLowerCase();
  const validOptions = ['all', 'other', '0-9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  const apiOption = normalized === '0-9' ? '0-9' : normalized === 'other' ? 'other' : normalized === 'all' ? 'all' : normalized.toUpperCase();

  if (!validOptions.includes(normalized)) {
    throw new Error(`Invalid AZ sort option: ${sortOption}`);
  }

  const cacheKey = `hianime:azlist:${apiOption}:${page}`;

  return getCached(
    cacheKey,
    async () => {
      const url = `${HIANIME_API_URL}/api/v2/hianime/azlist/${apiOption}`;
      const response = await axiosInstance.get(url, {
        params: { page },
        timeout: 15000,
      });

      const data = response.data?.data ?? response.data;
      return {
        sortOption: data.sortOption ?? apiOption,
        animes: data.animes ?? [],
        totalPages: data.totalPages ?? 1,
        hasNextPage: data.hasNextPage ?? false,
        currentPage: data.currentPage ?? page,
      };
    },
    CACHE_TTL.ANIME_SEARCH
  ).catch((error: any) => {
    console.error('[HiAnime API Error] getHiAnimeAZList:', error.message);
    throw new Error(`HiAnime A-Z list failed: ${error.message}`);
  });
}

/**
 * Check if HiAnime API is available
 */
export async function isHiAnimeAvailable(): Promise<boolean> {
  try {
    const response = await axiosInstance.get(`${HIANIME_API_URL}/api/v2/hianime/home`, {
      timeout: 15000, // 15s for Railway cold start / slow networks
    });
    return response.status === 200;
  } catch (error) {
    console.warn('[HiAnime API] Not available:', error);
    return false;
  }
}

