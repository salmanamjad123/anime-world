import type { Fighter, TeamValidation } from '@/types/game';
import {
  BLOODIED_HP,
  WEAVE_CAP,
  type MatchState,
  type SideId,
  otherSide,
} from '@/lib/game/engine';
import { getFighter } from '@/lib/game/roster';

export function lobbyStrategyTips(fighters: Fighter[], validation: TeamValidation): string[] {
  const tips: string[] = [];
  const roles = new Set(fighters.map((fighter) => fighter.role));

  if (validation.resonance === 'none' && fighters.length === 3) {
    tips.push('Pair two of one faction for +5 damage, run three for Trinity shred, or split all three for Chaos Weave.');
  }
  if (validation.resonance === 'pair') {
    tips.push('Queue two arts from the shared faction in one Echo for a combo (+6) on top of pair resonance.');
  }
  if (validation.resonance === 'trinity') {
    tips.push('Trinity: first damaging art shreds 10 shield. Open with a closer, then focus-fire.');
  }
  if (validation.resonance === 'chaos') {
    tips.push('Chaos Pulse banks +1 Any each Echo — mix stun, heal, and a closer so the extra pip always spends.');
  }
  if (!validation.weaveCoverageOk) {
    tips.push('Cover Strike, Tide, and Pulse. A two-color team gets bricked when the bank rolls the missing pip.');
  }
  if (!roles.has('support') && !roles.has('tank') && fighters.length === 3) {
    tips.push('No hull or healer — you win fast or you leak. Bring Aegis for the bloodied Echo.');
  }
  if (!roles.has('striker') && !roles.has('aoe') && fighters.length === 3) {
    tips.push('You lack a closer. Seal kills need a striker or an AoE finisher.');
  }
  if (!roles.has('control') && fighters.length === 3) {
    tips.push('Stun and drain win Echo Lock. A control fighter can cancel their strike wave.');
  }
  if (tips.length === 0) {
    tips.push('Focus-fire one seal. Stun before damage. Do not dump into Aegis — veil counters for 10.');
  }
  return tips.slice(0, 3);
}

export function battleStrategyTip(match: MatchState, sideId: SideId): string {
  const mine = match.sides[sideId];
  const theirs = match.sides[otherSide(sideId)];
  const myLiving = mine.fighterIds.filter((id) => mine.units[id].hp > 0);
  const theirLiving = theirs.fighterIds.filter((id) => theirs.units[id].hp > 0);
  const bloodiedAlly = myLiving.find((id) => mine.units[id].hp <= BLOODIED_HP);
  const bloodiedFoe = theirLiving.find((id) => theirs.units[id].hp <= BLOODIED_HP);
  const veiledFoe = theirLiving.find((id) => theirs.units[id].veil > 0);
  const stunnedFoe = theirLiving.find((id) => theirs.units[id].stun > 0);

  if (veiledFoe) {
    return `${getFighter(veiledFoe)?.name ?? 'A foe'} is veiled — skip them or eat 10 counter. Heal or drain instead.`;
  }
  if (bloodiedFoe) {
    return `${getFighter(bloodiedFoe)?.name ?? 'A foe'} is bloodied. Two hits this Echo get focus-fire (+8) — finish the seal.`;
  }
  if (bloodiedAlly) {
    return `${getFighter(bloodiedAlly)?.name ?? 'Your fighter'} is bloodied (+20% damage) but fragile. Aegis or a heal now.`;
  }
  if (mine.weave.length >= WEAVE_CAP) {
    return `Weave is capped at ${WEAVE_CAP}. Spend or the next grant is wasted.`;
  }
  if (stunnedFoe) {
    return 'They are stunned from last Echo — their queue will fizzle. Dump damage.';
  }
  if (mine.queue.length === 1) {
    return 'One art is a telegraph. Queue a stun plus a hit, or two hits on the same seal.';
  }
  if (match.echo >= match.maxEcho - 1) {
    return 'Last Echoes: higher total HP wins if nobody is sealed. Chip the healthiest foe.';
  }
  return 'Control resolves first. Stun or veil, then strike. Focus one fighter — split damage loses gates.';
}
