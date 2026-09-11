import type { Art, EnergyId, FactionId, FactionMeta, Fighter } from '@/types/game';
import { AEGIS_VEIL } from '@/lib/game/aegis';

export const RULESET_VERSION = 'v0.3';

export function fighterPortrait(id: string): string {
  return `/game/fighters/${id}.png`;
}
export const TEAM_SIZE = 3;
export const FIGHTER_HP = 100;

export const FACTIONS: Record<FactionId, FactionMeta> = {
  ashen: {
    id: 'ashen',
    name: 'Naruto Shippuden',
    blurb: 'Shinobi strikers — burst, marks, and clean blades.',
    color: '#fb923c',
  },
  tide: {
    id: 'tide',
    name: 'One Piece',
    blurb: 'Pirates — shields, drains, and crushing waves.',
    color: '#22d3ee',
  },
  pulse: {
    id: 'pulse',
    name: 'Jujutsu Kaisen',
    blurb: 'Sorcerers — beams, domains, and cursed strikes.',
    color: '#a78bfa',
  },
};

export const ENERGY_META: Record<
  EnergyId,
  { label: string; short: string; color: string; shape: 'diamond' | 'wave' | 'circle' | 'drop' | 'square' }
> = {
  strike: { label: 'Strike', short: 'S', color: '#ef4444', shape: 'diamond' },
  tide: { label: 'Tide', short: 'T', color: '#22d3ee', shape: 'wave' },
  pulse: { label: 'Pulse', short: 'P', color: '#a78bfa', shape: 'circle' },
  blood: { label: 'Blood', short: 'B', color: '#e11d48', shape: 'drop' },
  any: { label: 'Any', short: 'A', color: '#111827', shape: 'square' },
};

function art(
  id: string,
  name: string,
  description: string,
  cooldown: number,
  energy: Art['energy'],
  target: Art['target'],
  effects: Art['effects']
): Art {
  return { id, name, description, cooldown, energy, target, effects };
}

