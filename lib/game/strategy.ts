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

  tips.push(
    'Ash Rule + living Weave: first side opens with 1, second with 3; later 1 pip per living ally. Bank for 3-cost finishers (CD 3–4).'
  );
  tips.push('Dodge/veil is CD 4 — spend it to survive a spike, not every Echo. Stuns need 2+ Echoes before reuse.');

  if (validation.resonance === 'none' && fighters.length === 3) {
    tips.push('Pair two of one faction for +5 damage, run three for Trinity shred, or split all three for Chaos Weave.');
  }
  if (validation.resonance === 'pair') {
    tips.push('Queue two arts from the shared faction in one turn for a combo (+6) on top of pair resonance.');
  }
  if (validation.resonance === 'trinity') {
    tips.push('Trinity: first damaging art shreds 10 shield. Mark → stun → closer.');
  }
  if (validation.resonance === 'chaos') {
    tips.push('Chaos Pulse banks +1 Any each Echo — mix stun, heal, and a closer so the extra pip always spends.');
  }
  if (!validation.weaveCoverageOk) {
    tips.push('Cover Strike, Tide, and Pulse. A two-color team bricks when the bank rolls the missing color.');
  }
  if (!roles.has('support') && !roles.has('tank') && fighters.length === 3) {
    tips.push('No healer or tank — burst fast or lose the long game. Bring Guard when bloodied.');
  }
  if (!roles.has('striker') && !roles.has('aoe') && fighters.length === 3) {
    tips.push('You lack a closer. Seal kills need a striker or AoE pressure.');
  }
  if (!roles.has('control') && !roles.has('drain') && fighters.length === 3) {
    tips.push('Add stun or drain — denying their Weave beats trading chip damage.');
  }
  if (roles.has('support') && roles.has('striker')) {
    tips.push('Heal under 50% HP; otherwise set up mark/stun and spend the turn sealing.');
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
  const granted = match.lastGranted?.[sideId] ?? [];

  if (veiledFoe) {
    return `${getFighter(veiledFoe)?.name ?? 'A foe'} is veiled — skip them or eat 10 counter. Heal, drain, or aim elsewhere.`;
  }
  const dodgingFoe = theirLiving.find((id) => (theirs.units[id].dodge ?? 0) > 0);
  if (dodgingFoe) {
    return `${getFighter(dodgingFoe)?.name ?? 'A foe'} will dodge the next hit — bait it or attack someone else.`;
  }
  if (bloodiedFoe) {
    return `${getFighter(bloodiedFoe)?.name ?? 'A foe'} is bloodied. Focus-fire (+8 on second hit) — finish the seal.`;
  }
  if (bloodiedAlly) {
    return `${getFighter(bloodiedAlly)?.name ?? 'Your fighter'} is bloodied (+20% damage) but fragile. Heal or Guard now.`;
  }
  if (mine.weave.length >= 5 && mine.weave.length < 8) {
    return 'Banking for a 3-cost spike? Hold one more Echo — or Exchange 5→1 if colors are wrong.';
  }
  if (mine.weave.length >= WEAVE_CAP) {
    return `Jutsu bank is full (${WEAVE_CAP}). Spend — unused energy stays, but new grants won't fit.`;
  }
  if (mine.weave.length >= 5) {
    return 'Wrong colors? Exchange 5 Weave for 1 Strike, Tide, Pulse, or Blood from the bank header.';
  }
  if (stunnedFoe) {
    return 'They are stunned — their next arts can fizzle. Dump damage on that seal.';
  }
  if (granted.length && mine.weave.length < 3) {
    return 'Thin bank — chip or pass pressure; save for a 3-Weave finisher next Echo.';
  }
  if (mine.queue.length === 1 && myLiving.length > 1) {
    return 'One fighter queued — each ally can still add 1 jutsu before you Attack.';
  }
  if (match.echo >= match.maxEcho - 1) {
    return 'Last Echoes: higher total HP wins if nobody is sealed. Chip the healthiest foe.';
  }
  return 'Bank → dodge on CD 4 → 3-cost spike. Stun/control first, then finish a seal.';
}
