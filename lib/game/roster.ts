import type { Art, EnergyId, FactionId, FactionMeta, Fighter } from '@/types/game';

export const RULESET_VERSION = 'v1.2-na';

export function fighterPortrait(id: string): string {
  return `/game/fighters/${id}.png`;
}

/** Optional dedicated jutsu art; falls back to fighter portrait in SkillIcon. */
export function skillArtPath(fighterId: string, artId: string): string {
  return `/game/skills/${fighterId}/${artId}.png`;
}

export const TEAM_SIZE = 3;
/** Higher HP + softer chips = longer NA-style matches. */
export const FIGHTER_HP = 160;

export const FACTIONS: Record<FactionId, FactionMeta> = {
  ashen: {
    id: 'ashen',
    name: 'Naruto Shippuden',
    blurb: 'Shinobi — clones, genjutsu, and rasengan finishers.',
    color: '#fb923c',
  },
  tide: {
    id: 'tide',
    name: 'One Piece',
    blurb: 'Pirates — crew synergy, Haki grit, and Devil Fruit pressure.',
    color: '#22d3ee',
  },
  pulse: {
    id: 'pulse',
    name: 'Jujutsu Kaisen',
    blurb: 'Sorcerers — domains, cursed energy, and Black Flash timing.',
    color: '#a78bfa',
  },
  blade: {
    id: 'blade',
    name: 'Demon Slayer',
    blurb: 'Hashira & Corps — Breathing Styles, Total Concentration, and sun finishers.',
    color: '#ef4444',
  },
  flare: {
    id: 'flare',
    name: 'Dragon Ball',
    blurb: 'Saiyans & gods — ki blasts, Instant Transmission, and planet-busters.',
    color: '#f59e0b',
  },
  soul: {
    id: 'soul',
    name: 'Bleach',
    blurb: 'Shinigami & Espada — Getsuga, Bankai, kido control, and spiritual pressure.',
    color: '#38bdf8',
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
  effects: Art['effects'],
  universalOrOpts?: boolean | { universal?: boolean; persistence?: Art['persistence'] }
): Art {
  const opts =
    typeof universalOrOpts === 'boolean'
      ? { universal: universalOrOpts }
      : universalOrOpts ?? {};
  return {
    id,
    name,
    description,
    cooldown,
    energy,
    target,
    effects,
    universal: opts.universal,
    persistence: opts.persistence,
  };
}

/**
 * Kit pattern (Naruto-Arena):
 * 1) 1-cost chip — CD 0
 * 2) signature mid — CD 1–2 (stuns never spam every Echo)
 * 3) dodge/veil — usually 1 Any, CD 4 (NA invul cadence)
 * 4) finisher — **3 Weave**, CD 3–4 (bank & spike)
 * `rebalanceKit` enforces the pacing so kits stay strategic.
 */
const RAW_FIGHTERS: Fighter[] = [
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
      art('orb-rush', 'Rasengan', '1 Strike — 16 spiral damage.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('uzumaki-barrage', 'Uzumaki Barrage', 'Clone rush — 8 to all foes.', 1, { strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
      art('spiral-ember', 'Shadow Clone Feint', 'Dodge the next hit — clones take it.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('village-vow', 'Rasenshuriken', '40 damage. Bank Strike + Blood.', 4, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
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
      art('cinder-rush', 'Chidori', '1 Strike — 15 pierce (ignores DR).', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy', kind: 'pierce' },
      ]),
      art('ember-mark', 'Katon: Goukakyuu', 'Mark (+8 next) and burn seed.', 2, { blood: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 1, target: 'enemy' },
      ]),
      art('chidori-nagashi', 'Sharingan Feint', 'Dodge next hit. Read their move.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('fang-break', 'Kirin', '38 pierce. Ignores DR.', 4, { strike: 2 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy', kind: 'pierce' },
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
      art('cherry-impact', 'Cherry Blossom Impact', '1 Strike — 14 punch.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('field-wrap', 'Mystical Palm', '1 Pulse — heal ally 22.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 22, target: 'ally' },
      ]),
      art('splint-line', 'Katsuyu Aid', 'Heal all 10 + 6 shield.', 2, { pulse: 1 }, 'all-allies', [
        { type: 'HEAL', amount: 10, target: 'all-allies' },
        { type: 'SHIELD', amount: 6, target: 'all-allies' },
      ]),
      art('last-ember', 'Strength of a Hundred', 'Heal 30. Long CD.', 4, { pulse: 1, blood: 1 }, 'ally', [
        { type: 'HEAL', amount: 30, target: 'ally' },
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
      art('ash-clone', 'Lightning Blade Tap', '1 Strike — 13 damage.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('twin-step', 'Raikiri', '1 Pulse — stun one foe.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('kamui-dodge', 'Kamui Phase', 'Dodge the next hit completely.', 3, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('fold-night', 'Kamui Strike', '26 damage after you control space.', 3, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
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
      art('shadow-needle', 'Shadow Needles', '1 Pulse — 12 damage.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 12, target: 'enemy' },
      ]),
      art('shadow-pin', 'Shadow Possession', '1 Pulse — Control stun.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ], { persistence: 'control' }),
      art('plan-two', 'Shadow Strangle', 'Steal 1 Weave.', 2, { tide: 1 }, 'enemy', [
        { type: 'STEAL_WEAVE', amount: 1 },
      ]),
      art('checkmate', 'Shadow Neck Bind', '18 damage + stun. IQ win.', 3, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
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
      art('gentle-jab', 'Gentle Fist', '1 Strike — 13 tenketsu.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('root-bind', 'Gentle Fist Seal', 'Tidebind 2 Echoes.', 2, { tide: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'tidebind', echoes: 2, target: 'enemy' },
      ]),
      art('byakugan-read', 'Byakugan Read', 'Ally dodge next hit.', 3, { pulse: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'ally' },
      ]),
      art('grove-close', '64 Palms', '7 to all + drain 1 Weave.', 3, { tide: 1, pulse: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 7, target: 'all-enemies' },
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
      art('first-cut', 'Konoha Senpuu', '1 Strike — 14 kick.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('second-cut', 'Dynamic Entry', 'Mark + 16 kick. Youth!', 1, { strike: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('leaf-dodge', 'Leaf Hurricane Step', 'Dodge next hit. Youth!', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('seventh', 'Evening Elephant', '40 gate damage.', 4, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
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
      art('soft-edge', 'Fireball Feint', '1 Pulse — 11 + mark.', 0, { pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 11, target: 'enemy' },
      ]),
      art('tsukuyomi', 'Tsukuyomi', '1 Pulse — pure stun.', 3, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('vanish-line', 'Crow Substitution', 'Dodge + 6 to a random foe.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
        { type: 'DAMAGE', amount: 6, target: 'random-enemy' },
      ]),
      art('quiet-kill', 'Amaterasu', '32 affliction; burns after.', 3, { blood: 1, pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 32, target: 'enemy', kind: 'affliction' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'enemy' },
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
      art('stretch-tide', 'Gomu Gomu no Pistol', '1 Tide — 15 punch.', 0, { tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('crew-call', 'Gomu Gomu no Gatling', '7 to all + 10 DR (2 Echo).', 1, { tide: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 7, target: 'all-enemies' },
        { type: 'APPLY_STATUS', status: 'dr', echoes: 2, target: 'self', amount: 10 },
      ]),
      art('rubber-dodge', 'Gear Second Step', 'Dodge the next hit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('king-wave', 'King Kong Gun', '42 finisher. Bank Tide + Strike.', 4, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 42, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'captain-vex',
    name: 'Roronoa Zoro',
    epithet: 'Pirate Hunter',
    faction: 'tide',
    rarity: 'rare',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#155e75',
    skills: [
      art('ram', 'Onigiri', '1 Strike — 15 slash.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('dragon-twister', 'Tatsu Maki', '1 Tide — 9 slash all foes.', 0, { tide: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 9, target: 'all-enemies' },
      ]),
      art('lion-song', 'Nothing Happened', 'Dodge next hit — grit through it.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('asura-path', 'Asura: Nine Swords', '44 triple-blade finisher.', 4, { strike: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 44, target: 'enemy' },
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
      art('spice-burn', 'Diable Jambe', '1 Blood — 14 affliction + burn.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy', kind: 'affliction' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 1, target: 'enemy' },
      ]),
      art('hot-plate', 'Crew Care', '1 Pulse — heal 20.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 20, target: 'ally' },
      ]),
      art('sky-walk', 'Sky Walk', 'Dodge next hit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('hell-memories', 'Hell Memories', '28 fire kick.', 3, { blood: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 28, target: 'enemy' },
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
      art('karate-punch', 'Water Shot', '1 Tide — 15 single.', 0, { tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('spray', 'Fish-Man Karate', '1 Tide — 7 to all.', 0, { tide: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 7, target: 'all-enemies' },
      ]),
      art('undertow', 'Ocean Current', 'Tidebind one foe (cuts their Weave).', 2, { tide: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'tidebind', echoes: 2, target: 'enemy' },
      ]),
      art('reef-crash', '5000 Brick Fist', '26 + 8 self shield.', 3, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 26, target: 'enemy' },
        { type: 'SHIELD', amount: 8, target: 'self' },
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
      art('thunderbolt', 'Thunderbolt Tempo', '1 Pulse — 13 lightning.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('harbor', 'Mirage Tempo', '1 Pulse — 8 DR on ally (2 Echo).', 0, { pulse: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'dr', echoes: 2, target: 'ally', amount: 8 },
      ]),
      art('mirage-dodge', 'Mirage Dodge', 'Ally dodges next hit.', 2, { any: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'ally' },
      ]),
      art('blackout', 'Thundercloud Tempo', 'Veil an ally.', 3, { tide: 1, blood: 1 }, 'ally', [
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
      art('keel-cut', 'Dos Fleur Slap', '1 Strike — 13.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('siphon', 'Cien Fleur Grab', '1 Tide — steal 1 + 8 dmg.', 1, { tide: 1 }, 'enemy', [
        { type: 'STEAL_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 8, target: 'enemy' },
      ]),
      art('empty-hold', 'Clutch', 'Stun — flowers pin them.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('gigantes', 'Gigantesco Mano', '24 after you taxed them.', 2, { strike: 1, any: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 24, target: 'enemy' },
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
      art('salt-cut', 'Room: Scalpel', '1 Blood — 12 affliction + burn 2.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 12, target: 'enemy', kind: 'affliction' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'enemy' },
      ]),
      art('shambles', 'Shambles', '1 Tide — dodge via Room swap.', 1, { tide: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('rot-wave', 'Injection Shot', 'Burn all foes (Action DoT seed).', 2, { blood: 1 }, 'all-enemies', [
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'all-enemies' },
      ], { persistence: 'action' }),
      art('open-water', 'Gamma Knife', '28 to a burning foe.', 3, { blood: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 28, target: 'enemy' },
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
      art('hook', 'Dark Vortex', '1 Strike — 13.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('night-tax', 'Black Hole', '1 Tide — drain 1.', 1, { tide: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
      ]),
      art('quake', 'Dark Cloak', 'Dodge next hit in darkness.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('black-prize', 'Liberation', '36 if you drained this Echo.', 4, { tide: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 36, target: 'enemy' },
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
      art('hollow-palm', 'Lapse: Blue', '1 Pulse — 15. Shreds shield.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('reversal-red', 'Reversal: Red', '1 Strike — stun + 12 blast.', 1, { strike: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
        { type: 'DAMAGE', amount: 12, target: 'enemy' },
      ]),
      art('limit-field', 'Infinity', 'Veil — untouchable bounce.', 3, { pulse: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'self' },
      ]),
      art('infinity-cut', 'Hollow Purple', '36 domain erasure.', 3, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 36, target: 'enemy' },
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
      art('pink-spark', 'Divergent Fist', '1 Strike — 15.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('cage-break', 'Black Flash', 'Mark + 18.', 2, { pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
      ]),
      art('manji-dodge', 'Manji Kick Feint', 'Dodge next hit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('malevolent', 'Sukuna: Cleave', '40 finisher.', 4, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'venn-hollow',
    name: 'Ryomen Sukuna',
    epithet: 'King of Curses',
    faction: 'pulse',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#6b21a8',
    skills: [
      art('dismantle', 'Dismantle', '1 Strike — 17 slash.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 17, target: 'enemy' },
      ]),
      art('cleave', 'Cleave', '1 Pulse — mark + 14.', 1, { pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('open', 'Open', 'Stun one foe — domain pressure.', 2, { blood: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('last-door', 'Malevolent Shrine', '38 domain cut.', 4, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy' },
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
      art('sun-line', 'Cursed Speech Cut', '1 Pulse — 14 + stun.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('flare-split', 'Rika Barrage', '8 to all.', 1, { pulse: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
      art('rika-guard', 'Rika Shield', '16 self shield.', 1, { any: 1 }, 'self', [
        { type: 'SHIELD', amount: 16, target: 'self' },
      ]),
      art('zenith', 'Pure Love Beam', '38 beam.', 3, { pulse: 2 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy' },
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
      art('shift', 'Divine Dogs', '1 Pulse — 13 + 6 shield.', 0, { pulse: 1 }, 'enemy', [
        { type: 'SHIELD', amount: 6, target: 'self' },
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('nue-bolt', 'Nue', '1 Strike — 16 from above.', 1, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('rabbit-dodge', 'Rabbit Escape', 'Dodge next hit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('true-name', 'Mahoraga Slash', '34. Breaks 12 shield first.', 3, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 34, target: 'enemy' },
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
      art('spark', 'Straw Doll Nail', '1 Pulse — 14.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('chain-sky', 'Resonance', '1 Strike — 8 to all.', 1, { strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
      art('hairpin-prep', 'Hairpin Charge', 'Mark one foe.', 1, { pulse: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
      ]),
      art('cell-burst', 'Hairpin', 'Stun random + 14.', 3, { pulse: 1, any: 1 }, 'random-enemy', [
        { type: 'STUN', echoes: 1, target: 'random-enemy' },
        { type: 'DAMAGE', amount: 14, target: 'random-enemy' },
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
      art('tap', 'Inverted Spear', '1 Strike — 14. Shreds shield.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('split-soul', 'Split Soul Katana', '1 Strike — 18.', 1, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
      ]),
      art('assassin-dodge', 'Assassin Step', 'Dodge next hit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('silence-bell', 'Playful Cloud', 'Stun + 16.', 3, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
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
      art('spear-thrust', 'Playful Cloud Strike', '1 Strike — 15.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('drift', 'Combat Medic', '1 Pulse — heal 14 + 8 shield.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 14, target: 'ally' },
        { type: 'SHIELD', amount: 8, target: 'ally' },
      ]),
      art('return-thread', 'Squad Rally', 'Heal all 12.', 2, { pulse: 1 }, 'all-allies', [
        { type: 'HEAL', amount: 12, target: 'all-allies' },
      ]),
      art('afterimage', 'Split Soul Curtain', 'Ally veil.', 3, { pulse: 1, any: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'ally' },
      ]),
    ],
  },

  // ── Demon Slayer ─────────────────────────────────────────────
  {
    id: 'tanjiro-sun',
    name: 'Tanjiro Kamado',
    epithet: 'Hinokami',
    faction: 'blade',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#dc2626',
    skills: [
      art('water-slash', 'Water Surface Slash', '1 Tide — 15 water cut.', 0, { tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('hinokami', 'Hinokami Kagura', 'Mark + burn — dance of the fire god.', 2, { blood: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 1, target: 'enemy' },
      ]),
      art('total-focus', 'Total Concentration', 'Dodge next hit — steady breath.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('sun-breath', 'Clear Blue Sky', '40 sun-wheel finisher.', 4, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'nezuko-box',
    name: 'Nezuko Kamado',
    epithet: 'Exploding Blood',
    faction: 'blade',
    rarity: 'epic',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f472b6',
    skills: [
      art('kick-box', 'Bamboo Kick', '1 Strike — 14.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('blood-burst', 'Exploding Blood', 'Burn + 12 affliction.', 1, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 12, target: 'enemy', kind: 'affliction' },
        { type: 'APPLY_STATUS', status: 'burn', echoes: 2, target: 'enemy' },
      ]),
      art('grow-size', 'Demon Size', '12 self shield — grow.', 2, { any: 1 }, 'self', [
        { type: 'SHIELD', amount: 12, target: 'self' },
      ]),
      art('blood-detonate', 'Blood Burst Finale', '36 if they burn.', 4, { blood: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 36, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'zenitsu-bolt',
    name: 'Zenitsu Agatsuma',
    epithet: 'Thunder',
    faction: 'blade',
    rarity: 'rare',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#facc15',
    skills: [
      art('thunder-clap', 'Thunderclap and Flash', '1 Strike — 16.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('sleep-sparks', 'Sleeping Thunder', 'Stun — he only fights asleep.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('sixfold', 'Sixfold Flash', 'Dodge next hit at lightning speed.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('godspeed', 'Godspeed', '42 thunder pierce.', 4, { strike: 1, pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 42, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'inosuke-beast',
    name: 'Inosuke Hashibira',
    epithet: 'Beast Breathing',
    faction: 'blade',
    rarity: 'rare',
    role: 'aoe',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#86efac',
    skills: [
      art('fang-slash', 'Spatial Awareness', '1 Strike — 14 dual blades.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('beast-whirl', 'Crazy Cutting', '8 slash all foes.', 1, { strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 8, target: 'all-enemies' },
      ]),
      art('boar-head', 'Boar Headbutt', '14 self shield — stubborn.', 1, { any: 1 }, 'self', [
        { type: 'SHIELD', amount: 14, target: 'self' },
      ]),
      art('devour', 'Palindromic Slash', '34 wild finisher.', 3, { strike: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 34, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'giyu-calm',
    name: 'Giyu Tomioka',
    epithet: 'Water Hashira',
    faction: 'blade',
    rarity: 'epic',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#0ea5e9',
    skills: [
      art('water-wheel', 'Water Wheel', '1 Tide — 14.', 0, { tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('dead-calm', 'Dead Calm', 'Stun — nullify their flow.', 3, { tide: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('flowing-dance', 'Flowing Dance', 'Dodge — water steps.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('eleventh', 'Dead Calm Strike', '28 + tidebind.', 3, { tide: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 28, target: 'enemy' },
        { type: 'APPLY_STATUS', status: 'tidebind', echoes: 2, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'rengoku-flame',
    name: 'Kyojuro Rengoku',
    epithet: 'Flame Hashira',
    faction: 'blade',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#f97316',
    skills: [
      art('unknowing-fire', 'Unknowing Fire', '1 Blood — 16 flame.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('rising-scorch', 'Rising Scorching Sun', 'Mark + 14.', 1, { blood: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('set-heart', 'Set Your Heart Ablaze', 'Ally shield 16 — inspire.', 2, { any: 1 }, 'ally', [
        { type: 'SHIELD', amount: 16, target: 'ally' },
      ]),
      art('rengoku-ninth', 'Rengoku', '44 blazing pillar.', 4, { blood: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 44, target: 'enemy' },
      ]),
    ],
  },

  // ── Dragon Ball ──────────────────────────────────────────────
  {
    id: 'goku-ki',
    name: 'Son Goku',
    epithet: 'Ultra Instinct',
    faction: 'flare',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f59e0b',
    skills: [
      art('kamehameha', 'Kamehameha', '1 Strike — 16 ki wave.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('kaioken', 'Kaio-ken', 'Mark self-pressure + 14 hit.', 1, { blood: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('instant', 'Instant Transmission', 'Dodge — appear behind them.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('spirit-bomb', 'Spirit Bomb', '42 gathered energy.', 4, { strike: 1, pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 42, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'vegeta-pride',
    name: 'Vegeta',
    epithet: 'Prince of Saiyans',
    faction: 'flare',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#1d4ed8',
    skills: [
      art('galick-gun', 'Galick Gun', '1 Strike — 15.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('final-flash', 'Final Flash', 'Mark + 18 pride blast.', 2, { strike: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 18, target: 'enemy' },
      ]),
      art('royal-guard', 'Royal Guard', '16 self shield — pride.', 1, { any: 1 }, 'self', [
        { type: 'SHIELD', amount: 16, target: 'self' },
      ]),
      art('final-explosion', 'Final Explosion', '40 self-sacrifice blast.', 4, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'piccolo-namek',
    name: 'Piccolo',
    epithet: 'Namekian',
    faction: 'flare',
    rarity: 'rare',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#166534',
    skills: [
      art('special-beam', 'Special Beam Cannon', '1 Pulse — 15 pierce.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('regenerate', 'Namekian Regen', 'Heal ally 20.', 0, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 20, target: 'ally' },
      ]),
      art('stretch-dodge', 'Stretch Arms', 'Dodge — elastic reach.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('hellzone', 'Hellzone Grenade', '9 to all foes.', 3, { pulse: 1, strike: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 9, target: 'all-enemies' },
      ]),
    ],
  },
  {
    id: 'gohan-mystic',
    name: 'Son Gohan',
    epithet: 'Mystic',
    faction: 'flare',
    rarity: 'epic',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#a3e635',
    skills: [
      art('masenko', 'Masenko', '1 Pulse — 15.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('potential', 'Potential Unleashed', 'Ally heal 14 + 8 shield.', 2, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 14, target: 'ally' },
        { type: 'SHIELD', amount: 8, target: 'ally' },
      ]),
      art('hidden-power', 'Hidden Power', 'Dodge — break the limit.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('father-son', 'Father-Son Kamehameha', '40 family beam.', 4, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'frieza-empire',
    name: 'Frieza',
    epithet: 'Emperor',
    faction: 'flare',
    rarity: 'epic',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#e9d5ff',
    skills: [
      art('death-beam', 'Death Beam', '1 Blood — 14 finger laser.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('imprison', 'Imprisonment Ball', 'Stun in a death orb.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('golden-dodge', 'Golden Form Step', 'Dodge — reinvented.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('death-ball', 'Death Ball', '38 planet-killer.', 4, { blood: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'beerus-haka',
    name: 'Beerus',
    epithet: 'God of Destruction',
    faction: 'flare',
    rarity: 'legendary',
    role: 'drain',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#7c3aed',
    skills: [
      art('chop', 'God Chop', '1 Strike — 15.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('hakai', 'Hakai', 'Drain 1 Weave — erase matter.', 1, { pulse: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 10, target: 'enemy' },
      ]),
      art('ultra-instinct-god', 'Destroyer Poise', 'Veil — godly composure.', 3, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'self' },
      ]),
      art('sphere-destroy', 'Sphere of Destruction', '42 hakai orb.', 4, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 42, target: 'enemy' },
      ]),
    ],
  },

  // ── Bleach ───────────────────────────────────────────────────
  {
    id: 'ichigo-blade',
    name: 'Ichigo Kurosaki',
    epithet: 'Substitute Shinigami',
    faction: 'soul',
    rarity: 'legendary',
    role: 'striker',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#f97316',
    skills: [
      art('getsuga', 'Getsuga Tensho', '1 Strike — 16 pierce crescent.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 16, target: 'enemy', kind: 'pierce' },
      ]),
      art('bankai-rush', 'Tensa Zangetsu', 'Mark + 16 Bankai rush.', 1, { strike: 1 }, 'enemy', [
        { type: 'APPLY_STATUS', status: 'mark', echoes: 2, target: 'enemy' },
        { type: 'DAMAGE', amount: 16, target: 'enemy' },
      ]),
      art('shunpo', 'Shunpo', 'Dodge — flash step.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('mugetsu', 'Mugetsu', '44 final Getsuga.', 4, { strike: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 44, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'rukia-ice',
    name: 'Rukia Kuchiki',
    epithet: 'Sode no Shirayuki',
    faction: 'soul',
    rarity: 'rare',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#e0f2fe',
    skills: [
      art('ice-slash', 'Some no Mai', '1 Pulse — 13 ice.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('tsugi-no-mai', 'Tsugi no Mai: Hakuren', 'Stun — freeze solid.', 2, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('ice-veil', 'White Haze', 'Ally dodge — ice mist.', 2, { any: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'ally' },
      ]),
      art('san-no-mai', 'San no Mai: Shirafune', '30 ice blade.', 3, { pulse: 1, tide: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 30, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'byakuya-petal',
    name: 'Byakuya Kuchiki',
    epithet: 'Senbonzakura',
    faction: 'soul',
    rarity: 'epic',
    role: 'aoe',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fda4af',
    skills: [
      art('petal-cut', 'Senbonzakura', '1 Pulse — 14 petal blade.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 14, target: 'enemy' },
      ]),
      art('senkei', 'Senkei', '9 petal storm all foes.', 1, { pulse: 1 }, 'all-enemies', [
        { type: 'DAMAGE', amount: 9, target: 'all-enemies' },
      ]),
      art('noble-step', 'Flash Step', 'Dodge — noble speed.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('shukei', 'Shukei: Hakuteiken', '36 white imperial sword.', 4, { pulse: 1, strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 36, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'aizen-kyoka',
    name: 'Sosuke Aizen',
    epithet: 'Kyoka Suigetsu',
    faction: 'soul',
    rarity: 'legendary',
    role: 'control',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'rank',
    accent: '#854d0e',
    skills: [
      art('kido-tap', 'Hado 63', '1 Pulse — 13 kido.', 0, { pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 13, target: 'enemy' },
      ]),
      art('complete-hypnosis', 'Complete Hypnosis', 'Stun — you never saw it.', 3, { pulse: 1 }, 'enemy', [
        { type: 'STUN', echoes: 1, target: 'enemy' },
      ]),
      art('illusion-step', 'Kyoka Feint', 'Dodge — perfect illusion.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('kurohitsugi', 'Kurohitsugi', '38 black coffin.', 4, { pulse: 1, blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 38, target: 'enemy' },
      ]),
    ],
  },
  {
    id: 'orihime-shield',
    name: 'Orihime Inoue',
    epithet: 'Shun Shun Rikka',
    faction: 'soul',
    rarity: 'rare',
    role: 'support',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'starter',
    accent: '#fb7185',
    skills: [
      art('fairies-cut', 'Koten Zanshun', '1 Strike — 12 fairy blade.', 0, { strike: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 12, target: 'enemy' },
      ]),
      art('santen', 'Santen Kesshun', '18 shield on ally.', 0, { pulse: 1 }, 'ally', [
        { type: 'SHIELD', amount: 18, target: 'ally' },
      ]),
      art('soten', 'Soten Kisshun', 'Heal ally 24 — reject events.', 1, { pulse: 1 }, 'ally', [
        { type: 'HEAL', amount: 24, target: 'ally' },
      ]),
      art('shiten', 'Shiten Koshun', 'Ally veil — reject & reflect.', 3, { pulse: 1, any: 1 }, 'ally', [
        { type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'ally' },
      ]),
    ],
  },
  {
    id: 'ulquiorra-lance',
    name: 'Ulquiorra Cifer',
    epithet: 'Espada IV',
    faction: 'soul',
    rarity: 'epic',
    role: 'drain',
    hp: FIGHTER_HP,
    unlocked: true,
    unlock: 'wins',
    accent: '#134e4a',
    skills: [
      art('cero', 'Cero', '1 Blood — 15.', 0, { blood: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 15, target: 'enemy' },
      ]),
      art('luz-de-luna', 'Luz de la Luna', 'Drain 1 + 10 spear.', 1, { tide: 1 }, 'enemy', [
        { type: 'DRAIN_WEAVE', amount: 1 },
        { type: 'DAMAGE', amount: 10, target: 'enemy' },
      ]),
      art('segunda', 'Segunda Etapa', 'Dodge — bat-wing step.', 2, { any: 1 }, 'self', [
        { type: 'APPLY_STATUS', status: 'dodge', echoes: 1, target: 'self' },
      ]),
      art('lanza', 'Lanza del Relampago', '40 lightning lance.', 4, { blood: 1, pulse: 1 }, 'enemy', [
        { type: 'DAMAGE', amount: 40, target: 'enemy' },
      ]),
    ],
  },
];

function energyTotal(energy: Art['energy']): number {
  return (Object.values(energy) as number[]).reduce((sum, n) => sum + (n ?? 0), 0);
}

function primaryColor(energy: Art['energy'], fallback: EnergyId): EnergyId {
  const keys = (Object.keys(energy) as EnergyId[]).filter((key) => key !== 'any' && (energy[key] ?? 0) > 0);
  return keys[0] ?? fallback;
}

function ensureThreeChakra(energy: Art['energy'], preferred: EnergyId): Art['energy'] {
  const next: Art['energy'] = { ...energy };
  const grow = preferred === 'any' ? 'strike' : preferred;
  let total = energyTotal(next);
  while (total < 3) {
    if (total === 2) {
      next.any = (next.any ?? 0) + 1;
    } else {
      next[grow] = (next[grow] ?? 0) + 1;
    }
    total = energyTotal(next);
  }
  return next;
}

function costWords(energy: Art['energy']): string {
  const parts: string[] = [];
  (['strike', 'tide', 'pulse', 'blood', 'any'] as EnergyId[]).forEach((id) => {
    const n = energy[id] ?? 0;
    if (n <= 0) return;
    const label = ENERGY_META[id].label;
    parts.push(n === 1 ? `1 ${label}` : `${n} ${label}`);
  });
  return parts.join(' + ') || 'free';
}

function scaleDamage(amount: number, slot: number): number {
  // NA pacing on 160 HP: chip ~9, mid ~14–18, finisher ~26–30
  if (slot === 0) return Math.max(7, Math.min(11, Math.round(amount * 0.58)));
  if (slot === 3) return Math.max(22, Math.min(30, Math.round(amount * 0.68)));
  if (slot === 1) return Math.max(10, Math.min(18, Math.round(amount * 0.62)));
  return Math.max(8, Math.min(16, Math.round(amount * 0.6)));
}

function scaleHeal(amount: number, slot: number): number {
  if (slot === 3) return Math.max(18, Math.min(26, Math.round(amount * 0.72)));
  if (amount >= 20) return Math.max(14, Math.min(22, Math.round(amount * 0.7)));
  return Math.max(8, Math.min(16, Math.round(amount * 0.7)));
}

function scaleShield(amount: number): number {
  return Math.max(4, Math.min(12, Math.round(amount * 0.75)));
}

function rebalanceArt(art: Art, slot: number, faction: FactionId): Art {
  const energy = { ...art.energy };
  let cooldown = art.cooldown;
  const isDodgeOrVeil = art.effects.some(
    (effect) =>
      effect.type === 'APPLY_STATUS' && (effect.status === 'dodge' || effect.status === 'veil')
  );
  const isStun = art.effects.some((effect) => effect.type === 'STUN');
  const heal = art.effects.find((effect) => effect.type === 'HEAL');
  const bigHeal = heal && heal.type === 'HEAL' && heal.amount >= 20;
  const damage = art.effects.find((effect) => effect.type === 'DAMAGE');
  const strongHit = damage && damage.type === 'DAMAGE' && damage.amount >= 18;
  const factionColor: EnergyId =
    faction === 'tide' ? 'tide' : faction === 'pulse' || faction === 'soul' ? 'pulse' : faction === 'blade' ? 'blood' : 'strike';

  // Slot 0 chip: keep cheap & spamable.
  if (slot === 0) {
    cooldown = 0;
    if (energyTotal(energy) === 0) energy[factionColor] = 1;
  }

  // Slot 1 signature: light CD so mid tools aren't free every Echo.
  if (slot === 1) {
    if (isStun) cooldown = Math.max(cooldown, 2);
    else if (bigHeal) cooldown = Math.max(cooldown, 1);
    else if (strongHit) cooldown = Math.max(cooldown, 1);
    else cooldown = Math.max(cooldown, 1);
  }

  // Defense / dodge / veil — NA invul is typically CD 4.
  if (isDodgeOrVeil) {
    cooldown = Math.max(cooldown, 4);
    if (energyTotal(energy) < 1) energy.any = 1;
  } else if (slot === 2 && isStun) {
    cooldown = Math.max(cooldown, 2);
  }

  // Finishers: 3 chakra + multi-Echo lockout (can't fire two turns in a row).
  if (slot === 3) {
    cooldown = Math.max(cooldown, 3);
    const preferred = primaryColor(energy, factionColor);
    Object.assign(energy, ensureThreeChakra(energy, preferred));
  }

  // Hard floor: any stun art CD ≥ 2 (no stun every Echo).
  if (isStun) cooldown = Math.max(cooldown, 2);
  // Big single heals can't be free every turn.
  if (bigHeal) cooldown = Math.max(cooldown, slot === 0 ? 0 : 1);

  const effects = art.effects.map((effect) => {
    if (effect.type === 'DAMAGE') {
      return { ...effect, amount: scaleDamage(effect.amount, slot) };
    }
    if (effect.type === 'HEAL') {
      return { ...effect, amount: scaleHeal(effect.amount, slot) };
    }
    if (effect.type === 'SHIELD') {
      return { ...effect, amount: scaleShield(effect.amount) };
    }
    return effect;
  });

  const dmgLine = effects.find((e) => e.type === 'DAMAGE');
  const healLine = effects.find((e) => e.type === 'HEAL');
  let description = art.description;
  if (dmgLine && dmgLine.type === 'DAMAGE') {
    description = description.replace(/\b\d+\s*(?:pierce\s+)?damage/i, `${dmgLine.amount} damage`);
  }
  if (healLine && healLine.type === 'HEAL') {
    description = description.replace(/heal(?:s| ally)?\s*\d+/i, (m) =>
      m.replace(/\d+/, String(healLine.amount))
    );
  }

  if (slot === 3) {
    description = `${description.replace(/\.\s*$/, '')} · ${costWords(energy)} · CD ${cooldown}.`;
  } else if (isDodgeOrVeil && cooldown >= 4) {
    description = `${description.replace(/\.\s*$/, '')} · CD ${cooldown} (no chain).`;
  }

  return {
    ...art,
    energy,
    cooldown,
    effects,
    description: description.trim(),
  };
}

function rebalanceFighter(fighter: Fighter): Fighter {
  const skills = fighter.skills.map((skill, slot) => rebalanceArt(skill, slot, fighter.faction)) as Fighter['skills'];
  return { ...fighter, hp: FIGHTER_HP, skills };
}

/** Balanced NA-style kits (3-cost finishers, CD locks on defense/stun). */
export const FIGHTERS: Fighter[] = RAW_FIGHTERS.map(rebalanceFighter);

export const FIGHTER_BY_ID: Record<string, Fighter> = Object.fromEntries(
  FIGHTERS.map((fighter) => [fighter.id, fighter])
);

export const FEATURED_FIGHTER_IDS = [
  'kenji-orb',
  'goku-ki',
  'tanjiro-sun',
  'ichigo-blade',
  'riku-tide',
  'six-hollow',
  'rengoku-flame',
  'vegeta-pride',
  'aizen-kyoka',
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
  return [...fighter.skills];
}

export function findGuardArt(fighter: Fighter): Art | undefined {
  return fighter.skills.find(
    (skill) =>
      skill.universal ||
      skill.id === 'aegis-veil' ||
      skill.effects.some(
        (effect) =>
          effect.type === 'APPLY_STATUS' &&
          (effect.status === 'veil' || effect.status === 'dodge') &&
          (effect.target === 'self' || skill.target === 'self')
      )
  );
}

export function starterFighters(): Fighter[] {
  return FIGHTERS.filter((fighter) => fighter.unlock === 'starter');
}
