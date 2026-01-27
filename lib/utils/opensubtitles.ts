/**
 * OpenSubtitles API Integration
 * Official API for fetching English anime subtitles
 * Documentation: https://api.opensubtitles.com/api/v1
 */

import axios from 'axios';
import { Subtitle } from '@/types/stream';

const OPENSUBTITLES_API_URL = 'https://api.opensubtitles.com/api/v1';
const API_KEY = process.env.OPENSUBTITLES_API_KEY || '';

interface OpenSubtitlesSearchResult {
  id: string;
  type: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    hd: boolean;
    fps: number;
    votes: number;
    points: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    upload_date: string;
    ai_translated: boolean;
    machine_translated: boolean;
    release: string;
    comments: string;
    legacy_subtitle_id: number;
    uploader: {
      uploader_id: number;
      name: string;
      rank: string;
    };
    feature_details: {
      feature_id: number;
      feature_type: string;
      year: number;
      title: string;
      movie_name: string;
      imdb_id: number;
      tmdb_id: number;
    };
    url: string;
    related_links: {
      label: string;
      url: string;
      img_url: string;
    }[];
    files: Array<{
      file_id: number;
      cd_number: number;
      file_name: string;
    }>;
  };
}

interface OpenSubtitlesResponse {
  total_pages: number;
  total_count: number;
  per_page: number;
  page: number;
  data: OpenSubtitlesSearchResult[];
}

/**
 * Search for anime subtitles on OpenSubtitles
 */
export async function searchOpenSubtitles(
  animeTitle: string,
  episodeNumber: number,
  seasonNumber: number = 1,
  language: string = 'en'
): Promise<Subtitle[]> {
  if (!API_KEY) {
    console.warn('⚠️ [OpenSubtitles] API key not configured');
    return [];
  }

  try {
    console.log(`🔍 [OpenSubtitles] Searching: "${animeTitle}" S${seasonNumber}E${episodeNumber}`);

    // Clean anime title for better search results
    const cleanTitle = animeTitle
      .replace(/\([^)]*\)/g, '') // Remove parentheses
      .replace(/\[[^\]]*\]/g, '') // Remove brackets
      .replace(/season\s*\d+/gi, '') // Remove "Season X"
      .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
      .trim();

    const response = await axios.get<OpenSubtitlesResponse>(
      `${OPENSUBTITLES_API_URL}/subtitles`,
      {
        params: {
          query: cleanTitle,
          episode_number: episodeNumber,
          season_number: seasonNumber,
          languages: language,
          type: 'episode',
        },
        headers: {
          'Api-Key': API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'AnimeWorld v1.0',
        },
        timeout: 10000,
      }
    );

    const results = response.data.data || [];
    console.log(`✅ [OpenSubtitles] Found ${results.length} result(s)`);

    if (results.length === 0) {
      return [];
    }

    // Sort by download count and rating
    const sortedResults = results.sort((a, b) => {
      const scoreA = a.attributes.download_count + (a.attributes.ratings * 100);
      const scoreB = b.attributes.download_count + (b.attributes.ratings * 100);
      return scoreB - scoreA;
    });

    // Get the best result
    const best = sortedResults[0];
    const fileId = best.attributes.files[0]?.file_id;

    if (!fileId) {
      console.warn('⚠️ [OpenSubtitles] No file ID found');
      return [];
    }

    // Get download link
    const downloadUrl = await getDownloadLink(fileId, best.attributes.subtitle_id);

    if (!downloadUrl) {
      return [];
    }

    return [{
      url: downloadUrl,
      lang: language,
      label: language === 'en' ? 'English' : language.toUpperCase(),
    }];

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.error('❌ [OpenSubtitles] Rate limit exceeded (10 downloads/day)');
    } else if (error.response?.status === 401) {
      console.error('❌ [OpenSubtitles] Invalid API key');
    } else {
      console.error('❌ [OpenSubtitles] Error:', error.message);
    }
    return [];
  }
}

/**
 * Get download link for a subtitle file
 */
async function getDownloadLink(fileId: number, subtitleId: string): Promise<string | null> {
  try {
    console.log(`📥 [OpenSubtitles] Getting download link for file ${fileId}`);

    const response = await axios.post(
      `${OPENSUBTITLES_API_URL}/download`,
      {
        file_id: fileId,
      },
      {
        headers: {
          'Api-Key': API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'AnimeWorld v1.0',
        },
        timeout: 10000,
      }
    );

    const downloadUrl = response.data?.link;
    
    if (downloadUrl) {
      console.log(`✅ [OpenSubtitles] Got download link`);
      return downloadUrl;
    }

    return null;
  } catch (error: any) {
    console.error('❌ [OpenSubtitles] Download link error:', error.message);
    return null;
  }
}

/**
 * Download and convert subtitle to VTT format
 */
export async function downloadOpenSubtitle(url: string): Promise<string> {
  try {
    console.log(`📥 [OpenSubtitles] Downloading subtitle...`);

    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        'User-Agent': 'AnimeWorld v1.0',
      },
    });

    let content = response.data;

    // Convert SRT to VTT if needed
    if (!content.startsWith('WEBVTT')) {
      console.log(`🔄 [OpenSubtitles] Converting SRT to VTT`);
      content = convertSrtToVtt(content);
    }

    console.log(`✅ [OpenSubtitles] Subtitle downloaded and converted`);
    return content;

  } catch (error: any) {
    console.error('❌ [OpenSubtitles] Download error:', error.message);
    throw error;
  }
}

/**
 * Convert SRT format to VTT format
 */
function convertSrtToVtt(srtContent: string): string {
  // Add WEBVTT header
  let vtt = 'WEBVTT\n\n';

  // Replace SRT timestamps with VTT format
  // SRT: 00:00:01,000 --> 00:00:05,000
  // VTT: 00:00:01.000 --> 00:00:05.000
  vtt += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return vtt;
}
