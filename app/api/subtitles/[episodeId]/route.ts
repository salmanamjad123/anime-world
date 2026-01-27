/**
 * External Subtitles API
 * Fetches subtitles from external sources with intelligent caching
 * 
 * Features:
 * - File-based caching (unlimited users!)
 * - Multi-tier fallback (HiAnime → AnimeTosho)
 * - Automatic format conversion (SRT/ASS → VTT)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSubtitlesMultiSource,
  downloadAndConvertSubtitle,
  generateDefaultSubtitle,
} from '@/lib/utils/subtitle-scraper';
import {
  generateCacheKey,
  getCachedSubtitle,
  cacheSubtitle,
  getCachedSubtitleUrl,
} from '@/lib/utils/subtitle-cache';
import {
  searchOpenSubtitles,
  downloadOpenSubtitle,
} from '@/lib/utils/opensubtitles';
import { Subtitle } from '@/types/stream';

interface SubtitleSource {
  lang: string;
  label: string;
  url: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId } = await params;
    const url = new URL(request.url);
    const animeTitle = url.searchParams.get('title') || '';
    const episodeNumber = parseInt(url.searchParams.get('episode') || '1');
    const animeId = url.searchParams.get('animeId') || episodeId.split('?')[0];
    const language = url.searchParams.get('lang') || 'en';
    const direct = url.searchParams.get('direct') === 'true'; // Return VTT content directly

    console.log(`📝 [Subtitles API] Request: ${animeTitle} E${episodeNumber} (${language})`);

    // STEP 1: Check cache first
    const cacheKey = generateCacheKey(animeId, episodeNumber, language);
    const cachedContent = await getCachedSubtitle(cacheKey);

    if (cachedContent) {
      if (direct) {
        return new NextResponse(cachedContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable', // Cache forever
          },
        });
      }

      // Return cached subtitle URL
      return NextResponse.json({
        subtitles: [
          {
            lang: language,
            label: language === 'en' ? 'English' : language.toUpperCase(),
            url: getCachedSubtitleUrl(cacheKey),
          },
        ],
        cached: true,
      });
    }

    // STEP 2: Try HiAnime API - Check ALL working servers for maximum subtitle availability
    const subtitlesFromHiAnime: SubtitleSource[] = [];
    
    if (episodeId.includes('?ep=')) {
      // Only use working servers (HD-1, HD-2)
      const workingServers = ['hd-1', 'hd-2'];
      
      for (const server of workingServers) {
        try {
          const hiAnimeUrl = `${process.env.NEXT_PUBLIC_HIANIME_API_URL}/api/v2/hianime/episode/sources`;
          const response = await fetch(
            `${hiAnimeUrl}?animeEpisodeId=${episodeId}&server=${server}&category=sub`,
            { 
              signal: AbortSignal.timeout(5000),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const tracks = data?.data?.tracks || [];
            
            for (const track of tracks) {
              // Filter: Include tracks with kind='captions/subtitles' OR no kind (but exclude thumbnails)
              const isThumbnail = track.lang === 'thumbnails' || track.label === 'thumbnails' || track.kind === 'thumbnails';
              const isValidSubtitle = track.kind === 'captions' || track.kind === 'subtitles' || !track.kind;
              
              if (!isThumbnail && isValidSubtitle) {
                // Check if we already have this language
                const existingLang = subtitlesFromHiAnime.find(
                  s => s.lang === track.label?.toLowerCase() || track.lang?.toLowerCase()
                );
                
                if (!existingLang) {
                  subtitlesFromHiAnime.push({
                    lang: (track.label || track.lang || 'en').toLowerCase(),
                    label: track.label || track.lang || 'English',
                    url: track.file || track.url,
                  });
                }
              }
            }
            
            if (tracks.length > 0) {
              console.log(`✅ [HiAnime] Found ${tracks.length} subtitle(s) on ${server}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [HiAnime] ${server} failed or timed out`);
        }
      }
      
      console.log(`📝 [HiAnime] Total unique subtitles collected: ${subtitlesFromHiAnime.length}`);
    }

    // If HiAnime found subtitles, download and cache them
    if (subtitlesFromHiAnime.length > 0) {
      const firstSub = subtitlesFromHiAnime[0];
      
      try {
        // Download and convert subtitle
        const content = await downloadAndConvertSubtitle(firstSub.url);
        
        // Cache it for future users
        await cacheSubtitle(cacheKey, content);
        
        if (direct) {
          return new NextResponse(content, {
            status: 200,
            headers: {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }

        return NextResponse.json({
          subtitles: [
            {
              ...firstSub,
              url: getCachedSubtitleUrl(cacheKey),
            },
          ],
          source: 'hianime',
          cached: false,
        });
      } catch (error) {
        console.error('[HiAnime Download Error]:', error);
        // Continue to next tier
      }
    }

    // STEP 3: Try OpenSubtitles (Best for English subtitles!)
    if (animeTitle && language === 'en') {
      console.log(`🔍 [OpenSubtitles] Searching for English subtitles: "${animeTitle}"`);
      
      const openSubtitles = await searchOpenSubtitles(
        animeTitle,
        episodeNumber,
        1 // Season 1 by default
      );

      if (openSubtitles.length > 0) {
        const englishSub = openSubtitles[0];
        
        try {
          // Download and convert subtitle
          const content = await downloadOpenSubtitle(englishSub.url);
          
          // Cache it permanently
          await cacheSubtitle(cacheKey, content);
          
          if (direct) {
            return new NextResponse(content, {
              status: 200,
              headers: {
                'Content-Type': 'text/vtt; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }

          return NextResponse.json({
            subtitles: [
              {
                lang: 'en',
                label: 'English',
                url: getCachedSubtitleUrl(cacheKey),
              },
            ],
            source: 'opensubtitles',
            cached: false,
          });
        } catch (error) {
          console.error('[OpenSubtitles Download Error]:', error);
        }
      }
    }

    // STEP 4: Try AnimeTosho and other sources (fallback)
    if (animeTitle) {
      console.log(`🔍 [Fallback] Searching AnimeTosho for "${animeTitle}"`);
      
      const externalSubtitles = await fetchSubtitlesMultiSource(
        animeTitle,
        episodeNumber
      );

      if (externalSubtitles.length > 0) {
        const firstSub = externalSubtitles.find(s => s.lang === language) || externalSubtitles[0];
        
        try {
          // Download and convert subtitle
          const content = await downloadAndConvertSubtitle(firstSub.url);
          
          // Cache it
          await cacheSubtitle(cacheKey, content);
          
          if (direct) {
            return new NextResponse(content, {
              status: 200,
              headers: {
                'Content-Type': 'text/vtt; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }

          return NextResponse.json({
            subtitles: [
              {
                lang: firstSub.lang,
                label: firstSub.label,
                url: getCachedSubtitleUrl(cacheKey),
              },
            ],
            source: 'animetosho',
            cached: false,
          });
        } catch (error) {
          console.error('[External Download Error]:', error);
        }
      }
    }

    // STEP 5: No subtitles found - generate default message
    console.log(`⚠️ [Subtitles] No external subtitles found`);
    
    const defaultContent = generateDefaultSubtitle(
      'No external subtitles available. Subtitles may be embedded in the video.'
    );
    
    // Don't cache the "not found" result
    if (direct) {
      return new NextResponse(defaultContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes only
        },
      });
    }

    return NextResponse.json({
      subtitles: [],
      message: 'No subtitles found',
    });
  } catch (error: any) {
    console.error('[Subtitles API Error]:', error.message);
    
    // Return a friendly error subtitle
    const errorContent = generateDefaultSubtitle('Error loading subtitles');
    
    return new NextResponse(errorContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
