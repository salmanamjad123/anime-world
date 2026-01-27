/**
 * API Constants
 * Base URLs and endpoints for external APIs
 */

// AniList API
export const ANILIST_API_URL = 
  process.env.NEXT_PUBLIC_ANILIST_API_URL || 'https://graphql.anilist.co';

// Consumet API (you can self-host or use public instance)
export const CONSUMET_API_URL = 
  process.env.NEXT_PUBLIC_CONSUMET_API_URL || 'https://api.consumet.org';

// API Endpoints
export const API_ENDPOINTS = {
  // Internal API routes (Next.js)
  INTERNAL: {
    ANIME: '/api/anime',
    SEARCH: '/api/search',
    EPISODES: '/api/episodes',
    STREAM: '/api/stream',
  },
  
  // Consumet endpoints
  CONSUMET: {
    ANIME_INFO: '/meta/anilist/info',
    ANIME_EPISODES: '/meta/anilist/episodes',
    STREAMING_LINKS: '/meta/anilist/watch',
  },
} as const;

// Rate limiting
export const RATE_LIMITS = {
  ANILIST: 90, // per minute
  CONSUMET: 60, // per minute (adjust based on your hosting)
} as const;

// Cache durations (in seconds)
export const CACHE_DURATIONS = {
  ANIME_LIST: 300, // 5 minutes
  ANIME_DETAIL: 600, // 10 minutes
  EPISODE_LIST: 300, // 5 minutes
  STREAM_SOURCES: 0, // Don't cache - links expire quickly
} as const;
