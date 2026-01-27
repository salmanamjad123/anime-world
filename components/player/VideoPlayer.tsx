/**
 * Video Player Component
 * HLS video player with custom controls
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Check } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';
import { VideoSource, Subtitle } from '@/types/stream';

interface VideoPlayerProps {
  src: string;
  sources?: VideoSource[]; // All quality sources
  subtitles?: Subtitle[]; // Subtitle tracks
  poster?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export function VideoPlayer({
  src,
  sources = [],
  subtitles = [],
  poster,
  onTimeUpdate,
  onEnded,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('off');
  const [autoQuality, setAutoQuality] = useState(true);
  
  const { volume, playbackSpeed, setVolume } = usePlayerStore();

  // Get current source based on selected quality
  const getCurrentSource = () => {
    if (!sources || sources.length === 0) return src;
    
    if (autoQuality || currentQuality === 'auto') {
      // Return highest quality for auto mode
      const sortedSources = [...sources].sort((a, b) => {
        const qualityOrder: Record<string, number> = { '1080p': 4, '720p': 3, '480p': 2, '360p': 1, 'default': 0 };
        return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
      });
      return sortedSources[0]?.url || src;
    }
    
    const selectedSource = sources.find(s => s.quality === currentQuality);
    return selectedSource?.url || src;
  };

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    const video = videoRef.current;
    if (!video) return;
    
    const currentPlaybackTime = video.currentTime;
    const wasPlaying = !video.paused;
    
    if (quality === 'auto') {
      setAutoQuality(true);
      setCurrentQuality('auto');
    } else {
      setAutoQuality(false);
      setCurrentQuality(quality);
    }
    
    setShowQualityMenu(false);
    
    // HLS will reload with new source
    // We'll restore playback position in the MANIFEST_PARSED event
    if (hlsRef.current && wasPlaying) {
      setTimeout(() => {
        video.currentTime = currentPlaybackTime;
        video.play().catch(console.error);
      }, 100);
    }
  };

  // Handle subtitle change
  const handleSubtitleChange = (subtitleLang: string) => {
    const video = videoRef.current;
    if (!video) return;
    
    console.log(`🎬 Changing subtitle to: ${subtitleLang}`);
    setCurrentSubtitle(subtitleLang);
    setShowSubtitleMenu(false);
    
    // Enable/disable text tracks
    const tracks = video.textTracks;
    console.log(`📝 Total tracks available: ${tracks.length}`);
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      console.log(`  Track ${i}: lang="${track.language}", label="${track.label}", mode="${track.mode}"`);
      
      if (subtitleLang === 'off') {
        track.mode = 'disabled';
      } else if (
        track.language === subtitleLang || 
        track.label === subtitleLang ||
        track.language === subtitleLang.toLowerCase() ||
        track.label?.toLowerCase() === subtitleLang.toLowerCase()
      ) {
        track.mode = 'showing';
        console.log(`✅ Enabled subtitle: ${track.label}`);
      } else {
        track.mode = 'disabled';
      }
    }
  };

  // Initialize HLS
  useEffect(() => {
    const video = videoRef.current;
    const currentSrc = getCurrentSource();
    if (!video || !currentSrc) return;

    setIsLoading(true);

    // Check if HLS is supported
    if (currentSrc.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          // Enable adaptive bitrate streaming
          startLevel: autoQuality ? -1 : undefined, // -1 = auto select
          capLevelToPlayerSize: true,
          maxMaxBufferLength: 30,
        });

        hlsRef.current = hls;
        // Proxy the initial m3u8 URL - the proxy will rewrite all relative URLs
        const proxiedSrc = `/api/proxy?url=${encodeURIComponent(currentSrc)}`;
        hls.loadSource(proxiedSrc);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(console.error);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setIsLoading(false);
                break;
            }
          }
        });

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src;
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(console.error);
        }
      }
    } else {
      // Direct video file
      video.src = currentSrc;
      setIsLoading(false);
      if (autoPlay) {
        video.play().catch(console.error);
      }
    }
  }, [src, autoPlay, currentQuality, autoQuality]);

  // Add subtitle tracks to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Remove existing subtitle tracks
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    if (subtitles && subtitles.length > 0) {
      console.log(`📝 Adding ${subtitles.length} subtitle track(s) to video`);
      
      // Add subtitle tracks
      subtitles.forEach((subtitle, index) => {
        // Skip if subtitle doesn't have a valid URL
        if (!subtitle.url) {
          console.warn(`⚠️ Subtitle missing URL:`, subtitle);
          return;
        }
        
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = subtitle.label || subtitle.lang;
        track.srclang = subtitle.lang;
        
        // Proxy subtitle URL to avoid CORS issues
        const subUrl = subtitle.url.startsWith('http') 
          ? `/api/proxy?url=${encodeURIComponent(subtitle.url)}`
          : subtitle.url;
        track.src = subUrl;
        
        // Set first subtitle as default if user hasn't disabled subtitles
        if (index === 0 && currentSubtitle !== 'off') {
          track.default = true;
          setCurrentSubtitle(subtitle.lang);
        }
        
        video.appendChild(track);
        
        // Log subtitle loading
        track.addEventListener('load', () => {
          console.log(`✅ Subtitle loaded: ${subtitle.label} (${subtitle.lang})`);
          
          // Wait a bit for textTrack to be ready, then enable if needed
          setTimeout(() => {
            const textTrack = video.textTracks[index];
            if (textTrack) {
              console.log(`  TextTrack ${index}: lang="${textTrack.language}", label="${textTrack.label}", mode="${textTrack.mode}"`);
              
              // If this is the first subtitle or matches current selection, enable it
              if ((index === 0 && currentSubtitle !== 'off') || subtitle.lang === currentSubtitle) {
                textTrack.mode = 'showing';
                console.log(`🎬 Enabled subtitle: ${subtitle.label}`);
              }
            }
          }, 100);
        });
        
        track.addEventListener('error', (e) => {
          console.error(`❌ Subtitle failed to load: ${subtitle.label}`, e);
        });
      });
    }
  }, [subtitles, currentSubtitle]);

  // Set volume and playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed]);

  // Handle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  // Handle mute/unmute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      setDuration(total);
      onTimeUpdate?.(current, total);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  // Format time
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onClick={togglePlay}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <button
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <Play className="w-10 h-10 text-white ml-2" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Progress Bar */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full mb-2 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Time */}
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>

              {/* Settings Menu */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl border border-gray-700 min-w-[200px]">
                  {/* Quality Option */}
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSubtitleMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 flex items-center justify-between"
                  >
                    <span>Quality</span>
                    <span className="text-sm text-gray-400">
                      {sources.length > 1 ? currentQuality : 'Auto (HLS)'}
                    </span>
                  </button>

                  {/* Quality Submenu */}
                  {showQualityMenu && (
                    <div className="bg-gray-800 border-t border-gray-700">
                      {sources.length > 1 ? (
                        <>
                          <button
                            onClick={() => handleQualityChange('auto')}
                            className="w-full px-6 py-2 text-left text-white hover:bg-gray-700 flex items-center justify-between text-sm"
                          >
                            <span>Auto</span>
                            {currentQuality === 'auto' && <Check className="w-4 h-4" />}
                          </button>
                          {sources.map((source) => (
                            <button
                              key={source.quality}
                              onClick={() => handleQualityChange(source.quality)}
                              className="w-full px-6 py-2 text-left text-white hover:bg-gray-700 flex items-center justify-between text-sm"
                            >
                              <span>{source.quality}</span>
                              {currentQuality === source.quality && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-6 py-3 text-sm text-gray-400">
                          <p className="mb-1">HLS Adaptive Streaming</p>
                          <p className="text-xs">Quality adjusts automatically based on your connection speed</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtitle Option */}
                  <button
                    onClick={() => {
                      setShowSubtitleMenu(!showSubtitleMenu);
                      setShowQualityMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 flex items-center justify-between"
                  >
                    <span>Subtitles</span>
                    <span className="text-sm text-gray-400">
                      {currentSubtitle === 'off' ? 'Off' : currentSubtitle}
                    </span>
                  </button>

                  {/* Subtitle Submenu */}
                  {showSubtitleMenu && (
                    <div className="bg-gray-800 border-t border-gray-700">
                      {subtitles.length > 0 ? (
                        <>
                          <button
                            onClick={() => handleSubtitleChange('off')}
                            className="w-full px-6 py-2 text-left text-white hover:bg-gray-700 flex items-center justify-between text-sm"
                          >
                            <span>Off</span>
                            {currentSubtitle === 'off' && <Check className="w-4 h-4" />}
                          </button>
                          {subtitles.map((subtitle) => (
                            <button
                              key={subtitle.lang}
                              onClick={() => handleSubtitleChange(subtitle.lang)}
                              className="w-full px-6 py-2 text-left text-white hover:bg-gray-700 flex items-center justify-between text-sm"
                            >
                              <span>{subtitle.label || subtitle.lang}</span>
                              {currentSubtitle === subtitle.lang && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-6 py-3 text-sm text-gray-400">
                          <p>No external subtitles found</p>
                          <p className="text-xs mt-1">Subtitles may be embedded in video</p>
                          <p className="text-xs mt-1">Try switching servers or different episodes</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
            >
              <Maximize className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
