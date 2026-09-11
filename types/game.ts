/**
 * Village Arena types
 * Source of truth: docs/GAME_ARENA.md
 */

export type FactionId = 'ashen' | 'tide' | 'pulse';

export type EnergyId = 'strike' | 'tide' | 'pulse' | 'blood' | 'any';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type FighterRole = 'striker' | 'tank' | 'support' | 'control' | 'drain' | 'aoe';

export type UnlockRule = 'starter' | 'wins' | 'rank';

export type GameMode = 'ranked' | 'quick' | 'private';

export type TargetKind = 'self' | 'ally' | 'enemy' | 'all-enemies' | 'all-allies' | 'random-enemy';

export type Effect =
  | { type: 'DAMAGE'; amount: number; target: TargetKind }
  | { type: 'HEAL'; amount: number; target: TargetKind }
  | { type: 'STUN'; echoes: number; target: TargetKind }
  | { type: 'SHIELD'; amount: number; target: TargetKind }
  | { type: 'DRAIN_WEAVE'; amount: number }
  | { type: 'APPLY_STATUS'; status: 'burn' | 'mark' | 'tidebind' | 'veil'; echoes: number; target: TargetKind };

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
  skills: [Art, Art, Art];
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
