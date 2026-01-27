/**
 * Subtitle Scraper Utility
 * Fetches subtitles from multiple sources with intelligent fallback
 * Supports: AnimeTosho API, external subtitle databases
 */

import axios from 'axios';
import { Subtitle } from '@/types/stream';

/**
 * AnimeTosho API - Official JSON API (no rate limits!)
 */
interface AnimeToshoResult {
  id: string;
  title: string;
  link: string;
  timestamp: number;
  torrent_url?: string;
  attachments?: Array<{
    filename: string;
    url: string;
    size: number;
  }>;
}

/**
 * Search AnimeTosho for anime subtitles
 */
export async function searchAnimeTosho(
  animeTitle: string,
  episodeNumber: number
): Promise<Subtitle[]> {
  try {
    console.log(`🔍 [AnimeTosho] Searching: "${animeTitle}" Episode ${episodeNumber}`);
    
    // Clean anime title for better search results
    const cleanTitle = animeTitle
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .replace(/\[[^\]]*\]/g, '') // Remove brackets content
      .replace(/season\s*\d+/gi, '')
      .trim();

    // Search AnimeTosho JSON API
    const searchUrl = `https://feed.animetosho.org/json`;
    const response = await axios.get<AnimeToshoResult[]>(searchUrl, {
      params: {
        q: cleanTitle,
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const results = response.data || [];
    const subtitles: Subtitle[] = [];

    // Filter results that match the episode number
    const episodePattern = new RegExp(
      `(e|ep|episode)\\s*0*${episodeNumber}\\b`,
      'i'
    );

    for (const result of results) {
      // Check if title matches episode
      if (!episodePattern.test(result.title)) {
        continue;
      }

      // Look for subtitle attachments
      if (result.attachments && result.attachments.length > 0) {
        for (const attachment of result.attachments) {
          const filename = attachment.filename.toLowerCase();
          
          // Check if it's a subtitle file
          if (
            filename.endsWith('.srt') ||
            filename.endsWith('.ass') ||
            filename.endsWith('.vtt')
          ) {
            // Determine language from filename
            let lang = 'en';
            let label = 'English';
            
            if (filename.includes('.eng.') || filename.includes('english')) {
              lang = 'en';
              label = 'English';
            } else if (filename.includes('.jpn.') || filename.includes('japanese')) {
              lang = 'ja';
              label = 'Japanese';
            } else if (filename.includes('.spa.') || filename.includes('spanish')) {
              lang = 'es';
              label = 'Spanish';
            } else if (filename.includes('.fre.') || filename.includes('french')) {
              lang = 'fr';
              label = 'French';
            }

            subtitles.push({
              url: attachment.url,
              lang,
              label,
            });
          }
        }
      }
    }

    if (subtitles.length > 0) {
      console.log(`✅ [AnimeTosho] Found ${subtitles.length} subtitle(s)`);
    } else {
      console.log(`⚠️ [AnimeTosho] No subtitles found`);
    }

    return subtitles;
  } catch (error: any) {
    console.error('[AnimeTosho Error]:', error.message);
    return [];
  }
}

/**
 * Search OpenSubtitles.com (community API)
 * Note: Limited to 40 requests/day on free tier
 */
export async function searchOpenSubtitles(
  animeTitle: string,
  episodeNumber: number,
  season: number = 1
): Promise<Subtitle[]> {
  try {
    console.log(`🔍 [OpenSubtitles] Searching: "${animeTitle}" S${season}E${episodeNumber}`);
    
    // This would require OpenSubtitles API key
    // For now, we'll skip this to avoid rate limits
    // Users can add their own API key if needed
    
    return [];
  } catch (error) {
    console.error('[OpenSubtitles Error]:', error);
    return [];
  }
}

/**
 * Convert SRT subtitle format to VTT
 */
export function convertSrtToVtt(srtContent: string): string {
  // Add WEBVTT header
  let vtt = 'WEBVTT\n\n';

  // Replace SRT timestamps with VTT format
  // SRT: 00:00:01,000 --> 00:00:05,000
  // VTT: 00:00:01.000 --> 00:00:05.000
  vtt += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return vtt;
}

/**
 * Download subtitle file and convert to VTT if needed
 */
export async function downloadAndConvertSubtitle(url: string): Promise<string> {
  try {
    console.log(`📥 [Subtitle] Downloading: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    let content = response.data;

    // Check if it's SRT format and convert to VTT
    if (url.endsWith('.srt') || content.includes(' --> ') && content.includes(',')) {
      console.log(`🔄 [Subtitle] Converting SRT to VTT`);
      content = convertSrtToVtt(content);
    }

    // If it's ASS format, extract dialogue
    if (url.endsWith('.ass')) {
      console.log(`🔄 [Subtitle] Converting ASS to VTT`);
      content = convertAssToVtt(content);
    }

    console.log(`✅ [Subtitle] Downloaded and converted`);
    return content;
  } catch (error: any) {
    console.error('[Download Error]:', error.message);
    throw error;
  }
}

/**
 * Convert ASS subtitle format to VTT (basic conversion)
 */
function convertAssToVtt(assContent: string): string {
  let vtt = 'WEBVTT\n\n';

  // Extract dialogue lines from ASS
  const lines = assContent.split('\n');
  const dialogueLines = lines.filter(line => line.startsWith('Dialogue:'));

  for (const line of dialogueLines) {
    // ASS format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    const parts = line.split(',');
    if (parts.length < 10) continue;

    const start = convertAssTime(parts[1]);
    const end = convertAssTime(parts[2]);
    const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, '');

    vtt += `${start} --> ${end}\n${text}\n\n`;
  }

  return vtt;
}

/**
 * Convert ASS time format to VTT
 * ASS: 0:00:01.00
 * VTT: 00:00:01.000
 */
function convertAssTime(assTime: string): string {
  const parts = assTime.split(':');
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  const secondsParts = parts[2].split('.');
  const seconds = secondsParts[0].padStart(2, '0');
  const milliseconds = (secondsParts[1] || '00').padEnd(3, '0');

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Generate a simple default subtitle (fallback)
 */
export function generateDefaultSubtitle(message: string = 'No subtitles available'): string {
  return `WEBVTT

00:00:01.000 --> 00:00:05.000
${message}

00:00:05.000 --> 00:00:08.000
Subtitles may be embedded in the video
`;
}

/**
 * Main subtitle fetcher with multi-tier fallback
 */
export async function fetchSubtitlesMultiSource(
  animeTitle: string,
  episodeNumber: number,
  season: number = 1
): Promise<Subtitle[]> {
  const allSubtitles: Subtitle[] = [];

  // TIER 1: AnimeTosho (official API, no limits!)
  try {
    const animeToshoSubs = await searchAnimeTosho(animeTitle, episodeNumber);
    allSubtitles.push(...animeToshoSubs);
  } catch (error) {
    console.error('[AnimeTosho] Failed:', error);
  }

  // TIER 2: OpenSubtitles (if needed, requires API key)
  // Commented out to avoid rate limits on free tier
  // if (allSubtitles.length === 0) {
  //   try {
  //     const openSubtitles = await searchOpenSubtitles(animeTitle, episodeNumber, season);
  //     allSubtitles.push(...openSubtitles);
  //   } catch (error) {
  //     console.error('[OpenSubtitles] Failed:', error);
  //   }
  // }

  // Remove duplicates
  const uniqueSubtitles = Array.from(
    new Map(allSubtitles.map(sub => [sub.lang, sub])).values()
  );

  return uniqueSubtitles;
}
