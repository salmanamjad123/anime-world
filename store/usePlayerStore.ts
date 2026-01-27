/**
 * Player Store
 * Manage video player settings with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerConfig, LanguageCategory, StreamQuality } from '@/types';

interface PlayerStore extends PlayerConfig {
  // Actions
  setAutoplay: (autoplay: boolean) => void;
  setAutoNext: (autoNext: boolean) => void;
  setSkipIntro: (skipIntro: boolean) => void;
  setSkipOutro: (skipOutro: boolean) => void;
  setDefaultQuality: (quality: StreamQuality) => void;
  setDefaultLanguage: (language: LanguageCategory) => void;
  setVolume: (volume: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  resetSettings: () => void;
}

const defaultConfig: PlayerConfig = {
  autoplay: true,
  autoNext: true,
  skipIntro: false,
  skipOutro: false,
  defaultQuality: 'default',
  defaultLanguage: 'sub',
  volume: 0.8,
  playbackSpeed: 1.0,
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      ...defaultConfig,

      setAutoplay: (autoplay) => set({ autoplay }),
      setAutoNext: (autoNext) => set({ autoNext }),
      setSkipIntro: (skipIntro) => set({ skipIntro }),
      setSkipOutro: (skipOutro) => set({ skipOutro }),
      setDefaultQuality: (defaultQuality) => set({ defaultQuality }),
      setDefaultLanguage: (defaultLanguage) => set({ defaultLanguage }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      
      resetSettings: () => set(defaultConfig),
    }),
    {
      name: 'anime-player-settings',
    }
  )
);
