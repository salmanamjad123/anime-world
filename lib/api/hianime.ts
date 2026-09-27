/**
 * HiAnime API Client (Aniwatch API)
 * Direct integration with aniwatch-api for reliable HiAnime streaming
 * 
 * This is the PRIMARY streaming provider - most reliable and best quality
 */

import { axiosInstance } from './axios';
import type { Episode, EpisodeListResponse, StreamSourcesResponse } from '@/types';
import { getCached, CACHE_TTL } from '@/lib/cache';
import { retry } from '@/lib/utils/retry';
import { getJikanAZList } from './jikan';

// HiAnime API base URL (default to localhost, override via env)
const HIANIME_API_URL = process.env.NEXT_PUBLIC_HIANIME_API_URL || 'http://localhost:4000';

// Railway cold start + scraping can take 15-25s. Use 28s to stay under proxy timeout.
const HIANIME_TIMEOUT = 28000;

const isRetryableHiAnimeError = (e: any) =>
  e?.code === 'ECONNABORTED' || e?.response?.status === 502 || e?.response?.status === 503;

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
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `hianime:search:${q}:${page}`;
  
  return getCached(
    cacheKey,
    async () =>
      retry(
        async () => {
          const url = `${HIANIME_API_URL}/api/v2/hianime/search`;
          const response = await axiosInstance.get(url, {
            params: { q, page },
            timeout: HIANIME_TIMEOUT,
          });
          const results = response.data?.data?.animes || [];
          return results;
        },
        { maxAttempts: 2, delayMs: 2000, shouldRetry: isRetryableHiAnimeError }
      ),
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
    async () =>
      retry(
        async () => {
          const url = `${HIANIME_API_URL}/api/v2/hianime/anime/${animeId}`;
          const response = await axiosInstance.get(url, {
            timeout: HIANIME_TIMEOUT,
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
        { maxAttempts: 2, delayMs: 2000, shouldRetry: isRetryableHiAnimeError }
      ),
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
    async () =>
      retry(
        async () => {
          const url = `${HIANIME_API_URL}/api/v2/hianime/anime/${animeId}/episodes`;
          const response = await axiosInstance.get(url, {
            timeout: HIANIME_TIMEOUT,
          });
          const episodes = response.data?.data?.episodes || [];
          return episodes;
        },
        { maxAttempts: 2, delayMs: 2000, shouldRetry: isRetryableHiAnimeError }
      ),
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
    // STEP 1: Check available servers for this episode
    const serversData = await getHiAnimeServers(episodeId);
    const availableCategories = {
      sub: serversData.sub?.length > 0,
      dub: serversData.dub?.length > 0,
      raw: serversData.raw?.length > 0,
    };

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
    }
    
    // STEP 3: Fetch streaming sources
    const url = `${HIANIME_API_URL}/api/v2/hianime/episode/sources`;
    const response = await axiosInstance.get(url, {
      params: {
        animeEpisodeId: episodeId,
        server,
        category: actualCategory,
      },
      timeout: HIANIME_TIMEOUT,
    });

    const data = response.data?.data;
    if (!data) {
      throw new Error('No sources in response');
    }
    if (
      !(data.sources?.length) &&
      !data.embedURL &&
      !data.embedUrl
    ) {
      throw new Error('No sources in response');
    }

    // Convert HiAnime response to our standard format (skip iframe embeds)
    const sources = (data.sources || [])
      .filter((source: any) => source?.url && source.type !== 'embed')
      .map((source: any) => ({
        url: source.url,
        quality: source.quality || 'default',
        isM3U8: source.type === 'hls' || String(source.url).includes('.m3u8'),
      }));

    // Convert tracks/subtitles to our format - API may return tracks (vidstreaming) or subtitles (megacloud)
    const rawTracks = data.tracks || data.subtitles || [];
    let subtitles: any[] = rawTracks
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

    // Try ALL working servers to collect as many subtitles as possible
    // This maximizes subtitle availability
    const allWorkingServers = ['hd-1', 'hd-2'];
    const serversToTry = allWorkingServers.filter(s => s !== server);

    if (serversToTry.length > 0) {
      for (const altServer of serversToTry) {
        try {
          const altResponse = await axiosInstance.get(url, {
            params: { animeEpisodeId: episodeId, server: altServer, category },
            timeout: 15000,
          });
          
          const altData = altResponse.data?.data;
          const altRawTracks = altData?.tracks || altData?.subtitles;
          if (altRawTracks?.length) {
            const altTracks = (altRawTracks || [])
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
              subtitles.push(...altTracks);
            }
          }
        } catch {
          // Server failed or unavailable
        }
      }
    }
    
    // Remove duplicate subtitles (keep unique by language)
    const uniqueSubtitles: any[] = Array.from(
      new Map(subtitles.map((sub: any) => [sub.lang, sub])).values()
    );

    // Only pass intro/outro when API returns real data - filter out default { start: 0, end: 0 }
    // Some hosts return milliseconds (e.g. 90000 for 90s) - convert if value > 7200 (2h threshold)
    const toSeconds = (n: unknown): number => {
      const num = typeof n === 'number' ? n : Number(n);
      return !Number.isFinite(num) ? 0 : num > 7200 ? num / 1000 : num;
    };
    const introRaw = data.intro;
    const intro = introRaw && toSeconds(introRaw.end) > 0
      ? { start: toSeconds(introRaw.start), end: toSeconds(introRaw.end) }
      : undefined;
    const outroRaw = data.outro;
    const outro = outroRaw && (toSeconds(outroRaw.end) - toSeconds(outroRaw.start)) > 0
      ? { start: toSeconds(outroRaw.start), end: toSeconds(outroRaw.end) }
      : undefined;

    const embedUrl = data.embedURL || data.embedUrl;
    return {
      headers: data.headers || {
        Referer: embedUrl ? 'https://megaplay.buzz/' : 'https://hianime.to',
        Origin: embedUrl ? 'https://megaplay.buzz' : 'https://hianime.to',
      },
      sources,
      subtitles: uniqueSubtitles,
      embedUrl,
      intro,
      outro,
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
  'cour 2',
  'cour 3',
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

const TITLE_STOP_WORDS = new Set(['the', 'and', 'for', 'part', 'arc', 'cour', 'cool']);

const ROMAN_SEASON: Record<string, number> = {
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};

function extractSeasonPart(text: string): { season?: number; part?: number } {
  const lower = text.toLowerCase().replace(/[-_]/g, ' ');
  let season: number | undefined;
  let part: number | undefined;

  const seasonMatch =
    lower.match(/(?:^|[\s:])(?:season|s)\s*(\d+)/) ||
    lower.match(/(\d+)(?:st|nd|rd|th)\s*season/);
  if (seasonMatch) season = parseInt(seasonMatch[1], 10);

  const partMatch = lower.match(/(?:part|cour|cool)\s*(\d+)/);
  if (partMatch) part = parseInt(partMatch[1], 10);

  if (season == null) {
    const roman = lower.match(/\b(viii|vii|vi|iv|iii|ii|v)\b/);
    if (roman) season = ROMAN_SEASON[roman[1]];
  }

  return { season, part };
}

function seasonPartCompatible(
  queryTitle: string,
  resultId: string,
  resultName = ''
): boolean {
  const query = extractSeasonPart(queryTitle);
  const result = extractSeasonPart(`${resultId} ${resultName}`);
  // No season/roman marker means the original cour (season 1).
  // A "Part 2" / "Cour 2" title without a season is season 1 part 2.
  const resultSeason = result.season ?? 1;
  const querySeason = query.season ?? (query.part != null ? 1 : undefined);

  if (querySeason != null && querySeason !== resultSeason) {
    return false;
  }
  if (query.part != null && result.part != null && query.part !== result.part) {
    return false;
  }
  // "Season 3 Part 2" / "Cour 2" must not attach to a listing with no part
  if (query.part != null && result.part == null) {
    return false;
  }
  // "Season 3" must not attach to a "Part 2" listing of that season (or of season 1)
  if (query.part == null && result.part != null && querySeason != null) {
    return false;
  }
  return true;
}

/**
 * Check if result name/id reasonably matches the search (avoids cross-anime matches)
 */
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[-_]/g, ' ');
}

function extractSearchWords(title: string): string[] {
  return buildSearchTitleStripped(title).split(/\s+/).filter(Boolean);
}

function getAnchorWord(words: string[]): string | null {
  return words.find((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w)) ?? null;
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function fuzzyIncludes(haystack: string, word: string): boolean {
  if (haystack.includes(word)) return true;
  if (word.length < 5) return false;
  return haystack
    .split(/[^a-z0-9]+/)
    .some((token) => token.length >= 4 && editDistanceAtMost1(token, word));
}

function titleOverlap(searchWords: string[], resultId: string, resultName: string): boolean {
  const text = normalizeForMatch(`${resultId} ${resultName}`);
  const core = searchWords.filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w));
  if (core.length === 0) return true;

  const anchor = getAnchorWord(searchWords);
  if (anchor && !fuzzyIncludes(text, anchor)) return false;

  return core.every((w) => fuzzyIncludes(text, w));
}

