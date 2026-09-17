/**
 * Village Arena types
 * Source of truth: docs/GAME_ARENA.md
 */

export type FactionId = 'ashen' | 'tide' | 'pulse' | 'blade' | 'flare' | 'soul';

export type EnergyId = 'strike' | 'tide' | 'pulse' | 'blood' | 'any';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type FighterRole = 'striker' | 'tank' | 'support' | 'control' | 'drain' | 'aoe';

export type UnlockRule = 'starter' | 'wins' | 'rank';

export type GameMode = 'ranked' | 'quick' | 'private';

export type TargetKind = 'self' | 'ally' | 'enemy' | 'all-enemies' | 'all-allies' | 'random-enemy';

/** Naruto-Arena style damage layers. */
export type DamageKind = 'normal' | 'pierce' | 'affliction';

/** Instant = resolve now. Action = multi-echo channel (dies if caster stunned). Control = bond (dies if caster sealed). */
export type ArtPersistence = 'instant' | 'action' | 'control';

export type StatusId = 'burn' | 'mark' | 'tidebind' | 'veil' | 'dodge' | 'dr';

export type Effect =
  | { type: 'DAMAGE'; amount: number; target: TargetKind; kind?: DamageKind }
  | { type: 'HEAL'; amount: number; target: TargetKind }
  | { type: 'STUN'; echoes: number; target: TargetKind }
  | { type: 'SHIELD'; amount: number; target: TargetKind }
  | { type: 'DRAIN_WEAVE'; amount: number }
  | { type: 'STEAL_WEAVE'; amount: number }
  | {
      type: 'APPLY_STATUS';
      status: StatusId;
      echoes: number;
      target: TargetKind;
      /** Used for damage reduction (flat). */
      amount?: number;
    };

export type EnergyCost = Partial<Record<EnergyId, number>>;

export type Art = {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  energy: EnergyCost;
  target: TargetKind;
  effects: Effect[];
  universal?: boolean;
  persistence?: ArtPersistence;
  /** Optional dedicated jutsu tile under /public/game/skills/... */
  icon?: string;
};

export type Fighter = {
  id: string;
  name: string;
  epithet: string;
  faction: FactionId;
  rarity: Rarity;
  role: FighterRole;
  hp: number;
  unlocked: boolean;
  unlock: UnlockRule;
  accent: string;
  skills: [Art, Art, Art, Art];
};

export type ResonanceKind = 'none' | 'pair' | 'trinity' | 'chaos';

export type TeamValidation = {
  ready: boolean;
  unique: boolean;
  size: number;
  missing: number;
  weaveColors: EnergyId[];
  weaveCoverageOk: boolean;
  resonance: ResonanceKind;
  lockedPicks: string[];
  reasons: string[];
};

export type FactionMeta = {
  id: FactionId;
  name: string;
  blurb: string;
  color: string;
};

/** Local Village Arena identity — separate from site account display name. */
export type GameProfile = {
  /** Arena handle shown in lobby / battle / rooms. Required to queue. */
  username: string;
  motto: string;
  title: string;
  /** Optional portrait fighter id for the profile seal. */
  favoriteFighterId: string | null;
  updatedAt: number;
};

export const GAME_TITLES = [
  'Challenger',
  'Village Hero',
  'Echo Walker',
  'Shade Hunter',
  'Hashira Hopeful',
  'Saiyan Sparker',
  'Soul Reaper',
  'Arena Ace',
] as const;

export type GameTitle = (typeof GAME_TITLES)[number];
