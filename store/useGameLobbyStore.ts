'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMode } from '@/types/game';
import { TEAM_SIZE } from '@/lib/game/roster';

const TEAM_KEY = 'va-team-v1';

type GameLobbyState = {
  teamIds: string[];
  focusedId: string | null;
  lastMode: GameMode | null;
  shadeIds: string[];
  toggleFighter: (id: string, unlocked: boolean) => void;
  setFocused: (id: string) => void;
  clearTeam: () => void;
  setShadeIds: (ids: string[]) => void;
  setLastMode: (mode: GameMode | null) => void;
};

export const useGameLobbyStore = create<GameLobbyState>()(
  persist(
    (set, get) => ({
      teamIds: [],
      focusedId: null,
      lastMode: null,
      shadeIds: [],

      toggleFighter: (id, unlocked) => {
        if (!unlocked) {
          set({ focusedId: id });
          return;
        }
        const { teamIds } = get();
        if (teamIds.includes(id)) {
          const next = teamIds.filter((item) => item !== id);
          set({ teamIds: next, focusedId: next[next.length - 1] ?? id });
          return;
        }
        if (teamIds.length >= TEAM_SIZE) return;
        set({ teamIds: [...teamIds, id], focusedId: id });
      },

      setFocused: (id) => set({ focusedId: id }),
      clearTeam: () => set({ teamIds: [], focusedId: null }),
      setShadeIds: (ids) => set({ shadeIds: ids }),
      setLastMode: (mode) => set({ lastMode: mode }),
    }),
    {
      name: TEAM_KEY,
      partialize: (state) => ({
        teamIds: state.teamIds,
        focusedId: state.focusedId,
      }),
    }
  )
);
