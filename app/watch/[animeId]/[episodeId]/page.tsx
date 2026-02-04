/**
 * Watch Page
 * Video player page for watching episodes
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Button } from '@/components/ui/Button';
import { useAnimeById, useTrendingAnime, usePopularAnime } from '@/hooks/useAnime';
import { useEpisodes } from '@/hooks/useEpisodes';
import { useStreamingSourcesWithFallback } from '@/hooks/useStream';
import { useHistoryStore } from '@/store/useHistoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getPreferredTitle, cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { RecommendedAnimeRow } from '@/components/anime/RecommendedAnimeRow';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const animeId = params.animeId as string;
  const episodeId = decodeURIComponent(params.episodeId as string);

  const [selectedLanguage, setSelectedLanguage] = useState<'sub' | 'dub'>('sub');
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [currentProvider] = useState('hianime');
  const [selectedServer, setSelectedServer] = useState<string>('hd-1');

  // Only hd-1 and hd-2 work - reset if invalid
  useEffect(() => {
    if (selectedServer !== 'hd-1' && selectedServer !== 'hd-2') {
      setSelectedServer('hd-1');
    }
  }, [selectedServer]);
  const [allSubtitles, setAllSubtitles] = useState<any[]>([]);

  const { data: animeData } = useAnimeById(animeId);
  const { data: trendingData, isLoading: isTrendingLoading } = useTrendingAnime(1, 18);
  const { data: popularData, isLoading: isPopularLoading } = usePopularAnime(1, 18);
  const { data: episodesData } = useEpisodes(animeId, selectedLanguage === 'dub');
  const isFallbackEpisode = episodeId.includes('-episode-') && !episodeId.includes('?ep=');
  const fallbackEpisodeNum = useMemo(
    () => (isFallbackEpisode ? parseInt(episodeId.match(/-episode-(\d+)$/)?.[1] ?? '0', 10) : null),
    [isFallbackEpisode, episodeId]
  );
  // When URL is fallback format (e.g. 182587-episode-1), refetch episodes to get real HiAnime ID so we can load stream
  const { data: resolvedEpisodeId } = useQuery({
    queryKey: ['resolve-episode', animeId, selectedLanguage === 'dub', fallbackEpisodeNum],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${animeId}?dub=${selectedLanguage === 'dub'}`);
      if (!res.ok) return null;
      const data = await res.json();
      const ep = data.episodes?.find((e: { number: number; id: string }) => e.number === fallbackEpisodeNum);
      return ep?.id?.includes('?ep=') ? ep.id : null;
    },
    enabled: !!animeId && isFallbackEpisode && !!fallbackEpisodeNum,
    staleTime: 0,
  });
  const streamEpisodeId = isFallbackEpisode ? (resolvedEpisodeId ?? null) : episodeId;
  const { data: streamData, isLoading: isStreamLoading, error: streamError } = useStreamingSourcesWithFallback(
    streamEpisodeId,
    selectedLanguage,
    selectedServer
  );

  const { updateProgress } = useHistoryStore();
  const { autoNext } = usePlayerStore();

  const anime = animeData?.data?.Media;
  const episodes = episodesData?.episodes || [];
  const currentEpisodeIndex = episodes.findIndex(
    (ep) => ep.id === episodeId || (isFallbackEpisode && fallbackEpisodeNum != null && ep.number === fallbackEpisodeNum)
  );
  const currentEpisode = episodes[currentEpisodeIndex];
  const videoSource = streamData?.sources?.[0]?.url;
  const resolvingFallback = isFallbackEpisode && resolvedEpisodeId === undefined;
  const showStreamDown = (isFallbackEpisode && resolvedEpisodeId === null) || streamError || (!videoSource && !isStreamLoading && !resolvingFallback);

  const title = anime ? getPreferredTitle(anime.title) : 'Loading...';
  const trendingAnime = (trendingData?.data?.Page?.media || []).filter(
    (a: any) => String(a.id) !== String(animeId)
  );
  const popularAnimeFiltered = (popularData?.data?.Page?.media || []).filter(
    (a: any) => String(a.id) !== String(animeId)
  );

  // Auto-fetch English subtitles from external sources if not available from HiAnime
  useEffect(() => {
    const fetchExternalSubtitles = async () => {
      if (!streamData?.subtitles) {
        setAllSubtitles([]);
        return;
      }
      
      // Start with HiAnime subtitles
      let combined = [...streamData.subtitles];
      
      // Check if English subtitle is available
      const hasEnglish = combined.some(
        s => s.lang === 'en' || s.label?.toLowerCase().includes('english')
      );
      
      if (!hasEnglish && anime && currentEpisode && episodeId) {
        console.log('🔍 [Watch] No English subtitle from HiAnime, fetching from external sources...');
        try {
          const response = await fetch(
            `/api/subtitles/${episodeId}?title=${encodeURIComponent(title)}&episode=${currentEpisode.number}&animeId=${animeId}&lang=en`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.subtitles && data.subtitles.length > 0) {
              console.log(`✅ [Watch] Found ${data.subtitles.length} external English subtitle(s)`);
              // Merge with existing subtitles
              combined = [...combined, ...data.subtitles];
            } else {
              console.log('⚠️ [Watch] No external English subtitles found');
            }
          }
        } catch (error) {
          console.error('❌ [Watch] Failed to fetch external subtitles:', error);
        }
      }
      
      setAllSubtitles(combined);
    };
    
    fetchExternalSubtitles();
  }, [streamData, anime, currentEpisode, episodeId, title, animeId]);

  // Handle time updates for progress tracking
  const handleTimeUpdate = (currentTime: number, duration: number) => {
    if (anime && currentEpisode) {
      updateProgress(
        animeId,
        episodeId,
        currentEpisode.number,
        currentTime,
        duration,
        title,
        anime.coverImage.large,
        currentEpisode.title
      );
    }
  };

  // Handle episode end (auto-next)
  const handleEpisodeEnd = () => {
    if (autoNext && currentEpisodeIndex < episodes.length - 1) {
      const nextEpisode = episodes[currentEpisodeIndex + 1];
      router.push(ROUTES.WATCH(animeId, nextEpisode.id));
    }
  };

  // Navigate to previous episode
  const handlePrevious = () => {
    if (currentEpisodeIndex > 0) {
      const prevEpisode = episodes[currentEpisodeIndex - 1];
      router.push(ROUTES.WATCH(animeId, prevEpisode.id));
    }
  };

  // Navigate to next episode
  const handleNext = () => {
    if (currentEpisodeIndex < episodes.length - 1) {
      const nextEpisode = episodes[currentEpisodeIndex + 1];
      router.push(ROUTES.WATCH(animeId, nextEpisode.id));
    }
  };

  // Navigate to specific episode
  const handleEpisodeSelect = (epId: string) => {
    router.push(ROUTES.WATCH(animeId, epId));
    setShowEpisodes(false);
  };

  if (!anime) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Back Button - text wraps on multiple lines, no overflow on mobile */}
        <Button
          variant="ghost"
          onClick={() => router.push(ROUTES.ANIME_DETAIL(animeId))}
          className="mb-3 sm:mb-4 text-sm sm:text-base flex items-start sm:items-center flex max-w-full text-left"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0 mt-0.5 sm:mt-0" />
          <span className="break-words min-w-0">Back to {title}</span>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Video Player Area */}
          <div className="lg:col-span-3 min-w-0">
            {/* Episode Info */}
            <div className="mb-3 sm:mb-4">
              <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 line-clamp-2">
                {title} - Episode {currentEpisode?.number || '...'}
              </h1>
              {currentEpisode?.title && (
                <p className="text-gray-400 text-sm sm:text-base line-clamp-2">{currentEpisode.title}</p>
              )}
            </div>

            {/* Video Player */}
            {isStreamLoading || resolvingFallback ? (
              <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4" />
                  <p className="text-gray-400">{resolvingFallback ? 'Resolving episode...' : 'Loading video...'}</p>
                </div>
              </div>
            ) : showStreamDown ? (
              <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center min-h-[200px]">
                <div className="text-center max-w-md px-6">
                  <div className="text-6xl mb-4">⚠️</div>
                  <p className="text-amber-400 text-xl font-bold mb-3">Streaming Server Down</p>
                  <p className="text-gray-300 mb-4">
                    The streaming server is temporarily unavailable. Please try again later.
                  </p>
                  <p className="text-gray-400 text-sm mb-6">
                    Ensure the HiAnime API is running at {process.env.NEXT_PUBLIC_HIANIME_API_URL || 'http://localhost:4000'}, or check back when the server is back online.
                  </p>
                  <div className="bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
                    <p className="text-gray-300 text-sm mb-2"><strong>What you can do:</strong></p>
                    <ul className="text-gray-400 text-sm space-y-1">
                      <li>• Ensure HiAnime API is running at the configured URL</li>
                      <li>• Refresh the page and try again</li>
                      <li>• Go back and try a different anime</li>
                    </ul>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button variant="primary" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
                    <Button variant="ghost" onClick={() => router.push(ROUTES.ANIME_DETAIL(animeId))}>
                      Back to Episodes
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full overflow-visible rounded-lg">
                <VideoPlayer
                  src={videoSource ?? ''}
                  sources={streamData?.sources}
                  subtitles={allSubtitles}
                  poster={anime.bannerImage || anime.coverImage.large}
                  embedUrl={streamData?.embedUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEpisodeEnd}
                  autoPlay
                  introEndSeconds={streamData?.intro?.end}
                  outroLengthSeconds={
                    streamData?.outro
                      ? streamData.outro.end - streamData.outro.start
                      : undefined
                  }
                />
              </div>
            )}

            {/* Player Controls - stacked on mobile, row on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mt-3 sm:mt-4 bg-gray-800/50 rounded-lg p-3 sm:p-4">
              <div className="flex gap-2 order-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentEpisodeIndex === 0}
                  className="flex-1 sm:flex-initial text-sm"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 shrink-0" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentEpisodeIndex === episodes.length - 1}
                  className="flex-1 sm:flex-initial text-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 shrink-0" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEpisodes(!showEpisodes)}
                  className="sm:ml-auto text-sm"
                >

                  <List className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 shrink-0" />
                  Episodes
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 order-2">
                {/* Server Selector */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label className="text-xs sm:text-sm text-gray-400 shrink-0">Server:</label>
                  <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="bg-gray-700 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm border border-gray-600 hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    title="Try different servers if video doesn't load"
                  >
                    <option value="hd-1">HD-1</option>
                    <option value="hd-2">HD-2</option>
                  </select>
                </div>

                {/* Sub/Dub Toggle */}
                <div className="flex bg-gray-700 rounded-lg p-0.5 sm:p-1">
                  <button
                    onClick={() => setSelectedLanguage('sub')}
                    className={cn(
                      'px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors',
                      selectedLanguage === 'sub'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    )}
                  >
                    SUB
                  </button>
                  <button
                    onClick={() => setSelectedLanguage('dub')}
                    className={cn(
                      'px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors',
                      selectedLanguage === 'dub'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    )}
                  >
                    DUB
                  </button>
                </div>
              </div>
            </div>

            {/* Episode Description */}
            {currentEpisode?.description && (
              <div className="mt-4 sm:mt-6 bg-gray-800/50 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-2">Episode Description</h3>
                <p className="text-gray-300 text-sm sm:text-base">{currentEpisode.description}</p>
              </div>
            )}
          </div>

          {/* Sidebar - Episode List */}
          <div className="lg:col-span-1 min-w-0">
            <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 lg:sticky lg:top-20">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Episodes</h3>
              
              <div className="max-h-[50vh] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                  {episodes.map((episode) => {
                    const isCurrent = episode.id === episodeId;
                    return (
                      <button
                        key={episode.id}
                        onClick={() => handleEpisodeSelect(episode.id)}
                        className={`w-full text-left p-2 sm:p-2.5 lg:p-3 rounded-lg transition-colors text-xs sm:text-sm lg:text-base ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                        }`}
                      >
                        <div className="font-semibold truncate">Ep {episode.number}</div>
                        {episode.title && (
                          <div className="text-[10px] sm:text-xs mt-0.5 line-clamp-2 opacity-80 truncate">
                            {episode.title}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <RecommendedAnimeRow
          title="Recommended for you"
          anime={trendingAnime.slice(0, 12)}
          isLoading={isTrendingLoading}
          className="mt-10"
        />
        <RecommendedAnimeRow
          title="Most Popular"
          anime={popularAnimeFiltered.slice(0, 12)}
          isLoading={isPopularLoading}
          className="mt-8"
        />
      </div>
    </div>
  );
}
