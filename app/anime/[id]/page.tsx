/**
 * Anime Detail Page
 * Shows anime information and episode list
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useAnimeById, useTrendingAnime, usePopularAnime } from '@/hooks/useAnime';
import { useEpisodes, useEpisodesForSeasons, useAnimeInfo } from '@/hooks/useEpisodes';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { getPreferredTitle, stripHtml, formatSeasonYear, getScoreColor } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { Heart, Play, Star, Calendar, Tv, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { RecommendedAnimeRow } from '@/components/anime/RecommendedAnimeRow';

export default function AnimeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const animeId = params.id as string;
  
  const [selectedLanguage, setSelectedLanguage] = useState<'sub' | 'dub'>('sub');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(animeId);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const { data: animeData, isLoading: isAnimeLoading } = useAnimeById(animeId);
  const { data: trendingData, isLoading: isTrendingLoading } = useTrendingAnime(1, 18);
  const { data: popularData, isLoading: isPopularLoading } = usePopularAnime(1, 18);
  const { data: episodesData, isLoading: isEpisodesLoading } = useEpisodes(selectedSeasonId, selectedLanguage === 'dub');
  const { data: animeInfo } = useAnimeInfo(selectedSeasonId);
  const seasonEpisodeCounts = useEpisodesForSeasons(seasons, selectedLanguage === 'dub');

  // Fetch seasons and movies
  useEffect(() => {
    async function fetchSeasons() {
      try {
        const response = await fetch(`/api/anime/${animeId}/seasons`);
        if (response.ok) {
          const data = await response.json();

          // Debug: log full seasons API response
          console.log('📺 [Seasons] Anime ID:', animeId);
          console.log('📺 [Seasons] Full API response:', data);
          console.log('📺 [Seasons] Main:', data.main);
          console.log('📺 [Seasons] Seasons (related):', data.seasons);
          console.log('📺 [Seasons] Movies:', data.movies);
          console.log('📺 [Seasons] Specials (not shown on UI):', data.specials);

          setSeasons([data.main, ...data.seasons]);
          setMovies(data.movies);
        } else {
          console.warn('📺 [Seasons] API failed:', response.status);
        }
      } catch (error) {
        console.error('📺 [Seasons] Failed to fetch:', error);
      }
    }

    if (animeId) {
      fetchSeasons();
    }
  }, [animeId]);
  
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const { getProgress } = useHistoryStore();
  
  const anime = animeData?.data?.Media;
  const episodes = episodesData?.episodes || [];
  const watchProgress = getProgress(animeId);
  const trendingAnime = (trendingData?.data?.Page?.media || []).filter(
    (a: any) => String(a.id) !== String(animeId)
  );
  const popularAnimeFiltered = (popularData?.data?.Page?.media || []).filter(
    (a: any) => String(a.id) !== String(animeId)
  );
  if (isAnimeLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Anime not found</h1>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const title = getPreferredTitle(anime.title);
  const description = anime.description ? stripHtml(anime.description) : 'No description available.';
  const inWatchlist = isInWatchlist(animeId);

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(animeId);
    } else {
      addToWatchlist(animeId, title, anime.coverImage.large);
    }
  };

  const handlePlayFirst = () => {
    if (episodes.length > 0) {
      router.push(ROUTES.WATCH(animeId, episodes[0].id));
    }
  };

  const handleContinueWatching = () => {
    if (watchProgress) {
      router.push(ROUTES.WATCH(animeId, watchProgress.episodeId));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      {/* Banner Section */}
      <div className="relative min-h-[380px] md:h-[500px] w-full">
        {/* Background Image */}
        {anime.bannerImage && (
          <div className="absolute inset-0">
            <Image
              src={anime.bannerImage}
              alt={title}
              fill
              className="object-cover opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
          </div>
        )}

        {/* Content: stack on mobile, side-by-side on md+ */}
        <div className="relative container mx-auto px-4 h-full flex flex-col items-center md:items-start pt-4 pb-5  md:pt-0 md:pb-12 md:justify-end">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-6xl">
            {/* Cover Image: centered on mobile, left on desktop */}
            <div className="shrink-0 w-40 mx-auto md:mx-0 md:w-48 md:-mb-24">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={anime.coverImage.extraLarge || anime.coverImage.large}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 md:pb-8 text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
              {anime.title.native && (
                <p className="text-gray-400 mb-3 md:mb-4 text-sm sm:text-base">{anime.title.native}</p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-3 md:mb-4 text-sm">
                {anime.averageScore && (
                  <div className="flex items-center gap-1">
                    <Star className={`w-4 h-4 fill-current ${getScoreColor(anime.averageScore)}`} />
                    <span className="text-white">{(anime.averageScore / 10).toFixed(1)}</span>
                  </div>
                )}
                {anime.format && (
                  <div className="flex items-center gap-1">
                    <Tv className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300">{anime.format}</span>
                  </div>
                )}
                {(anime.season || anime.seasonYear) && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300">{formatSeasonYear(anime.season, anime.seasonYear)}</span>
                  </div>
                )}
                {/* Show episode count when we've fetched for selected season */}
                {(seasonEpisodeCounts[selectedSeasonId] ?? (!isEpisodesLoading ? episodes.length : null)) != null && (
                  <span className="text-gray-300">
                    {seasonEpisodeCounts[selectedSeasonId] ?? episodes.length} Episodes
                  </span>
                )}
              </div>

              {/* Genres */}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                  {anime.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 text-sm border border-blue-600/30"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: stack on mobile, row on sm+ */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {watchProgress ? (
                  <Button variant="primary" size="lg" onClick={handleContinueWatching} className="w-full sm:w-auto">
                    <Play className="w-5 h-5 mr-2" />
                    Continue Episode {watchProgress.episodeNumber}
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={handlePlayFirst} className="w-full sm:w-auto">
                    <Play className="w-5 h-5 mr-2" />
                    Play Now
                  </Button>
                )}
                <Button variant="secondary" size="lg" onClick={handleWatchlistToggle} className="w-full sm:w-auto">
                  <Heart className={`w-5 h-5 mr-2 ${inWatchlist ? 'fill-current' : ''}`} />
                  {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description and Episodes */}
      <div className="container mx-auto px-4 pb-5 mt-0 md:pb-12 ">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
          {/* Main Content: Episodes first so users don't need to scroll */}
          <div className="lg:col-span-2">
            {/* Season/Movie Selector */}
            {(seasons.length >= 1 || movies.length > 0) && (
              <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Select Season or Movie</h3>
                
                {/* Seasons - show main series even when alone (e.g. One Piece 1000+ eps); also PARENT when viewing a movie */}
                {seasons.length >= 1 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-2">Seasons</p>
                    <div className="flex flex-wrap gap-2">
                      {seasons.map((season, index) => {
                        const isSelected = selectedSeasonId === season.id;
                        const displayCount = seasonEpisodeCounts[season.id];
                        return (
                          <Button
                            key={season.id}
                            variant={isSelected ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => {
                              setSelectedSeasonId(season.id);
                              console.log('📺 [Season Selected]', {
                                id: season.id,
                                title: season.title,
                                relationType: season.relationType,
                                episodes: season.episodes,
                              });
                            }}
                          >
                            {season.title || (season.relationType === 'MAIN' ? 'Season 1' : `Season ${index + 1}`)}
                            {displayCount != null && ` (${displayCount} eps)`}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Movies */}
                {movies.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Movies</p>
                    <div className="flex flex-wrap gap-2">
                      {movies.map((movie) => (
                        <Button
                          key={movie.id}
                          variant={selectedSeasonId === movie.id ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setSelectedSeasonId(movie.id);
                            console.log('📺 [Movie Selected]', {
                              id: movie.id,
                              title: movie.title,
                            });
                          }}
                        >
                          {movie.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Episodes */}
            <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  Episodes
                  {seasons.find(s => s.id === selectedSeasonId)?.relationType !== 'MAIN' && 
                    ` - ${seasons.find(s => s.id === selectedSeasonId)?.title || 'Season'}`
                  }
                </h2>
                
                {/* Sub/Dub Toggle */}
                {animeInfo && (animeInfo.hasSub || animeInfo.hasDub) && (
                  <div className="flex gap-2">
                    {animeInfo.hasSub && (
                      <Button
                        variant={selectedLanguage === 'sub' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedLanguage('sub')}
                      >
                        Sub
                      </Button>
                    )}
                    {animeInfo.hasDub && (
                      <Button
                        variant={selectedLanguage === 'dub' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedLanguage('dub')}
                      >
                        Dub
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isEpisodesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                </div>
              ) : episodes.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto rounded-lg pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {episodes.map((episode) => (
                      <button
                        key={episode.id}
                        onClick={() => router.push(ROUTES.WATCH(selectedSeasonId, episode.id))}
                        className="bg-gray-700/50 hover:bg-gray-700 rounded-lg p-4 transition-colors text-left"
                      >
                        <div className="text-white font-semibold">Episode {episode.number}</div>
                        {episode.title && episode.title !== `Episode ${episode.number}` && (
                          <div className="text-gray-400 text-sm mt-1 line-clamp-2">{episode.title}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">
                    {seasons.length > 1 || movies.length > 0
                      ? 'No episodes for this season. Try selecting another season or movie above.'
                      : 'No episode information available for this anime.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Synopsis at top, then Studios & Status */}
          <div className="space-y-4 md:space-y-6">
            {/* Synopsis (accordion: 3 lines by default, expand to see full) */}
            <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
              <button
                type="button"
                onClick={() => setSynopsisExpanded((e) => !e)}
                className="flex items-center gap-2 w-full text-left mb-3 md:mb-4 group"
                aria-expanded={synopsisExpanded}
              >
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${synopsisExpanded ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">Synopsis</h2>
              </button>
              <p
                className={`text-gray-300 leading-relaxed text-sm md:text-base ${synopsisExpanded ? '' : 'line-clamp-3'}`}
              >
                {description}
              </p>
            </div>

            {/* Studios */}
            {anime.studios?.nodes && anime.studios.nodes.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-bold text-white mb-3">Studios</h3>
                {anime.studios.nodes.map((studio, index) => (
                  <div key={index} className="text-gray-300">{studio.name}</div>
                ))}
              </div>
            )}

            {/* Status */}
            {anime.status && (
              <div className="bg-gray-800/50 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-bold text-white mb-3">Status</h3>
                <p className="text-gray-300 capitalize">{anime.status.toLowerCase().replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recommended for you + Most Popular */}
        <RecommendedAnimeRow
          title="Recommended for you"
          anime={trendingAnime.slice(0, 12)}
          isLoading={isTrendingLoading}
          className="mt-8"
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
