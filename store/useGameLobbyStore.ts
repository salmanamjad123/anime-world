'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMode } from '@/types/game';
import { TEAM_SIZE } from '@/lib/game/roster';

const TEAM_KEY = 'va-team-v1';

export type GameView = 'lobby' | 'battle';

type GameLobbyState = {
  teamIds: string[];
  focusedId: string | null;
  lastMode: GameMode | null;
  shadeIds: string[];
  /** In-app view — not persisted, so refresh/back never re-opens a finished fight. */
  view: GameView;
  battleRoom: string | null;
  battleKey: number;
  toggleFighter: (id: string, unlocked: boolean) => void;
  setFocused: (id: string) => void;
  clearTeam: () => void;
  setShadeIds: (ids: string[]) => void;
  setLastMode: (mode: GameMode | null) => void;
  startBattle: (opts?: { room?: string | null; mode?: GameMode | null }) => void;
  exitToLobby: () => void;
};

export const useGameLobbyStore = create<GameLobbyState>()(
  persist(
    (set, get) => ({
      teamIds: [],
      focusedId: null,
      lastMode: null,
      shadeIds: [],
      view: 'lobby',
      battleRoom: null,
      battleKey: 0,

      toggleFighter: (id, unlocked) => {
        if (!unlocked) {
          set({ focusedId: id });
          return;
        }
        const { teamIds, focusedId } = get();
        if (teamIds.includes(id)) {
          const next = teamIds.filter((item) => item !== id);
          set({ teamIds: next, focusedId: next[next.length - 1] ?? id });
          return;
        }
        if (teamIds.length < TEAM_SIZE) {
          set({ teamIds: [...teamIds, id], focusedId: id });
          return;
        }
        const focusIdx = focusedId ? teamIds.indexOf(focusedId) : -1;
        const replaceIdx = focusIdx >= 0 ? focusIdx : TEAM_SIZE - 1;
        const next = [...teamIds];
        next[replaceIdx] = id;
        set({ teamIds: next, focusedId: id });
      },

      setFocused: (id) => set({ focusedId: id }),
      clearTeam: () => set({ teamIds: [], focusedId: null }),
      setShadeIds: (ids) => set({ shadeIds: ids }),
      setLastMode: (mode) => set({ lastMode: mode }),

      startBattle: (opts) => {
        set((state) => ({
          view: 'battle',
          battleRoom: opts?.room ?? null,
          lastMode: opts?.mode ?? state.lastMode,
          battleKey: state.battleKey + 1,
        }));
      },

      exitToLobby: () =>
        set({
          view: 'lobby',
          battleRoom: null,
        }),
    }),
    {
      name: TEAM_KEY,
      partialize: (state) => ({
        teamIds: state.teamIds,
        focusedId: state.focusedId,
        // Never persist view/battle — avoids back button resurrecting gameplay.
      }),
    }
  )
);
