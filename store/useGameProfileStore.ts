'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameProfile } from '@/types/game';
import { GAME_TITLES } from '@/types/game';

const PROFILE_KEY = 'va-game-profile-v1';

export function normalizeGameUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
}

export function validateGameUsername(raw: string): string | null {
  const username = normalizeGameUsername(raw);
  if (username.length < 3) return 'Username needs at least 3 characters.';
  if (username.length > 16) return 'Username max is 16 characters.';
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
    return 'Start with a letter. Use letters, numbers, underscore.';
  }
  return null;
}

type GameProfileState = {
  username: string;
  motto: string;
  title: string;
  favoriteFighterId: string | null;
  updatedAt: number;
  setProfile: (patch: Partial<Omit<GameProfile, 'updatedAt'>>) => string | null;
  clearProfile: () => void;
  hasProfile: () => boolean;
  arenaName: () => string;
};

const EMPTY = {
  username: '',
  motto: '',
  title: GAME_TITLES[0],
  favoriteFighterId: null as string | null,
  updatedAt: 0,
};

export const useGameProfileStore = create<GameProfileState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      setProfile: (patch) => {
        const nextUsername =
          patch.username !== undefined ? normalizeGameUsername(patch.username) : get().username;
        if (patch.username !== undefined) {
          const error = validateGameUsername(nextUsername);
          if (error) return error;
        }
        const motto = (patch.motto ?? get().motto).trim().slice(0, 60);
        const titleRaw = (patch.title ?? get().title).trim() || GAME_TITLES[0];
        const title = (GAME_TITLES as readonly string[]).includes(titleRaw) ? titleRaw : GAME_TITLES[0];
        const favoriteFighterId =
          patch.favoriteFighterId !== undefined ? patch.favoriteFighterId : get().favoriteFighterId;

        set({
          username: nextUsername,
          motto,
          title,
          favoriteFighterId,
          updatedAt: Date.now(),
        });
        return null;
      },

      clearProfile: () => set({ ...EMPTY }),

      hasProfile: () => get().username.trim().length >= 3,

      arenaName: () => {
        const name = get().username.trim();
        return name || 'Challenger';
      },
    }),
    {
      name: PROFILE_KEY,
      partialize: (state) => ({
        username: state.username,
        motto: state.motto,
        title: state.title,
        favoriteFighterId: state.favoriteFighterId,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
