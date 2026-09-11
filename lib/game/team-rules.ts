import type { EnergyId, Fighter, ResonanceKind, TeamValidation } from '@/types/game';
import { TEAM_SIZE } from '@/lib/game/roster';

const WEAVE_COLORS: EnergyId[] = ['strike', 'tide', 'pulse', 'blood'];

export function collectWeaveColors(fighters: Fighter[]): EnergyId[] {
  const used = new Set<EnergyId>();
  for (const fighter of fighters) {
    for (const skill of fighter.skills) {
      for (const key of Object.keys(skill.energy) as EnergyId[]) {
        if (key !== 'any') used.add(key);
      }
    }
  }
  return WEAVE_COLORS.filter((color) => used.has(color));
}

export function getResonance(fighters: Fighter[]): ResonanceKind {
  if (fighters.length < 2) return 'none';
  const counts = fighters.reduce<Record<string, number>>((acc, fighter) => {
    acc[fighter.faction] = (acc[fighter.faction] ?? 0) + 1;
    return acc;
  }, {});
  const values = Object.values(counts);
  if (values.includes(3)) return 'trinity';
  if (fighters.length === TEAM_SIZE && values.length === 3) return 'chaos';
  if (values.some((count) => count >= 2)) return 'pair';
  return 'none';
}

export function validateTeam(fighters: Fighter[]): TeamValidation {
  const uniqueIds = new Set(fighters.map((fighter) => fighter.id));
  const lockedPicks = fighters.filter((fighter) => !fighter.unlocked).map((fighter) => fighter.id);
  const weaveColors = collectWeaveColors(fighters);
  const reasons: string[] = [];

  if (fighters.length < TEAM_SIZE) {
    reasons.push(`Pick ${TEAM_SIZE - fighters.length} more fighter${TEAM_SIZE - fighters.length === 1 ? '' : 's'}.`);
  }
  if (uniqueIds.size !== fighters.length) {
    reasons.push('A fighter can only be on the team once.');
  }
  if (lockedPicks.length > 0) {
    reasons.push('Remove locked fighters before you queue.');
  }
  if (fighters.length === TEAM_SIZE && weaveColors.length < 3) {
    reasons.push('This team spends fewer than 3 Weave colors — RNG can brick you.');
  }

  const ready =
    fighters.length === TEAM_SIZE &&
    uniqueIds.size === TEAM_SIZE &&
    lockedPicks.length === 0;

  return {
    ready,
    unique: uniqueIds.size === fighters.length,
    size: fighters.length,
    missing: Math.max(0, TEAM_SIZE - fighters.length),
    weaveColors,
    weaveCoverageOk: weaveColors.length >= 3 || fighters.length < TEAM_SIZE,
    resonance: getResonance(fighters),
    lockedPicks,
    reasons,
  };
}

export function pickShadeTeam(playerIds: string[], roster: Fighter[]): Fighter[] {
  const pool = roster.filter((fighter) => fighter.unlocked && !playerIds.includes(fighter.id));
  const source = pool.length >= TEAM_SIZE ? pool : roster.filter((fighter) => !playerIds.includes(fighter.id));
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, TEAM_SIZE);
}