function resultMatchesKnownTitle(
  titles: string[],
  resultId: string,
  resultName: string
): boolean {
  return titles.some((title) => {
    const words = extractSearchWords(title);
    if (words.length === 0) return false;
    return (
      titleOverlap(words, resultId, resultName) &&
      seasonPartCompatible(title, resultId, resultName)
    );
  });
}

function decodeEpisodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Verify a HiAnime slug plausibly matches the AniList title (guards stale/wrong provider picks). */
const SPECIAL_SLUG_MARKERS = [
  '-episode-of-',
  '-movie-',
  '-film-',
  '-special-',
  '-ova-',
  '-ona-',
];

export function hiAnimeSlugMatchesTitle(
  animeTitle: string,
  hiAnimeId: string,
  options?: { episodeCount?: number; allowSpecials?: boolean; hiAnimeName?: string }
): boolean {
  const words = extractSearchWords(animeTitle);
  const core = words.filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w));
  const slug = hiAnimeId.toLowerCase();
  const resultName = options?.hiAnimeName ?? '';

  if (!titleOverlap(words, hiAnimeId, resultName)) return false;
  if (!seasonPartCompatible(animeTitle, hiAnimeId, resultName)) return false;

  const overlapHaystack = `${hiAnimeId} ${resultName}`.toLowerCase();
  const overlap = extractSearchWords(animeTitle).filter(
    (t) => t.length >= 3 && !TITLE_STOP_WORDS.has(t) && fuzzyIncludes(overlapHaystack, t)
  ).length;
  const minOverlap = Math.min(3, core.length);
  if (core.length >= 2 && overlap < minOverlap) return false;

  const titleSlug = buildSearchTitleStripped(animeTitle).replace(/\s+/g, '-');
  if (core.length <= 2 && !slug.startsWith(titleSlug) && overlap < 3) return false;

  const expectSeries =
    options?.episodeCount == null || options.episodeCount === 0 || options.episodeCount > 1;
  if (!options?.allowSpecials && expectSeries) {
    if (SPECIAL_SLUG_MARKERS.some((marker) => slug.includes(marker))) return false;
  }

  return true;
}

