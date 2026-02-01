/**
 * Video Player Component
 * HLS video player with custom controls
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Check, RotateCcw, RotateCw, Forward, SkipForward } from 'lucide-react';
import { HlsSafeLoader } from '@/lib/hls-safe-loader';

import { usePlayerStore } from '@/store/usePlayerStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { VideoSource, Subtitle } from '@/types/stream';

interface VideoPlayerProps {
  src: string;
  sources?: VideoSource[]; // All quality sources
  subtitles?: Subtitle[]; // Subtitle tracks
  poster?: string;
  /** Embed URL (megacloud, etc.) - uses iframe, works without proxy like AniWatch */
  embedUrl?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** End time of intro/OP in seconds (default 90). Show "Skip Intro" when currentTime is in [5, introEndSeconds). */
  introEndSeconds?: number;
  /** Length of outro/ED in seconds (default 90). Show "Skip Outro" when currentTime is in [duration - outroLengthSeconds, duration). */
  outroLengthSeconds?: number;
}

const DEFAULT_INTRO_END = 90;
const DEFAULT_OUTRO_LENGTH = 90;

export function VideoPlayer({
  src,
  sources = [],
  subtitles = [],
  poster,
  embedUrl,
  onTimeUpdate,
  onEnded,
  autoPlay = false,
  introEndSeconds = DEFAULT_INTRO_END,
  outroLengthSeconds = DEFAULT_OUTRO_LENGTH,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSubtitlesKeyRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
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
  const isMobile = useIsMobile();

  // Keep ref in sync for timeout callback
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setShowSettings(false);
        setShowQualityMenu(false);
        setShowSubtitleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSettings]);

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
    setShowSettings(false);
    
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
    
    setCurrentSubtitle(subtitleLang);
    setShowSubtitleMenu(false);
    setShowSettings(false);

    // Enable/disable text tracks
    const tracks = video.textTracks;
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      if (subtitleLang === 'off') {
        track.mode = 'disabled';
      } else if (
        track.language === subtitleLang || 
        track.label === subtitleLang ||
        track.language === subtitleLang.toLowerCase() ||
        track.label?.toLowerCase() === subtitleLang.toLowerCase()
      ) {
        track.mode = 'showing';
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
        // Use proxy when NEXT_PUBLIC_USE_PROXY=true (Railway or Next.js /api/proxy)
        const useProxy = process.env.NEXT_PUBLIC_USE_PROXY === 'true';
        const hianimeUrl = process.env.NEXT_PUBLIC_HIANIME_API_URL || '';
        const defaultProxy = hianimeUrl.includes('railway') 
          ? `${hianimeUrl.replace(/\/$/, '')}/api/v2/proxy` 
          : '/api/proxy';
        const proxyUrl = process.env.NEXT_PUBLIC_PROXY_URL || defaultProxy;

        const hls = new Hls({
          loader: HlsSafeLoader,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          startLevel: autoQuality ? -1 : undefined,
          capLevelToPlayerSize: true,
          maxMaxBufferLength: 30,
        });

        hlsRef.current = hls;

        const finalSrc = useProxy
          ? `${proxyUrl}?url=${encodeURIComponent(currentSrc)}`
          : currentSrc;
        hls.loadSource(finalSrc);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch(console.error);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
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
        // Native HLS support (Safari) - always direct, no proxy needed
        video.src = currentSrc;
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
      // Prefer English as default
      const englishIndex = subtitles.findIndex(
        (s) =>
          s.lang === 'en' ||
          s.lang === 'english' ||
          s.label?.toLowerCase().includes('english')
      );
      const defaultIndex = englishIndex >= 0 ? englishIndex : 0;
      const defaultLang = subtitles[defaultIndex]?.lang;

      // Only set default when subtitles change (e.g. new episode), not when user picks a different lang
      const subtitlesKey = subtitles.map((s) => s.url).join('|');
      if (subtitlesKey !== prevSubtitlesKeyRef.current) {
        prevSubtitlesKeyRef.current = subtitlesKey;
        setCurrentSubtitle(defaultLang);
      }

      // Use same-origin proxy for subtitles (browser blocks cross-origin e.g. Railway)
      const subtitleProxyUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/api/proxy` : '/api/proxy';

      let addedIndex = 0;
      let defaultTrackAddedIndex = -1;
      subtitles.forEach((subtitle, index) => {
        if (!subtitle.url) return;

        const trackEl = document.createElement('track');
        trackEl.kind = 'subtitles';
        trackEl.label = subtitle.label || subtitle.lang;
        trackEl.srclang = subtitle.lang;

        const subUrl = subtitle.url.startsWith('http')
          ? `${subtitleProxyUrl}?url=${encodeURIComponent(subtitle.url)}`
          : subtitle.url;
        trackEl.src = subUrl;

        const isDefault = index === defaultIndex;
        if (isDefault) {
          trackEl.default = true;
          defaultTrackAddedIndex = addedIndex;
        }

        video.appendChild(trackEl);

        const idx = addedIndex++;
        const enableDefault = () => {
          const textTrack = trackEl.track ?? video.textTracks[idx];
          if (textTrack && isDefault && textTrack.mode !== 'showing') {
            textTrack.mode = 'showing';
          }
        };
        trackEl.addEventListener('load', enableDefault);
        trackEl.addEventListener('error', () => {});
      });

      // Fallback: enable default subtitle when video is ready (some browsers need this)
      let loadeddataHandler: (() => void) | null = null;
      if (defaultTrackAddedIndex >= 0) {
        loadeddataHandler = () => {
          const textTrack = video.textTracks[defaultTrackAddedIndex];
          if (textTrack && textTrack.mode !== 'showing') {
            textTrack.mode = 'showing';
          }
        };
        video.addEventListener('loadeddata', loadeddataHandler, { once: true });
      }

      return () => {
        if (loadeddataHandler) {
          video.removeEventListener('loadeddata', loadeddataHandler);
        }
      };
    }
  }, [subtitles]);

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

  // Handle fullscreen - on mobile, lock to landscape when entering fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
        // On mobile: auto-rotate to landscape for better viewing (Chrome Android, etc.)
        const orientation = screen.orientation as unknown as { lock?: (m: string) => Promise<void> };
        if (isMobile && typeof orientation?.lock === 'function') {
          try {
            await orientation.lock('landscape');
          } catch {
            // Orientation lock may fail (e.g. iOS); ignore
          }
        }
      } catch {
        setIsFullscreen(false);
      }
    } else {
      try {
        const orient = screen.orientation as unknown as { unlock?: () => void };
        if (typeof orient?.unlock === 'function') orient.unlock();
      } catch {
        // Ignore unlock errors
      }
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen state when user exits via system UI (e.g. Android back)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        try {
          const orient = screen.orientation as unknown as { unlock?: () => void };
          if (typeof orient?.unlock === 'function') orient.unlock();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const SKIP_SECONDS = 10;

  // Skip backward 10 seconds
  const skipBackward = () => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - SKIP_SECONDS);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Skip forward 10 seconds
  const skipForward = () => {
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + SKIP_SECONDS);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Intro/outro skip (AniWatch-style)
  const showSkipIntro =
    duration > introEndSeconds && currentTime >= 5 && currentTime < introEndSeconds;
  const showSkipOutro =
    duration > outroLengthSeconds * 2 && currentTime >= Math.max(0, duration - outroLengthSeconds);

  const skipIntro = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = introEndSeconds;
      setCurrentTime(introEndSeconds);
    }
  };

  const skipOutro = () => {
    onEnded?.();
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

  // Show controls and reset auto-hide timer (mouse + touch)
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) setShowControls(false);
    }, 3000);
  };

  // Zone-based tap: mobile = only center/icon plays; anywhere else toggles controls. Desktop = sides = controls, center = play.
  const handleContainerTap = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = rect.width;

    if (isMobile) {
      // Mobile: only center (where play icon is) = play/pause; anywhere else = show/hide controls
      const leftZone = w * 0.35;
      const rightZone = w * 0.65;
      if (x >= leftZone && x <= rightZone) {
        togglePlay();
        resetHideTimer();
      } else {
        setShowControls((prev) => {
          const next = !prev;
          if (next) resetHideTimer();
          return next;
        });
      }
    } else {
      // Desktop: sides = show/hide controls, center = play/pause
      const leftZone = w * 0.15;
      const rightZone = w * 0.85;
      if (x < leftZone || x > rightZone) {
        setShowControls((prev) => {
          const next = !prev;
          if (next) resetHideTimer();
          return next;
        });
      } else {
        togglePlay();
        resetHideTimer();
      }
    }
  };

  // Auto-hide controls (mouse move + touch on overlay resets via resetHideTimer)
  useEffect(() => {
    const handleMouseMove = () => resetHideTimer();
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts: Left = -10s, Right = +10s
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      const skip = 10;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - skip);
        setCurrentTime(video.currentTime);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + skip);
        setCurrentTime(video.currentTime);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Embed URL with subtitle param (some embeds accept sub=, subtitle=, vtt=)
  // Use same-origin proxy for subtitles (browser blocks cross-origin e.g. Railway)
  const embedWithSubs = useMemo(() => {
    if (!embedUrl || !subtitles?.length) return embedUrl ?? '';
    const english = subtitles.find(
      (s) =>
        s.lang === 'en' ||
        s.lang === 'english' ||
        s.label?.toLowerCase().includes('english')
    );
    const sub = english ?? subtitles[0];
    if (!sub?.url) return embedUrl;
    const subtitleProxyUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/api/proxy` : '/api/proxy';
    const subUrl =
      sub.url.startsWith('http')
        ? `${subtitleProxyUrl}?url=${encodeURIComponent(sub.url)}`
        : sub.url;
    const sep = embedUrl.includes('?') ? '&' : '?';
    // Some embeds use sub=, others subtitle= or vtt= - try sub first (most common)
    return `${embedUrl}${sep}sub=${encodeURIComponent(subUrl)}&subtitle=${encodeURIComponent(subUrl)}`;
  }, [embedUrl, subtitles]);

  // Embed mode: iframe loads CDN embed page (like AniWatch)
  if (embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={embedWithSubs}
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="Anime player"
          onLoad={() => setIsLoading(false)}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
          </div>
        )}
      </div>
    );
  }

  return (

    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-video bg-black rounded-lg group',
        showSettings ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      {/* Video Element - no onClick; tap handled by overlay */}
      <video
        ref={videoRef}
        className="w-full h-full video-subtitles"
        poster={poster}
        onPlay={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPlaying={() => setIsLoading(false)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
      />

      {/* Tap overlay: sides = show/hide bar, center = play/pause; touch resets auto-hide */}
      <div
        className="absolute inset-0 z-[1] cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          handleContainerTap(e.clientX);
        }}
        onTouchEnd={(e) => {
          if (e.changedTouches[0]) {
            e.preventDefault();
            handleContainerTap(e.changedTouches[0].clientX);
          }
        }}
        onTouchMove={() => resetHideTimer()}
        aria-hidden
      />

      {/* Loading Spinner - click to stop loading and show stop state */}
      {isLoading && (
        <div
          className="absolute inset-0 z-[2] flex items-center justify-center bg-black/50 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setIsLoading(false);
            videoRef.current?.pause();
            resetHideTimer();
          }}
          onTouchEnd={(e) => {
            if (e.changedTouches[0]) {
              e.preventDefault();
              setIsLoading(false);
              videoRef.current?.pause();
              resetHideTimer();
            }
          }}
          onTouchMove={() => resetHideTimer()}
          aria-label="Stop loading"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Play Button Overlay - single play icon when paused (at start or mid-video) */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 z-[2] flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleContainerTap(e.clientX);
          }}
          onTouchEnd={(e) => {
            if (e.changedTouches[0]) {
              e.preventDefault();
              handleContainerTap(e.changedTouches[0].clientX);
            }
          }}
          onTouchMove={() => resetHideTimer()}
        >
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center pointer-events-none">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Pause icon overlay - when playing + controls visible; tap to pause; hides with controls */}
      {isPlaying && showControls && (
        <div
          className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              resetHideTimer();
            }}
            onTouchEnd={(e) => {
              if (e.changedTouches[0]) {
                e.preventDefault();
                togglePlay();
                resetHideTimer();
              }
            }}
            className="pointer-events-auto w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-500 transition-colors"
            aria-label="Pause"
          >
            <Pause className="w-10 h-10 text-white" />
          </button>
        </div>
      )}

      {/* Skip Intro / Skip Outro overlays (AniWatch-style) - right side of video */}
      {(showSkipIntro || showSkipOutro) && (showControls || !isPlaying) && (
        <div className="absolute right-4 bottom-20 z-[3] flex flex-col gap-2">
          {showSkipIntro && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skipIntro();
              }}
              className="px-4 py-2 rounded bg-white/90 hover:bg-white text-gray-900 font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
              aria-label="Skip intro"
            >
              Skip Intro
            </button>
          )}
          {showSkipOutro && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skipOutro();
              }}
              className="px-4 py-2 rounded bg-white/90 hover:bg-white text-gray-900 font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
              aria-label="Skip outro / Next episode"
            >
              Next Episode
            </button>
          )}
        </div>
      )}

      {/* Controls - z-10 so above tap overlay; overflow-visible when settings open so menu is not clipped */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300',
          showControls || !isPlaying || currentTime === 0 || isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none',
          showSettings && 'overflow-visible'
        )}
      >
        {/* Progress Bar - always show track; when duration=0 show gray placeholder during fetch */}
        <div className="relative w-full mb-2 min-h-6 flex items-center overflow-visible">
          {/* Base track - always visible (gray when loading, or behind segments when loaded) */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-lg pointer-events-none bg-gray-600"
            aria-hidden
          />
          {/* Intro (dark blue) | main (gray) | outro (dark blue) - behind */}
          {duration > 0 && (
            <div
              className="absolute left-0 right-0 h-1 rounded-lg pointer-events-none"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                background: (() => {
                  const introPct = Math.min(100, (introEndSeconds / duration) * 100);
                  const outroStartPct = Math.max(0, ((duration - outroLengthSeconds) / duration) * 100);
                  return `linear-gradient(to right, rgb(30, 64, 175) 0%, rgb(30, 64, 175) ${introPct}%, rgb(75, 85, 99) ${introPct}%, rgb(75, 85, 99) ${outroStartPct}%, rgb(30, 64, 175) ${outroStartPct}%, rgb(30, 64, 175) 100%)`;
                })(),
              }}
              aria-hidden
            />
          )}
          {/* Played portion = light blue */}
          {duration > 0 && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-l-lg pointer-events-none bg-blue-300"
              style={{ width: `${(currentTime / duration) * 100}%` }}
              aria-hidden
            />
          )}
          {/* Intro/outro dark blue on top so always visible even over played bar */}
          {duration > 0 && (
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-lg pointer-events-none"
              style={{
                background: (() => {
                  const introPct = Math.min(100, (introEndSeconds / duration) * 100);
                  const outroStartPct = Math.max(0, ((duration - outroLengthSeconds) / duration) * 100);
                  return `linear-gradient(to right, rgb(30, 64, 175) 0%, rgb(30, 64, 175) ${introPct}%, transparent ${introPct}%, transparent ${outroStartPct}%, rgb(30, 64, 175) ${outroStartPct}%, rgb(30, 64, 175) 100%)`;
                })(),
              }}
              aria-hidden
            />
          )}
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 1}
            value={currentTime}
            onChange={handleSeek}
            step={0.1}
            disabled={duration <= 0}
            className="relative w-full h-1 rounded-lg appearance-none cursor-pointer bg-transparent disabled:cursor-default disabled:opacity-70 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:block [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            {/* Volume - mute button only on mobile; slider shown on sm+ */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-blue-400 transition-colors shrink-0"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
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
                className="hidden sm:block w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                aria-label="Volume"
              />
            </div>

            {/* Time */}
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Skip Intro - in control bar when in intro range */}
            {showSkipIntro && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skipIntro();
                }}
                className="text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium"
                aria-label="Skip intro"
                title="Skip intro"
              >
                <Forward className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">Skip Intro</span>
              </button>
            )}

            {/* Skip Outro / Next Episode - in control bar when in outro range */}
            {showSkipOutro && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skipOutro();
                }}
                className="text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium"
                aria-label="Next episode"
                title="Next episode"
              >
                <SkipForward className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">Next Episode</span>
              </button>
            )}

            {/* Skip backward 10s */}
            <button
              onClick={skipBackward}
              className="text-white hover:text-blue-400 transition-colors flex items-center gap-1"
              aria-label="Rewind 10 seconds"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-6 h-6" />
              <span className="text-xs font-medium hidden sm:inline">10</span>
            </button>

            {/* Skip forward 10s */}
            <button
              onClick={skipForward}
              className="text-white hover:text-blue-400 transition-colors flex items-center gap-1"
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds"
            >
              <RotateCw className="w-6 h-6" />
              <span className="text-xs font-medium hidden sm:inline">10</span>
            </button>

            {/* Settings Button + Menu (ref for click-outside) */}
            <div ref={settingsMenuRef} className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>

              {/* Settings Menu - fixed max-height for mobile, scroll inside, never clipped */}
              {showSettings && (
                <div
                  className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl border border-gray-700 min-w-[200px] overflow-y-auto overscroll-contain"
                  style={{ maxHeight: 'min(56vh, 320px)' }}
                >
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

                  {/* Subtitle Submenu - scrollable when many options, fits in menu */}
                  {showSubtitleMenu && (
                    <div
                      className="bg-gray-800 border-t border-gray-700 overflow-y-auto overscroll-contain"
                      style={{ maxHeight: 'min(40vh, 240px)' }}
                    >
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
