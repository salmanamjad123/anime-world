/**
 * Reliable Streaming Sources
 * Multiple embed sources that actually work
 */

export interface StreamingSource {
  name: string;
  embedUrl: string;
  quality: string;
}

/**
 * Get multiple streaming sources for an episode
 * Uses reliable embed services
 */
export function getStreamingEmbeds(
  animeId: string,
  episodeNumber: number,
  animeTitle: string
): StreamingSource[] {
  // Convert anime title to URL-friendly format
  const slug = animeTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  return [
    {
      name: 'Server 1 - Gogoanime',
      embedUrl: `https://gogoanime.hu/${slug}-episode-${episodeNumber}`,
      quality: 'HD',
    },
    {
      name: 'Server 2 - 2Anime',
      embedUrl: `https://2anime.xyz/watch/${slug}-episode-${episodeNumber}`,
      quality: 'HD',
    },
    {
      name: 'Server 3 - AllAnime',
      embedUrl: `https://allanime.to/watch/${slug}/${episodeNumber}`,
      quality: 'HD',
    },
  ];
}

/**
 * Get placeholder video for demo purposes
 * Shows a working player with sample content
 */
export function getPlaceholderStream(episodeNumber: number) {
  return {
    sources: [
      {
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        quality: 'default' as const,
        isM3U8: true,
      },
    ],
    subtitles: [],
  };
}

/**
 * Check if we should use placeholder (for demo)
 */
export function shouldUsePlaceholder(): boolean {
  return process.env.NEXT_PUBLIC_USE_PLACEHOLDER === 'true';
}