function countSlugTokenOverlap(searchTitle: string, slug: string): number {
  const tokens = searchTitle
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((t) => t.length >= 3 && !TITLE_STOP_WORDS.has(t));
  const normalizedSlug = slug.toLowerCase();
  return tokens.filter((t) => normalizedSlug.includes(t)).length;
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
    .replace(/[-_:]/g, ' ')
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
  expectedEpisodeCount?: number,
  alternateTitles: string[] = []
): Promise<HiAnimeSearchResult | null> {
  try {
    const fullSearchTitle = buildSearchTitlePreservingSeason(animeTitle);
    const strippedTitle = buildSearchTitleStripped(animeTitle);
    const knownTitles = [animeTitle, ...alternateTitles].filter(
      (t, i, arr) => Boolean(t?.trim()) && arr.indexOf(t) === i
    );
    const weWantSequel = searchTitleSuggestsSequel(fullSearchTitle);

    if (!fullSearchTitle && !strippedTitle) return null;

    // First try with full title (preserving "season 2", "2nd season", "part 2", etc.)
    // so HiAnime entries like "frieren-beyond-journeys-end-season-2" are found
    let results = fullSearchTitle ? await searchHiAnime(fullSearchTitle) : [];

    if (results.length === 0 && strippedTitle && fullSearchTitle !== strippedTitle) {
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

    // A result is valid if it matches this search title OR another known title
    // (English "Overgeared" vs HiAnime "Tempal: Item no Chikara" / slug overgeared-...)
    const titleMatched = matches.filter((r) =>
      resultMatchesKnownTitle(knownTitles, r.id, r.name ?? '')
    );
    if (titleMatched.length === 0) return null;
    matches = titleMatched;
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
        const slugOverlap = countSlugTokenOverlap(fullSearchTitle, r.id);
        return epDiff + sequelPenalty - slugOverlap * 2;
      };
      const best = matches.reduce((a, b) => (score(a) <= score(b) ? a : b));
      return best;
    }

    // No episode count hint: prefer strongest slug overlap with full search title
    if (matches.length > 1) {
      const best = matches.reduce((a, b) =>
        countSlugTokenOverlap(fullSearchTitle, a.id) >= countSlugTokenOverlap(fullSearchTitle, b.id)
          ? a
          : b
      );
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
        title: decodeEpisodeTitle(ep.title || `Episode ${ep.number}`),
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

  const cacheKey = `hianime:azlist:v3:${apiOption}:${page}`;

  return getCached(
    cacheKey,
    async () => {
      const url = `${HIANIME_API_URL}/api/v2/hianime/azlist/${apiOption}`;
      try {
        const response = await axiosInstance.get(url, {
          params: { page },
          timeout: HIANIME_TIMEOUT,
        });

        const data = response.data?.data ?? response.data;
        return {
          sortOption: data.sortOption ?? apiOption,
          animes: data.animes ?? [],
          totalPages: data.totalPages ?? 1,
          hasNextPage: data.hasNextPage ?? false,
          currentPage: data.currentPage ?? page,
        };
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 404 || status === 501) {
          console.warn('[HiAnime AZ] Endpoint missing — Jikan letter fallback');
          return getJikanAZList(normalized, page);
        }
        throw error;
      }
    },
    CACHE_TTL.ANIME_SEARCH
  ).catch((error: any) => {
    console.error('[HiAnime API Error] getHiAnimeAZList:', error.message);
    throw new Error(`HiAnime A-Z list failed: ${error.message}`);
  });
}

/**
 * Check if HiAnime API is available
 * Uses /health (lightweight) instead of /home (heavy scrape) for fast checks
 */
export async function isHiAnimeAvailable(): Promise<boolean> {
  try {
    const response = await axiosInstance.get(`${HIANIME_API_URL}/health`, {
      timeout: 10000, // /health is fast, no scraping
    });
    return response.status === 200;
  } catch (error) {
    console.warn('[HiAnime API] Not available:', error);
    return false;
  }
}

