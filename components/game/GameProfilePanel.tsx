'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserRound, X } from 'lucide-react';
import { FighterArt } from '@/components/game/FighterArt';
import { FEATURED_FIGHTER_IDS, getFighter, lobbyFighters } from '@/lib/game/roster';
import {
  normalizeGameUsername,
  useGameProfileStore,
  validateGameUsername,
} from '@/store/useGameProfileStore';
import { GAME_TITLES } from '@/types/game';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  required?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function GameProfilePanel({ open, required = false, onClose, onSaved }: Props) {
  const username = useGameProfileStore((s) => s.username);
  const motto = useGameProfileStore((s) => s.motto);
  const title = useGameProfileStore((s) => s.title);
  const favoriteFighterId = useGameProfileStore((s) => s.favoriteFighterId);
  const setProfile = useGameProfileStore((s) => s.setProfile);

  const [draftName, setDraftName] = useState(username);
  const [draftMotto, setDraftMotto] = useState(motto);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftFavorite, setDraftFavorite] = useState<string | null>(favoriteFighterId);
  const [error, setError] = useState<string | null>(null);

  const picks = useMemo(() => {
    const featured = FEATURED_FIGHTER_IDS.map((id) => getFighter(id)).filter(
      (fighter): fighter is NonNullable<typeof fighter> => Boolean(fighter)
    );
    const rest = lobbyFighters().slice(0, 12);
    const map = new Map([...featured, ...rest].map((f) => [f.id, f]));
    return [...map.values()].slice(0, 18);
  }, []);

  const previewFighter = getFighter(draftFavorite ?? picks[0]?.id ?? '') ?? picks[0];

  useEffect(() => {
    if (!open) return;
    setDraftName(username);
    setDraftMotto(motto);
    setDraftTitle(title || GAME_TITLES[0]);
    setDraftFavorite(favoriteFighterId);
    setError(null);
  }, [open, username, motto, title, favoriteFighterId]);

  if (!open) return null;

  const save = () => {
    const normalized = normalizeGameUsername(draftName);
    const validation = validateGameUsername(normalized);
    if (validation) {
      setError(validation);
      return;
    }
    const saveError = setProfile({
      username: normalized,
      motto: draftMotto,
      title: draftTitle,
      favoriteFighterId: draftFavorite,
    });
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 px-4 py-8" role="dialog" aria-labelledby="game-profile-title">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-orange-400/40 bg-[#1c1008] p-5 text-amber-50 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300/80">Village Arena</p>
            <h2 id="game-profile-title" className="mt-1 text-xl font-black">
              {username ? 'Edit game profile' : 'Set your game username'}
            </h2>
            <p className="mt-1 text-sm text-amber-100/70">
              {required
                ? 'Pick an arena name before you queue. This is what rivals see.'
                : 'Your arena name, title, and seal show in lobby and battle.'}
            </p>
          </div>
          {!required && (
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200/20 bg-black/35 p-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-amber-200/30">
            {previewFighter ? (
              <FighterArt fighter={previewFighter} sizes="64px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-orange-900/50">
                <UserRound className="h-7 w-7 text-amber-100/70" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{normalizeGameUsername(draftName) || 'your_name'}</p>
            <p className="text-[11px] uppercase tracking-wider text-orange-200/80">{draftTitle}</p>
            {draftMotto.trim() && <p className="mt-0.5 truncate text-xs text-amber-100/60">“{draftMotto.trim()}”</p>}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">Username *</span>
          <input
            value={draftName}
            onChange={(e) => {
              setDraftName(e.target.value);
              setError(null);
            }}
            maxLength={16}
            placeholder="e.g. EchoBlade"
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-orange-500/40 bg-black/40 px-3 py-2 text-amber-50 outline-none focus:ring-2 focus:ring-orange-500"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">Title</span>
          <select
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-orange-500/40 bg-black/40 px-3 py-2 text-amber-50 outline-none focus:ring-2 focus:ring-orange-500"
          >
            {GAME_TITLES.map((item) => (
              <option key={item} value={item} className="bg-[#1c1008]">
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">Motto</span>
          <input
            value={draftMotto}
            onChange={(e) => setDraftMotto(e.target.value.slice(0, 60))}
            maxLength={60}
            placeholder="Bank Weave. Finish loud."
            className="mt-1 w-full rounded-lg border border-orange-500/40 bg-black/40 px-3 py-2 text-amber-50 outline-none focus:ring-2 focus:ring-orange-500"
          />
        </label>

        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">Profile seal</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {picks.map((fighter) => {
              const selected = draftFavorite === fighter.id;
              return (
                <button
                  key={fighter.id}
                  type="button"
                  title={fighter.name}
                  onClick={() => setDraftFavorite(fighter.id)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-md border-2',
                    selected ? 'border-orange-400 ring-1 ring-orange-300' : 'border-transparent opacity-80 hover:opacity-100'
                  )}
                >
                  <FighterArt fighter={fighter} sizes="48px" />
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="mt-3 rounded-md bg-red-950/70 px-2 py-1.5 text-xs text-orange-200">{error}</p>}

        <button
          type="button"
          onClick={save}
          className="mt-4 w-full rounded-lg bg-orange-600 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-orange-500"
        >
          Save game profile
        </button>
      </div>
    </div>
  );
}
