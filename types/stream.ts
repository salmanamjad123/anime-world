/**
 * Stream Types
 * Types for video streaming sources and servers
 */

import { LanguageCategory } from './episode';

export type StreamQuality = '360p' | '480p' | '720p' | '1080p' | 'default' | 'backup';

/**
 * Subtitle track
 */
export interface Subtitle {
  lang: string;
  url: string;
  label?: string;
}

/**
 * Video source with quality options
 */
export interface VideoSource {
  url: string;
  quality: StreamQuality;
  isM3U8: boolean;
}

/**
 * Streaming server information
 */
export interface StreamServer {
  serverName: string;
  serverId: string;
}

/**
 * Complete streaming source with all metadata
 */
export interface StreamSource {
  sources: VideoSource[];
  subtitles?: Subtitle[];
  intro?: {
    start: number;
    end: number;
  };
  outro?: {
    start: number;
    end: number;
  };
  download?: string;
}

/**
 * Stream sources response from API
 */
export interface StreamSourcesResponse {
  headers?: {
    Referer: string;
    [key: string]: string;
  };
  sources: VideoSource[];
  subtitles: Subtitle[];
  intro?: {
    start: number;
    end: number;
  };
  outro?: {
    start: number;
    end: number;
  };
  download?: string;
}

/**
 * Player configuration
 */
export interface PlayerConfig {
  autoplay: boolean;
  autoNext: boolean;
  skipIntro: boolean;
  skipOutro: boolean;
  defaultQuality: StreamQuality;
  defaultLanguage: LanguageCategory;
  volume: number; // 0-1
  playbackSpeed: number; // 0.25 - 2.0
}