export const FIGHTERS: Fighter[] = [
  {
    id: 'kaen-roux',
    name: 'Sasuke Uchiha',
    epithet: 'Avenger',
    faction: 'ashen',
    rarity: 'rare',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f97316',
    skills: [
      art('cinder-rush', 'Cinder Rush', 'Dash in. 28 Strike damage to one foe.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 28, target: 'enemy' },
      ]),
      art('ember-mark', 'Ember Mark', 'Mark a foe. They take +8 from the next art.', 2, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 12, target: 'enemy' },
      ]),
      art('fang-break', 'Fang Break', 'Heavy cut. 42 damage. Ignores 10 shield.', 3, { strike: 2 }, 'enemy', [
        { type: 'DAMAGE', amount: 42, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'shiro-vale',
    name: 'Kakashi Hatake',
    epithet: 'Copy Ninja',
    faction: 'ashen',
    rarity: 'rare',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fdba74',
    skills: [
      art('twin-step', 'Twin Step', 'Stun one foe for this Echo resolve.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('ash-clone', 'Ash Clone', '12 damage to all foes. Hard to read.', 1, { strike: 1, any: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 12, target: 'all-enemies' },
      ]),
      art('fold-night', 'Fold Night', 'Ally veil + 10 heal.', 3, { pulse: 1, blood: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'ally' },
        { type: 'HEAL', amount: 10, target: 'ally' },
      ]),
    ],
  },
  {
    id: 'rin-ashe',
    name: 'Sakura Haruno',
    epithet: 'Cherry Blossom',
    faction: 'ashen',
    rarity: 'common',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fb7185',
    skills: [
      art('field-wrap', 'Field Wrap', 'Heal one ally 22.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 22, target: 'ally' },
      ]),
      art('splint-line', 'Splint Line', 'Heal all allies 10 and 8 shield.', 2, { pulse: 1, any: 1 }, 'all-allies', [
        { type: 'HEAL', amount: 10, target: 'all-allies' },
        { type: 'SHIELD', amount: 8, target: 'all-allies' },
      ]),
      art('last-ember', 'Last Ember', 'Revive logic later. For now 35 heal to lowest ally.', 4, { pulse: 2, blood: 1 }, 'ally', [
        { type: 'HEAL', amount: 35, target: 'ally' },
      ]),
    ],
  },
  {
    id: 'mori-kess',
    name: 'Hinata Hyuga',
    epithet: 'Byakugan',
    faction: 'ashen',
    rarity: 'epic',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#65a30d',
    skills: [
      art('root-bind', 'Root Bind', 'Tidebind a foe for 2 Echoes.', 2, { tide: 1, pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'tidebind', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 10, target: 'enemy' },
      ]),
      art('pitfall', 'Pitfall', '18 damage + stun.', 3, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('grove-close', 'Grove Close', 'All foes 8 damage and lose 1 weave (engine).', 3, { tide: 2 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
        { type: 'DRAIN_WEAVE', amount: 1 },
      ]),
    ],
  },
  {
    id: 'toru-blade',
    name: 'Might Guy',
    epithet: 'Noble Green',
    faction: 'ashen',
    rarity: 'epic',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#facc15',
    skills: [
      art('first-cut', 'First Cut', '16 damage. Always available.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('second-cut', 'Second Cut', '24 damage if the target is marked.', 1, { strike: 1, any: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 24, target: 'enemy' },
      ]),
      art('seventh', 'Seventh', '50 damage. Long cooldown.', 4, { strike: 2, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 50, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'yuna-veil',
    name: 'Itachi Uchiha',
    epithet: 'Crow',
    faction: 'ashen',
    rarity: 'legendary',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#e2e8f0',
    skills: [
      art('soft-edge', 'Soft Edge', 'Mark + 14 damage.', 1, { pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('vanish-line', 'Vanish Line', 'Self veil and 10 damage to a random foe.', 2, { pulse: 1, any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'self' },
        { type: 'DAMAGE', amount: 10, target: 'random-enemy' },
      ]),
      art('quiet-kill', 'Quiet Kill', '36 damage. If marked, stun.', 3, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 36, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'captain-vex',
    name: 'Roronoa Zoro',
    epithet: 'Pirate Hunter',
    faction: 'tide',
    rarity: 'rare',
    role: 'tank',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#155e75',
    skills: [
      art('bulkhead', 'Bulkhead', '18 shield on self.', 0, { tide: 1 }, 'self', [
        { type: 'SHIELD', amount: 18, target: 'self' },
      ]),
      art('ram', 'Ram', '22 damage and 8 shield.', 1, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 22, target: 'enemy' },
        { type: 'SHIELD', amount: 8, target: 'self' },
      ]),
      art('hold-fast', 'Hold Fast', '12 shield on all allies.', 3, { tide: 2 }, 'all-allies', [
        { type: 'SHIELD', amount: 12, target: 'all-allies' },
      ]),
    ],
  },
  {
    id: 'kaito-reef',
    name: 'Jinbe',
    epithet: 'Knight of the Sea',
    faction: 'tide',
    rarity: 'rare',
    role: 'aoe',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#06b6d4',
    skills: [
      art('spray', 'Spray', '10 damage to all foes.', 0, { tide: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 10, target: 'all-enemies' },
      ]),
      art('undertow', 'Undertow', '16 to all + tidebind one.', 2, { tide: 2 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 16, target: 'all-enemies' },
        { type: 'APPLY_STATUS', status: 'tidebind', echoes: 1, target: 'enemy' },
      ]),
      art('reef-crash', 'Reef Crash', '30 to one, 8 to the rest.', 3, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 30, target: 'enemy' },
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
    ],
  },
  {
    id: 'isla-dusk',
    name: 'Nami',
    epithet: 'Cat Burglar',
    faction: 'tide',
    rarity: 'common',
    role: 'tank',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#7dd3fc',
    skills: [
      art('harbor', 'Harbor', '14 shield to an ally.', 0, { pulse: 1 }, 'ally', [
        { type: 'SHIELD', amount: 14, target: 'ally' },
      ]),
      art('dusk-tide', 'Dusk Tide', 'Heal 16 + 6 shield.', 1, { tide: 1, pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 16, target: 'ally' },
        { type: 'SHIELD', amount: 6, target: 'ally' },
      ]),
      art('blackout', 'Blackout', 'Veil an ally.', 3, { tide: 1, blood: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'ally' },
      ]),
    ],
  },
  {
    id: 'namiross',
    name: 'Nico Robin',
    epithet: 'Devil Child',
    faction: 'tide',
    rarity: 'epic',
    role: 'drain',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#0e7490',
    skills: [
      art('siphon', 'Siphon', 'Steal 1 weave (engine) and deal 12.', 1, { tide: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 12, target: 'enemy' },
      ]),
      art('empty-hold', 'Empty Hold', 'Drain 2 weave.', 3, { tide: 1, pulse: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 2 },
      ]),
      art('keel-cut', 'Keel Cut', '26 damage to a drained-feeling target.', 2, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'brine',
    name: 'Trafalgar Law',
    epithet: 'Surgeon of Death',
    faction: 'tide',
    rarity: 'epic',
    role: 'drain',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#5eead4',
    skills: [
      art('salt-cut', 'Salt Cut', '14 damage + burn 2.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'enemy' },
      ]),
      art('rot-wave', 'Rot Wave', 'Burn all foes.', 2, { tide: 1, blood: 1 }, 'all-enemies', [
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'all-enemies' },
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
      art('open-water', 'Open Water', '32 to a burning foe.', 3, { blood: 2 }, 'enemy', [
        { type: 'DAMAGE', amount: 32, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'sable-hook',
    name: 'Marshall D. Teach',
    epithet: 'Blackbeard',
    faction: 'tide',
    rarity: 'legendary',
    role: 'drain',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#1e3a5f',
    skills: [
      art('hook', 'Hook', '18 damage. Pull (control later).', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
      ]),
      art('night-tax', 'Night Tax', 'Drain 1 and 16 damage.', 2, { tide: 1, blood: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('black-prize', 'Black Prize', '40 damage if you drained this Echo (engine flag).', 4, { tide: 1, strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'aora-zen',
    name: 'Yuta Okkotsu',
    epithet: 'Special Grade',
    faction: 'pulse',
    rarity: 'rare',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fde047',
    skills: [
      art('sun-line', 'Sun Line', '26 Pulse damage.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
      ]),
      art('flare-split', 'Flare Split', '14 to all foes.', 1, { pulse: 1, any: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 14, target: 'all-enemies' },
      ]),
      art('zenith', 'Zenith', '44 damage beam.', 3, { pulse: 2 }, 'enemy', [
        { type: 'DAMAGE', amount: 44, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'lys-rael',
    name: 'Megumi Fushiguro',
    epithet: 'Ten Shadows',
    faction: 'pulse',
    rarity: 'rare',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#c4b5fd',
    skills: [
      art('shift', 'Shift', '10 shield + 16 damage.', 1, { pulse: 1 }, 'enemy', [
        { type: 'SHIELD', amount: 10, target: 'self' },
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('raiment', 'Raiment', 'Self 20 shield.', 2, { pulse: 1, blood: 1 }, 'self', [
        { type: 'SHIELD', amount: 20, target: 'self' },
      ]),
      art('true-name', 'True Name', '38 damage. Breaks 12 shield first (engine).', 3, { pulse: 2, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'hali-storm',
    name: 'Nobara Kugisaki',
    epithet: 'Resonance',
    faction: 'pulse',
    rarity: 'common',
    role: 'aoe',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#818cf8',
    skills: [
      art('spark', 'Spark', '20 to one foe.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 20, target: 'enemy' },
      ]),
      art('chain-sky', 'Chain Sky', '12 to all foes.', 1, { pulse: 1, strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 12, target: 'all-enemies' },
      ]),
      art('cell-burst', 'Cell Burst', 'Stun a random foe and 18 damage.', 3, { pulse: 1, any: 1 }, 'random-enemy', [
        { type: 'STUN', echoes: 1, target: 'random-enemy' },
        { type: 'DAMAGE', amount: 18, target: 'random-enemy' },
      ]),
    ],
  },
  {
    id: 'kiro-pulse',
    name: 'Toji Fushiguro',
    epithet: 'Sorcerer Killer',
    faction: 'pulse',
    rarity: 'epic',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#ddd6fe',
    skills: [
      art('tap', 'Tap', '15 damage. Shreds shield (engine).', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('shatter-note', 'Shatter Note', 'All foes 10 + lose shield.', 2, { pulse: 1, strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 10, target: 'all-enemies' },
      ]),
      art('silence-bell', 'Silence Bell', 'Stun + 20.', 3, { pulse: 2 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
        { type: 'DAMAGE', amount: 20, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'senna-drift',
    name: 'Maki Zenin',
    epithet: 'Heavenly Restriction',
    faction: 'pulse',
    rarity: 'epic',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#f5d0fe',
    skills: [
      art('drift', 'Drift', 'Heal 14 and 8 shield on ally.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 14, target: 'ally' },
        { type: 'SHIELD', amount: 8, target: 'ally' },
      ]),
      art('afterimage', 'Afterimage', 'Ally veil.', 3, { pulse: 1, any: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'ally' },
      ]),
      art('return-thread', 'Return Thread', 'Heal all 12.', 2, { pulse: 2 }, 'all-allies', [
        { type: 'HEAL', amount: 12, target: 'all-allies' },
      ]),
    ],
  },
  {
    id: 'venn-hollow',
    name: 'Ryomen Sukuna',
    epithet: 'King of Curses',
    faction: 'pulse',
    rarity: 'legendary',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#6b21a8',
    skills: [
      art('threshold', 'Threshold', '12 shield all allies.', 1, { pulse: 1, blood: 1 }, 'all-allies', [
        { type: 'SHIELD', amount: 12, target: 'all-allies' },
      ]),
      art('hollow-gift', 'Hollow Gift', 'Heal 28. Cannot target self.', 2, { pulse: 2 }, 'ally', [
        { type: 'HEAL', amount: 28, target: 'ally' },
      ]),
      art('last-door', 'Last Door', 'Veil all allies. Once-feeling cooldown.', 4, { pulse: 2, blood: 1 }, 'all-allies', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'all-allies' },
      ]),
    ],
  },
  {
    id: 'kenji-orb',
    name: 'Naruto Uzumaki',
    epithet: 'Nine Tails',
    faction: 'ashen',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f97316',
    skills: [
      art('orb-rush', 'Orb Rush', '30 ember damage. Always ready.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 30, target: 'enemy' },
      ]),
      art('spiral-ember', 'Spiral Ember', 'Mark and 18 damage. Sets up the closer.', 2, { strike: 1, pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
      ]),
      art('village-vow', 'Village Vow', '46 damage. Bloodied Naruto hits even harder.', 3, { strike: 2, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 46, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'kage-bind',
    name: 'Shikamaru Nara',
    epithet: 'Shadow Bind',
    faction: 'ashen',
    rarity: 'epic',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#44403c',
    skills: [
      art('shadow-pin', 'Shadow Pin', 'Stun one foe before their strike wave.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('plan-two', 'Plan Two', 'Drain 1 Weave and 10 damage.', 2, { pulse: 1, tide: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 10, target: 'enemy' },
      ]),
      art('checkmate', 'Checkmate', '24 damage + stun. Control wins gates.', 3, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 24, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'riku-tide',
    name: 'Monkey D. Luffy',
    epithet: 'Straw Hat',
    faction: 'tide',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#ef4444',
    skills: [
      art('stretch-tide', 'Stretch Tide', '26 damage that keeps grinning.', 0, { tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
      ]),
      art('crew-call', 'Crew Call', '10 to all foes and 8 shield on Luffy.', 1, { tide: 1, any: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 10, target: 'all-enemies' },
        { type: 'SHIELD', amount: 8, target: 'self' },
      ]),
      art('king-wave', 'King Wave', '48 to one foe. The closer.', 4, { tide: 2, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 48, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'pela-kettle',
    name: 'Vinsmoke Sanji',
    epithet: 'Black Leg',
    faction: 'tide',
    rarity: 'rare',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fb923c',
    skills: [
      art('hot-plate', 'Hot Plate', 'Heal an ally 22.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 22, target: 'ally' },
      ]),
      art('feast', 'Feast', 'Heal all 12 and 6 shield.', 2, { tide: 1, pulse: 1 }, 'all-allies', [
        { type: 'HEAL', amount: 12, target: 'all-allies' },
        { type: 'SHIELD', amount: 6, target: 'all-allies' },
      ]),
      art('spice-burn', 'Spice Burn', '18 damage + burn 2.', 2, { blood: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'six-hollow',
    name: 'Satoru Gojo',
    epithet: 'Six Eyes',
    faction: 'pulse',
    rarity: 'legendary',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#e0f2fe',
    skills: [
      art('hollow-palm', 'Hollow Palm', '22 damage. Shreds shield first.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 22, target: 'enemy' },
      ]),
      art('limit-field', 'Limit Field', 'Self veil. Their hits bounce.', 3, { pulse: 1, any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'self' },
      ]),
      art('infinity-cut', 'Infinity Cut', '40 damage. Stun if you are veiled.', 3, { pulse: 2, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'cage-void',
    name: 'Yuji Itadori',
    epithet: 'Sukuna Vessel',
    faction: 'pulse',
    rarity: 'epic',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f472b6',
    skills: [
      art('pink-spark', 'Pink Spark', '20 cursed damage.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 20, target: 'enemy' },
      ]),
      art('cage-break', 'Cage Break', 'Mark + 26. Focus-fire bait.', 2, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
      ]),
      art('malevolent', 'Malevolent', '52 damage. Long cooldown.', 4, { pulse: 1, strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 52, target: 'enemy' },
      ]),
    ],
  },
];

export const FIGHTER_BY_ID: Record<string, Fighter> = Object.fromEntries(
  FIGHTERS.map((fighter) => [fighter.id, fighter])
);

/** Lead fighters shown on the first lobby rows. */
export const FEATURED_FIGHTER_IDS = [
  'kenji-orb',
  'riku-tide',
  'six-hollow',
  'kaen-roux',
  'captain-vex',
  'cage-void',
  'shiro-vale',
  'pela-kettle',
  'venn-hollow',
] as const;

export function lobbyFighters(): Fighter[] {
  const featured = FEATURED_FIGHTER_IDS.map((id) => FIGHTER_BY_ID[id]).filter(
    (fighter): fighter is Fighter => Boolean(fighter)
  );
  const rest = FIGHTERS.filter((fighter) => !FEATURED_FIGHTER_IDS.includes(fighter.id as (typeof FEATURED_FIGHTER_IDS)[number]));
  return [...featured, ...rest];
}

export function getFighter(id: string): Fighter | undefined {
  return FIGHTER_BY_ID[id];
}

export function getFighterArts(fighter: Fighter): Art[] {
  return [...fighter.skills, AEGIS_VEIL];
}

export function starterFighters(): Fighter[] {
  return FIGHTERS.filter((fighter) => fighter.unlock === 'starter');
}
