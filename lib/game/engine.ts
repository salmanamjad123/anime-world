import type { Art, DamageKind, Effect, EnergyId, TargetKind } from '@/types/game';
import { ENERGY_META, findGuardArt, getFighter, getFighterArts, TEAM_SIZE } from '@/lib/game/roster';
import { getResonance } from '@/lib/game/team-rules';

export type SideId = 'player' | 'foe';

export type QueuedArt = {
  fighterId: string;
  artId: string;
  targetId: string | null;
};

/** Multi-echo Action/Control channel (NA-style persistence). */
export type Channel = {
  id: string;
  persistence: 'action' | 'control';
  sourceSide: SideId;
  sourceId: string;
  targetSide: SideId;
  targetId: string;
  amount: number;
  kind: DamageKind;
  remaining: number;
  label: string;
};

export type UnitState = {
  id: string;
  hp: number;
  maxHp: number;
  shield: number;
  cooldowns: Record<string, number>;
  stun: number;
  veil: number;
  /** Next damaging hit is fully avoided, then dodge is consumed. */
  dodge: number;
  mark: number;
  burn: number;
  tidebind: number;
  /** Remaining Echoes of flat damage reduction. */
  dr: number;
  /** Flat damage reduction while `dr` > 0. */
  drAmount: number;
};

export type SideState = {
  fighterIds: string[];
  units: Record<string, UnitState>;
  weave: EnergyId[];
  queue: QueuedArt[];
  locked: boolean;
  drainedThisEcho: boolean;
};

export type CombatKind = 'attack' | 'hit' | 'heal' | 'shield' | 'stun' | 'seal' | 'veil' | 'drain' | 'block' | 'dodge';

export type CombatEvent = {
  kind: CombatKind;
  sourceSide: SideId;
  targetSide?: SideId;
  fighterId?: string;
  amount?: number;
};

export type MatchState = {
  echo: number;
  maxEcho: number;
  phase: 'pick' | 'ended';
  /** Whose turn it is — actions resolve one side at a time. */
  activeSide: SideId;
  secondsLeft: number;
  /**
   * Absolute ms deadline for the active turn. Both clients derive the
   * countdown from this so the waiting player’s timer stays live.
   */
  turnDeadlineAt: number;
  /**
   * Monotonic revision bumped on every accepted room write. Used for
   * optimistic concurrency so stale queue writes cannot rewind a commit.
   */
  matchRev: number;
  sides: Record<SideId, SideState>;
  log: string[];
  winner: SideId | 'draw' | null;
  seed: number;
  lastCasterId: string | null;
  combatEvents: CombatEvent[];
  endReason: 'seal' | 'echo-cap' | 'surrender' | 'draw' | null;
  /** Last Weave pips granted this Echo (for UI: bank and wait). */
  lastGranted: Record<SideId, EnergyId[]>;
  /** Action / Control damage channels. */
  channels: Channel[];
};

/** Stamp a fresh turn clock (secondsLeft + absolute deadline). */
export function stampTurnClock(state: MatchState, seconds = ECHO_SECONDS): void {
  state.secondsLeft = seconds;
  state.turnDeadlineAt = Date.now() + seconds * 1000;
}

/** Seconds remaining from turnDeadlineAt (preferred) or secondsLeft fallback. */
export function secondsRemaining(state: MatchState, now = Date.now()): number {
  if (state.turnDeadlineAt && state.turnDeadlineAt > 0) {
    return Math.max(0, Math.ceil((state.turnDeadlineAt - now) / 1000));
  }
  return Math.max(0, state.secondsLeft);
}

export const ECHO_SECONDS = 60;
export const MAX_ECHO = 12;
/** Max banked Weave. Unused pips never expire — only spend or refuse new grants when full. */
export const WEAVE_CAP = 10;
/** ~30% of FIGHTER_HP (160) — bloodied is late-game, not mid-chip. */
export const BLOODIED_HP = 48;
export const VEIL_COUNTER = 8;
export const COMBO_BONUS = 3;
export const FOCUS_BONUS = 4;
export const TRINITY_SHRED = 8;
/** Trade this many banked pips for 1 chosen color (Naruto-Arena exchange). */
export const WEAVE_EXCHANGE_COST = 5;
const COLORED: EnergyId[] = ['strike', 'tide', 'pulse', 'blood'];

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeUnit(id: string): UnitState {
  const fighter = getFighter(id);
  const hp = fighter?.hp ?? 100;
  return {
    id,
    hp,
    maxHp: hp,
    shield: 0,
    cooldowns: {},
    stun: 0,
    veil: 0,
    dodge: 0,
    mark: 0,
    burn: 0,
    tidebind: 0,
    dr: 0,
    drAmount: 0,
  };
}

function livingIds(side: SideState): string[] {
  return side.fighterIds.filter((id) => side.units[id]?.hp > 0);
}

export function otherSide(side: SideId): SideId {
  return side === 'player' ? 'foe' : 'player';
}

export function artById(fighterId: string, artId: string): Art | undefined {
  const fighter = getFighter(fighterId);
  if (!fighter) return undefined;
  return getFighterArts(fighter).find((item) => item.id === artId);
}

export function needsExplicitTarget(target: TargetKind): boolean {
  return target === 'enemy' || target === 'ally';
}

/** Always prefer a mixed draw (Naruto-Arena style chakra spread). */
function grantPips(count: number, rng: () => number, extraAny: boolean): EnergyId[] {
  const pips: EnergyId[] = [];
  for (let i = 0; i < count; i += 1) {
    let pick = COLORED[Math.floor(rng() * COLORED.length)] ?? 'strike';
    if (i > 0 && pips[i - 1] === pick) {
      const others = COLORED.filter((color) => color !== pick);
      pick = others[Math.floor(rng() * others.length)] ?? pick;
    }
    pips.push(pick);
  }
  if (extraAny) pips.push('any');
  return pips;
}

function payCost(weave: EnergyId[], cost: Art['energy']): EnergyId[] | null {
  const next = [...weave];
  const spend = (energy: EnergyId, amount: number) => {
    for (let i = 0; i < amount; i += 1) {
      const exact = next.findIndex((pip) => pip === energy);
      if (exact >= 0) {
        next.splice(exact, 1);
        continue;
      }
      if (energy !== 'any') {
        const wild = next.findIndex((pip) => pip === 'any');
        if (wild >= 0) {
          next.splice(wild, 1);
          continue;
        }
      }
      const anyColored = next.findIndex((pip) => pip !== 'any');
      if (energy === 'any' && anyColored >= 0) {
        next.splice(anyColored, 1);
        continue;
      }
      return false;
    }
    return true;
  };

  for (const [energy, amount] of Object.entries(cost) as [EnergyId, number][]) {
    if (!amount) continue;
    if (!spend(energy, amount)) return null;
  }
  return next;
}

export function canAfford(weave: EnergyId[], cost: Art['energy']): boolean {
  return payCost(weave, cost) !== null;
}

export function createMatch(playerIds: string[], foeIds: string[], seed = Date.now()): MatchState {
  if (playerIds.length !== TEAM_SIZE || foeIds.length !== TEAM_SIZE) {
    throw new Error('Both sides need 3 fighters.');
  }

  const rng = mulberry32(seed);
  const makeSide = (ids: string[]): SideState => ({
    fighterIds: ids,
    units: Object.fromEntries(ids.map((id) => [id, makeUnit(id)])),
    weave: [],
    queue: [],
    locked: false,
    drainedThisEcho: false,
  });

  const state: MatchState = {
    echo: 1,
    maxEcho: MAX_ECHO,
    phase: 'pick',
    activeSide: 'player',
    secondsLeft: ECHO_SECONDS,
    turnDeadlineAt: Date.now() + ECHO_SECONDS * 1000,
    matchRev: 0,
    sides: {
      player: makeSide(playerIds),
      foe: makeSide(foeIds),
    },
    log: [
      'Echo 1 — Ash Rule: first side gets 1 Weave, second gets 3. Bank for 3-cost finishers. 60s per turn.',
    ],
    winner: null,
    seed,
    lastCasterId: playerIds[0] ?? null,
    combatEvents: [],
    endReason: null,
    lastGranted: { player: [], foe: [] },
    channels: [],
  };

  fillWeave(state, rng);
  return state;
}

function fillWeave(state: MatchState, rng: () => number) {
  (['player', 'foe'] as SideId[]).forEach((sideId) => {
    const side = state.sides[sideId];
    const alive = livingIds(side).length;
    const bound = livingIds(side).filter((id) => side.units[id].tidebind > 0).length;
    const fighters = livingIds(side).map((id) => getFighter(id)!).filter(Boolean);
    const chaos = getResonance(fighters) === 'chaos';
    const room = Math.max(0, WEAVE_CAP - side.weave.length);
    // Naruto-Arena Ash Rule: first actor Echo 1 = 1; second actor Echo 1 = 3.
    // Later Echoes: 1 random pip per living ally.
    let grant: number;
    if (state.echo <= 1) {
      grant = sideId === 'player' ? 1 : 3;
    } else {
      grant = alive;
    }
    grant = Math.min(grant, room);
    if (bound > 0 && grant > 0 && state.echo > 1) {
      grant = Math.max(1, grant - Math.min(bound, 1));
    }
    if (grant === 0) {
      state.lastGranted[sideId] = [];
      side.drainedThisEcho = false;
      return;
    }
    const wantChaos = chaos && room > grant;
    const granted = grantPips(grant, rng, wantChaos).slice(0, room);
    state.lastGranted[sideId] = granted;
    side.weave = [...side.weave, ...granted];
    side.drainedThisEcho = false;
  });
}

function isControlEffect(effect: Effect): boolean {
  return (
    effect.type === 'STUN' ||
    effect.type === 'DRAIN_WEAVE' ||
    effect.type === 'STEAL_WEAVE' ||
    effect.type === 'APPLY_STATUS'
  );
}

function factionCombo(side: SideState): boolean {
  const counts: Record<string, number> = {};
  for (const item of side.queue) {
    if (item.artId === 'aegis-veil') continue;
    const fighter = getFighter(item.fighterId);
    if (!fighter) continue;
    counts[fighter.faction] = (counts[fighter.faction] ?? 0) + 1;
  }
  return Object.values(counts).some((count) => count >= 2);
}

export function lockSide(state: MatchState, sideId: SideId): MatchState {
  const next = clone(state);
  next.sides[sideId].locked = true;
  return next;
}

export function bothLocked(state: MatchState): boolean {
  return state.sides.player.locked && state.sides.foe.locked;
}

export function autoAegisIfEmpty(state: MatchState, sideId: SideId): MatchState {
  const next = clone(state);
  const side = next.sides[sideId];
  if (side.queue.length > 0) return next;
  for (const id of livingIds(side)) {
    if (side.units[id].stun > 0) continue;
    const fighter = getFighter(id);
    if (!fighter) continue;
    const guard = findGuardArt(fighter);
    if (!guard) continue;
    const targetId = needsExplicitTarget(guard.target) ? id : guard.target === 'self' ? id : id;
    if (!queueError(next, sideId, id, guard.id, guard.target === 'self' || guard.target === 'ally' ? id : null)) {
      side.queue.push({
        fighterId: id,
        artId: guard.id,
        targetId: guard.target === 'enemy' ? null : targetId,
      });
      break;
    }
  }
  // If nobody can guard, queue the cheapest ready chip attack on lowest foe.
  if (side.queue.length === 0) {
    const foeIds = livingIds(next.sides[otherSide(sideId)]);
    const lowest = [...foeIds].sort(
      (a, b) => next.sides[otherSide(sideId)].units[a].hp - next.sides[otherSide(sideId)].units[b].hp
    )[0];
    for (const id of livingIds(side)) {
      const fighter = getFighter(id);
      if (!fighter || side.units[id].stun > 0) continue;
      const chip = getFighterArts(fighter).find((skill) => skill.effects.some((effect) => effect.type === 'DAMAGE'));
      if (!chip) continue;
      const targetId = chip.target === 'enemy' ? lowest ?? null : chip.target === 'self' ? id : null;
      const aim = needsExplicitTarget(chip.target) ? targetId : chip.target === 'self' ? id : null;
      if (queueError(next, sideId, id, chip.id, needsExplicitTarget(chip.target) ? targetId : null)) continue;
      side.queue.push({ fighterId: id, artId: chip.id, targetId: aim });
      break;
    }
  }
  return next;
}

export function queueError(
  state: MatchState,
  sideId: SideId,
  fighterId: string,
  artId: string,
  targetId: string | null
): string | null {
  if (state.phase !== 'pick' || state.winner) return 'The match is over.';
  if ((state.activeSide ?? 'player') !== sideId) return "Not your turn.";
  const side = state.sides[sideId];
  if (side.locked) return 'You already locked this turn.';
  const unit = side.units[fighterId];
  if (!unit || unit.hp <= 0) return 'That fighter is sealed.';
  if (unit.stun > 0) return 'Stunned — they cannot act.';
  if ((unit.cooldowns[artId] ?? 0) > 0) return `On cooldown (${unit.cooldowns[artId]}).`;
  if (side.queue.some((item) => item.fighterId === fighterId && item.artId === artId)) {
    return 'Already queued.';
  }
  if (side.queue.some((item) => item.fighterId === fighterId)) {
    return 'Each fighter can use only 1 jutsu per Echo.';
  }
  const art = artById(fighterId, artId);
  if (!art) return 'Unknown art.';
  if (!canAfford(remainingWeaveAfterQueue(side), art.energy)) return 'Not enough Weave.';
  if (needsExplicitTarget(art.target) && !targetId) return 'Pick a target.';
  if (targetId) {
    const legal = legalTargets(state, sideId, fighterId, art).some((unitState) => unitState.id === targetId);
    if (!legal) {
      if (art.target === 'enemy') return 'Attacks hit the enemy team (right side) only.';
      if (art.target === 'ally') return 'Heals and buffs hit your team (left side) only.';
      return 'Illegal target.';
    }
  }
  return null;
}

/** Trade WEAVE_EXCHANGE_COST banked pips for 1 chosen color (Naruto-Arena exchange). */
export function exchangeWeave(
  state: MatchState,
  sideId: SideId,
  want: EnergyId
): MatchState {
  const next = clone(state);
  if ((next.activeSide ?? 'player') !== sideId) {
    next.log = [...next.log.slice(-8), "Not your turn."];
    return next;
  }
  if (!COLORED.includes(want) && want !== 'any') {
    next.log = [...next.log.slice(-8), 'Pick Strike, Tide, Pulse, or Blood.'];
    return next;
  }
  const side = next.sides[sideId];
  if (side.locked) {
    next.log = [...next.log.slice(-8), 'Already locked.'];
    return next;
  }
  if (side.weave.length < WEAVE_EXCHANGE_COST) {
    next.log = [...next.log.slice(-8), `Need ${WEAVE_EXCHANGE_COST} Weave to exchange.`];
    return next;
  }
  const color = want === 'any' ? 'strike' : want;
  side.weave = side.weave.slice(WEAVE_EXCHANGE_COST);
  side.weave.push(color);
  next.log = [...next.log.slice(-8), `Exchanged ${WEAVE_EXCHANGE_COST} → 1 ${ENERGY_META[color]?.label ?? color}.`];
  return next;
}

export function remainingWeaveAfterQueue(side: SideState): EnergyId[] {
  let weave = [...side.weave];
  for (const item of side.queue) {
    const art = artById(item.fighterId, item.artId);
    if (!art) continue;
    const paid = payCost(weave, art.energy);
    if (!paid) return [];
    weave = paid;
  }
  return weave;
}

export function legalTargets(
  state: MatchState,
  sideId: SideId,
  fighterId: string,
  art: Art
): UnitState[] {
  const selfSide = state.sides[sideId];
  const enemySide = state.sides[otherSide(sideId)];
  const allies = livingIds(selfSide).map((id) => selfSide.units[id]);
  const foes = livingIds(enemySide).map((id) => enemySide.units[id]);
  if (art.target === 'self') return [selfSide.units[fighterId]].filter((unit) => unit.hp > 0);
  if (art.target === 'ally' || art.target === 'all-allies') {
    if (art.id === 'hollow-gift') return allies.filter((unit) => unit.id !== fighterId);
    return allies;
  }
  if (art.target === 'enemy' || art.target === 'all-enemies' || art.target === 'random-enemy') return foes;
  return [];
}

export function queueArt(
  state: MatchState,
  sideId: SideId,
  fighterId: string,
  artId: string,
  targetId: string | null
): MatchState {
  const next = clone(state);
  const error = queueError(next, sideId, fighterId, artId, targetId);
  if (error) {
    next.log = [...next.log.slice(-8), error];
    return next;
  }
  next.sides[sideId].queue.push({ fighterId, artId, targetId });
  next.lastCasterId = fighterId;
  return next;
}

export function unqueueArt(state: MatchState, sideId: SideId, fighterId: string, artId: string): MatchState {
  const next = clone(state);
  if (next.sides[sideId].locked) return next;
  next.sides[sideId].queue = next.sides[sideId].queue.filter(
    (item) => !(item.fighterId === fighterId && item.artId === artId)
  );
  return next;
}

export function pickBotQueue(state: MatchState, rng: () => number): MatchState {
  const next = clone(state);
  const side = next.sides.foe;
  side.queue = [];
  const foes = livingIds(next.sides.player);
  const lowest = [...foes].sort((a, b) => next.sides.player.units[a].hp - next.sides.player.units[b].hp)[0] ?? null;
  const bloodiedSelf = livingIds(side).find((id) => side.units[id].hp <= BLOODIED_HP) ?? null;

  if (bloodiedSelf) {
    const fighter = getFighter(bloodiedSelf);
    const guard = fighter ? findGuardArt(fighter) : undefined;
    if (guard && !queueError(next, 'foe', bloodiedSelf, guard.id, bloodiedSelf)) {
      side.queue.push({ fighterId: bloodiedSelf, artId: guard.id, targetId: bloodiedSelf });
    }
  }

  for (const fighterId of livingIds(side)) {
    if (side.queue.length >= 3) break;
    const unit = side.units[fighterId];
    if (unit.stun > 0) continue;
    const fighter = getFighter(fighterId);
    if (!fighter) continue;
    const arts = getFighterArts(fighter).filter((art) => (unit.cooldowns[art.id] ?? 0) === 0);
    arts.sort((a, b) => {
      const control = Number(b.effects.some(isControlEffect)) - Number(a.effects.some(isControlEffect));
      if (control !== 0 && rng() > 0.35) return control;
      return damageHint(b) - damageHint(a);
    });
    for (const art of arts) {
      if (side.queue.some((item) => item.fighterId === fighterId && item.artId === art.id)) continue;
      if (queueError(next, 'foe', fighterId, art.id, needsExplicitTarget(art.target) ? lowest : null)) continue;
      let targetId: string | null = null;
      if (art.target === 'enemy') targetId = lowest;
      if (art.target === 'ally') {
        targetId = bloodiedSelf ?? livingIds(side)[0] ?? fighterId;
      }
      if (art.target === 'self') targetId = fighterId;
      side.queue.push({ fighterId, artId: art.id, targetId });
      break; // Naruto-Arena: one jutsu per fighter per Echo
    }
  }

  if (side.queue.length === 0 && livingIds(side)[0]) {
    const id = livingIds(side)[0]!;
    const fighter = getFighter(id);
    const chip = fighter?.skills.find((skill) => skill.effects.some((effect) => effect.type === 'DAMAGE'));
    if (chip && !queueError(next, 'foe', id, chip.id, chip.target === 'enemy' ? lowest : id)) {
      side.queue.push({
        fighterId: id,
        artId: chip.id,
        targetId: chip.target === 'enemy' ? lowest : id,
      });
    }
  }

  return next;
}

function damageHint(art: Art): number {
  return art.effects.reduce((sum, effect) => (effect.type === 'DAMAGE' ? sum + effect.amount : sum), 0);
}

function resolveTargets(
  state: MatchState,
  sideId: SideId,
  fighterId: string,
  art: Art,
  queuedTarget: string | null,
  rng: () => number
): string[] {
  const options = legalTargets(state, sideId, fighterId, art).map((unit) => unit.id);
  if (art.target === 'all-enemies' || art.target === 'all-allies') return options;
  if (art.target === 'random-enemy') {
    if (!options.length) return [];
    return [options[Math.floor(rng() * options.length)]!];
  }
  if (queuedTarget && options.includes(queuedTarget)) return [queuedTarget];
  return options[0] ? [options[0]] : [];
}

type ResolveCtx = {
  combo: Record<SideId, boolean>;
  hitsOn: Record<string, number>;
  firstDamage: Record<SideId, boolean>;
  events: CombatEvent[];
};

function pushEvent(ctx: ResolveCtx, event: CombatEvent) {
  ctx.events.push(event);
}

function applyEffect(
  state: MatchState,
  sourceSide: SideId,
  sourceId: string,
  effect: Effect,
  targetIds: string[],
  art: Art,
  ctx: ResolveCtx
): string[] {
  const lines: string[] = [];
  const sourceFighter = getFighter(sourceId);
  const allies = state.sides[sourceSide];
  const sourceUnit = allies.units[sourceId];
  const resonance = getResonance(allies.fighterIds.map((id) => getFighter(id)!).filter(Boolean));
  const sameFactionCount = allies.fighterIds.filter((id) => getFighter(id)?.faction === sourceFighter?.faction).length;
  const bonus = resonance === 'trinity' ? 8 : resonance === 'pair' && sameFactionCount >= 2 ? 5 : 0;

  if (effect.type === 'DRAIN_WEAVE') {
    const foe = state.sides[otherSide(sourceSide)];
    foe.weave = foe.weave.slice(0, Math.max(0, foe.weave.length - effect.amount));
    allies.drainedThisEcho = true;
    pushEvent(ctx, { kind: 'drain', sourceSide, targetSide: otherSide(sourceSide), fighterId: sourceId, amount: effect.amount });
    lines.push(`${sourceFighter?.name} drained ${effect.amount} Weave.`);
    return lines;
  }

  if (effect.type === 'STEAL_WEAVE') {
    const foe = state.sides[otherSide(sourceSide)];
    const stolen: EnergyId[] = [];
    for (let i = 0; i < effect.amount; i += 1) {
      const pip = foe.weave.pop();
      if (!pip) break;
      stolen.push(pip);
    }
    if (stolen.length) {
      allies.weave = [...allies.weave, ...stolen].slice(-WEAVE_CAP);
      allies.drainedThisEcho = true;
      pushEvent(ctx, { kind: 'drain', sourceSide, targetSide: otherSide(sourceSide), fighterId: sourceId, amount: stolen.length });
      lines.push(`${sourceFighter?.name} stole ${stolen.length} Weave.`);
    } else {
      lines.push(`${sourceFighter?.name} found no Weave to steal.`);
    }
    return lines;
  }

  for (const targetId of targetIds) {
    const targetSideId: SideId = allies.units[targetId] ? sourceSide : otherSide(sourceSide);
    const unit = state.sides[targetSideId].units[targetId];
    if (!unit || unit.hp <= 0) continue;
    const name = getFighter(targetId)?.name ?? targetId;

    if (effect.type === 'HEAL') {
      if (unit.hp <= 0) continue;
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + effect.amount);
      const healed = unit.hp - before;
      if (healed > 0) {
        pushEvent(ctx, { kind: 'heal', sourceSide, targetSide: targetSideId, fighterId: targetId, amount: healed });
      }
      lines.push(`${name} healed ${healed}.`);
    }
    if (effect.type === 'SHIELD') {
      unit.shield += effect.amount;
      pushEvent(ctx, { kind: 'shield', sourceSide, targetSide: targetSideId, fighterId: targetId, amount: effect.amount });
      lines.push(`${name} gained ${effect.amount} shield.`);
    }
    if (effect.type === 'STUN') {
      if (art.id === 'infinity-cut' && (sourceUnit?.veil ?? 0) <= 0) continue;
      unit.stun = Math.max(unit.stun, effect.echoes);
      pushEvent(ctx, { kind: 'stun', sourceSide, targetSide: targetSideId, fighterId: targetId });
      lines.push(`${name} is stunned.`);
    }
    if (effect.type === 'APPLY_STATUS') {
      if (effect.status === 'dr') {
        unit.dr = Math.max(unit.dr, effect.echoes);
        unit.drAmount = Math.max(unit.drAmount, effect.amount ?? 8);
        lines.push(`${name} gained ${unit.drAmount} damage reduction (${unit.dr} Echo).`);
      } else {
        const key = effect.status;
        unit[key] = Math.max(unit[key] ?? 0, effect.echoes);
        if (effect.status === 'veil') {
          pushEvent(ctx, { kind: 'veil', sourceSide, targetSide: targetSideId, fighterId: targetId });
        }
        if (effect.status === 'dodge') {
          pushEvent(ctx, { kind: 'dodge', sourceSide, targetSide: targetSideId, fighterId: targetId });
          lines.push(`${name} is ready to dodge.`);
        } else {
          lines.push(`${name} gained ${effect.status}.`);
        }
      }
    }
    if (effect.type === 'DAMAGE') {
      const persistence = art.persistence ?? 'instant';
      const kind: DamageKind = effect.kind ?? 'normal';
      pushEvent(ctx, { kind: 'attack', sourceSide, targetSide: targetSideId, fighterId: sourceId });

      if (persistence === 'action' || persistence === 'control') {
        state.channels = state.channels ?? [];
        state.channels.push({
          id: `${art.id}-${sourceId}-${targetId}-${state.echo}`,
          persistence,
          sourceSide,
          sourceId,
          targetSide: targetSideId,
          targetId,
          amount: Math.max(1, Math.round((effect.amount + bonus) * 0.55)),
          kind,
          remaining: Math.max(2, Math.min(4, art.cooldown || 3)),
          label: art.name,
        });
        lines.push(`${sourceFighter?.name} began ${art.name} on ${name} (${persistence}).`);
      }

      lines.push(
        ...dealDamage(state, sourceSide, sourceId, targetSideId, targetId, effect.amount + bonus, kind, art, ctx)
      );
    }
  }
  return lines;
}

function dealDamage(
  state: MatchState,
  sourceSide: SideId,
  sourceId: string,
  targetSideId: SideId,
  targetId: string,
  baseAmount: number,
  kind: DamageKind,
  art: Art,
  ctx: ResolveCtx
): string[] {
  const lines: string[] = [];
  const allies = state.sides[sourceSide];
  const sourceUnit = allies.units[sourceId];
  const sourceFighter = getFighter(sourceId);
  const unit = state.sides[targetSideId].units[targetId];
  if (!unit || unit.hp <= 0) return lines;
  const name = getFighter(targetId)?.name ?? targetId;
  const resonance = getResonance(allies.fighterIds.map((id) => getFighter(id)!).filter(Boolean));

  if ((unit.dodge ?? 0) > 0 && kind !== 'affliction') {
    unit.dodge = Math.max(0, (unit.dodge ?? 1) - 1);
    pushEvent(ctx, { kind: 'dodge', sourceSide: targetSideId, targetSide: sourceSide, fighterId: targetId });
    lines.push(`${name} dodged ${sourceFighter?.name}'s hit!`);
    return lines;
  }
  if (unit.veil > 0 && kind !== 'affliction') {
    lines.push(`${name}'s Aegis held.`);
    pushEvent(ctx, { kind: 'block', sourceSide, targetSide: targetSideId, fighterId: targetId });
    if (sourceUnit && sourceUnit.hp > 0) {
      let counter = VEIL_COUNTER;
      const absorbed = Math.min(sourceUnit.shield, counter);
      sourceUnit.shield -= absorbed;
      counter -= absorbed;
      sourceUnit.hp = Math.max(0, sourceUnit.hp - counter);
      pushEvent(ctx, { kind: 'hit', sourceSide: targetSideId, targetSide: sourceSide, fighterId: sourceId, amount: VEIL_COUNTER });
      lines.push(`${sourceFighter?.name} ate ${VEIL_COUNTER} veil counter.`);
      if (sourceUnit.hp <= 0) {
        pushEvent(ctx, { kind: 'seal', sourceSide: targetSideId, targetSide: sourceSide, fighterId: sourceId });
        lines.push(`${sourceFighter?.name} is sealed.`);
      }
    }
    return lines;
  }
  if (art.id === 'black-prize' && !allies.drainedThisEcho) {
    lines.push(`${sourceFighter?.name}'s Black Prize fizzled — no drain this Echo.`);
    return lines;
  }

  let amount = baseAmount;
  if (ctx.combo[sourceSide]) amount += COMBO_BONUS;
  if ((sourceUnit?.hp ?? 160) <= BLOODIED_HP) amount = Math.round(amount * 1.1);
  if ((sourceUnit?.tidebind ?? 0) > 0) amount = Math.round(amount * 0.75);
  const priorHits = ctx.hitsOn[targetId] ?? 0;
  if (priorHits > 0) amount += FOCUS_BONUS;
  const marked = unit.mark > 0;
  if (marked) {
    amount += 8;
    unit.mark = 0;
  }
  if (art.id === 'open-water' && unit.burn > 0) amount += 10;
  if (art.id === 'second-cut' && marked) amount += 8;
  if (art.id === 'true-name' && kind === 'normal') unit.shield = Math.max(0, unit.shield - 12);
  if ((art.id === 'tap' || art.id === 'shatter-note' || art.id === 'hollow-palm') && kind !== 'affliction') {
    unit.shield = 0;
  }

  // Damage reduction (ignored by pierce + affliction).
  if (kind === 'normal' && unit.dr > 0 && unit.drAmount > 0) {
    amount = Math.max(0, amount - unit.drAmount);
  }

  let incoming = amount;
  if (art.id === 'fang-break' && kind === 'normal') incoming = Math.max(0, incoming - Math.min(10, unit.shield));
  if (ctx.firstDamage[sourceSide] && resonance === 'trinity' && kind === 'normal') {
    incoming = Math.max(0, incoming - Math.min(TRINITY_SHRED, unit.shield));
  }
  ctx.firstDamage[sourceSide] = false;
  ctx.hitsOn[targetId] = priorHits + 1;

  let absorbed = 0;
  if (kind === 'affliction') {
    // Affliction ignores destructible defense (shield) and DR.
  } else if (kind === 'pierce') {
    // Pierce ignores DR but still hits shield.
    absorbed = Math.min(unit.shield, incoming);
    unit.shield -= absorbed;
    incoming -= absorbed;
  } else {
    absorbed = Math.min(unit.shield, incoming);
    unit.shield -= absorbed;
    incoming -= absorbed;
  }

  unit.hp = Math.max(0, unit.hp - incoming);
  pushEvent(ctx, { kind: 'hit', sourceSide, targetSide: targetSideId, fighterId: targetId, amount });
  const tag = kind === 'affliction' ? ' affliction' : kind === 'pierce' ? ' pierce' : '';
  lines.push(
    `${sourceFighter?.name} hit ${name} for ${amount}${tag}${absorbed ? ` (${absorbed} shielded)` : ''}.`
  );
  if (unit.hp <= 0) {
    pushEvent(ctx, { kind: 'seal', sourceSide, targetSide: targetSideId, fighterId: targetId });
    lines.push(`${name} is sealed.`);
    // Control channels break when target is sealed.
    state.channels = (state.channels ?? []).filter(
      (ch) => !(ch.persistence === 'control' && (ch.targetId === targetId || ch.sourceId === targetId))
    );
  }
  return lines;
}

type PreparedArt = {
  sideId: SideId;
  fighterId: string;
  art: Art;
  queuedTarget: string | null;
};

function prepareSideQueue(state: MatchState, sideId: SideId): PreparedArt[] {
  const side = state.sides[sideId];
  const prepared: PreparedArt[] = [];
  let weave = [...side.weave];
  for (const item of side.queue) {
    const unit = side.units[item.fighterId];
    const art = artById(item.fighterId, item.artId);
    if (!unit || !art || unit.hp <= 0) continue;
    if (unit.stun > 0) {
      state.log.push(`${getFighter(item.fighterId)?.name}'s art fizzled (stun).`);
      continue;
    }
    const paid = payCost(weave, art.energy);
    if (!paid) {
      state.log.push(`${art.name} fizzled — Weave short.`);
      continue;
    }
    weave = paid;
    unit.cooldowns[art.id] = art.cooldown;
    prepared.push({ sideId, fighterId: item.fighterId, art, queuedTarget: item.targetId });
  }
  side.weave = weave;
  side.queue = [];
  return prepared;
}

function runPreparedWaves(state: MatchState, prepared: PreparedArt[], ctx: ResolveCtx, rng: () => number) {
  const runWave = (controlOnly: boolean) => {
    for (const item of prepared) {
      const unit = state.sides[item.sideId].units[item.fighterId];
      if (!unit || unit.hp <= 0) continue;
      if (!controlOnly && unit.stun > 0) {
        if (item.art.effects.some((effect) => !isControlEffect(effect))) {
          state.log.push(`${getFighter(item.fighterId)?.name}'s strike fizzled (stunned this Echo).`);
        }
        continue;
      }
      state.lastCasterId = item.fighterId;
      const targets = resolveTargets(state, item.sideId, item.fighterId, item.art, item.queuedTarget, rng);
      for (const effect of item.art.effects) {
        if (controlOnly !== isControlEffect(effect)) continue;
        const effectTarget = 'target' in effect ? effect.target : item.art.target;
        const extraTargets =
          effectTarget !== item.art.target
            ? resolveTargets(
                state,
                item.sideId,
                item.fighterId,
                { ...item.art, target: effectTarget },
                item.queuedTarget,
                rng
              )
            : targets;
        state.log.push(...applyEffect(state, item.sideId, item.fighterId, effect, extraTargets, item.art, ctx));
      }
    }
  };
  runWave(true);
  runWave(false);
}

function checkWinnerAfterResolve(state: MatchState): boolean {
  const playerAlive = livingIds(state.sides.player).length;
  const foeAlive = livingIds(state.sides.foe).length;
  if (playerAlive === 0 && foeAlive === 0) {
    state.winner = 'draw';
    state.phase = 'ended';
    state.endReason = 'draw';
    state.log.push('Double seal. Draw.');
    return true;
  }
  if (playerAlive === 0) {
    state.winner = 'foe';
    state.phase = 'ended';
    state.endReason = 'seal';
    state.log.push('Host side sealed. Challenger wins.');
    return true;
  }
  if (foeAlive === 0) {
    state.winner = 'player';
    state.phase = 'ended';
    state.endReason = 'seal';
    state.log.push('Challenger side sealed. Host wins.');
    return true;
  }
  return false;
}

function tickStatuses(state: MatchState) {
  // Tick Action/Control channels first.
  const nextChannels: Channel[] = [];
  for (const channel of state.channels ?? []) {
    const source = state.sides[channel.sourceSide].units[channel.sourceId];
    const target = state.sides[channel.targetSide].units[channel.targetId];
    if (!source || source.hp <= 0) continue;
    if (!target || target.hp <= 0) continue;
    if (channel.persistence === 'action' && source.stun > 0) {
      state.log.push(`${channel.label} paused (caster stunned).`);
      nextChannels.push({ ...channel, remaining: channel.remaining });
      continue;
    }
    if (channel.persistence === 'control' && source.stun > 0) {
      state.log.push(`${channel.label} broke (control interrupted).`);
      continue;
    }
    const fakeArt = {
      id: channel.id,
      name: channel.label,
      description: '',
      cooldown: 0,
      energy: {},
      target: 'enemy' as const,
      effects: [],
    };
    const ctx: ResolveCtx = {
      combo: { player: false, foe: false },
      hitsOn: {},
      firstDamage: { player: false, foe: false },
      events: state.combatEvents,
    };
    state.log.push(
      ...dealDamage(
        state,
        channel.sourceSide,
        channel.sourceId,
        channel.targetSide,
        channel.targetId,
        channel.amount,
        channel.kind,
        fakeArt,
        ctx
      )
    );
    const remaining = channel.remaining - 1;
    if (remaining > 0) nextChannels.push({ ...channel, remaining });
  }
  state.channels = nextChannels;

  (['player', 'foe'] as SideId[]).forEach((sideId) => {
    const side = state.sides[sideId];
    for (const id of side.fighterIds) {
      const unit = side.units[id];
      if (unit.hp <= 0) {
        unit.shield = 0;
        unit.stun = 0;
        unit.veil = 0;
        unit.dodge = 0;
        unit.dr = 0;
        unit.drAmount = 0;
        continue;
      }
      if (unit.burn > 0) {
        // Affliction burn — ignores shield.
        unit.hp = Math.max(0, unit.hp - 6);
        state.log.push(`${getFighter(id)?.name} burned for 6 (affliction).`);
        unit.burn -= 1;
        if (unit.hp <= 0) state.log.push(`${getFighter(id)?.name} is sealed.`);
      }
      if (unit.stun > 0) unit.stun -= 1;
      if (unit.veil > 0) unit.veil -= 1;
      if ((unit.dodge ?? 0) > 0) unit.dodge -= 1;
      if (unit.mark > 0) unit.mark -= 1;
      if (unit.tidebind > 0) unit.tidebind -= 1;
      if (unit.dr > 0) {
        unit.dr -= 1;
        if (unit.dr <= 0) unit.drAmount = 0;
      }
      for (const [artId, cd] of Object.entries(unit.cooldowns)) {
        unit.cooldowns[artId] = Math.max(0, cd - 1);
      }
    }
  });
}

function advanceEcho(state: MatchState, rng: () => number) {
  if (state.echo >= state.maxEcho) {
    const pHp = state.sides.player.fighterIds.reduce((sum, id) => sum + state.sides.player.units[id].hp, 0);
    const fHp = state.sides.foe.fighterIds.reduce((sum, id) => sum + state.sides.foe.units[id].hp, 0);
    state.winner = pHp === fHp ? 'draw' : pHp > fHp ? 'player' : 'foe';
    state.phase = 'ended';
    state.endReason = state.winner === 'draw' ? 'draw' : 'echo-cap';
    state.log.push('Echo cap. Higher remaining HP wins.');
    return;
  }
  state.echo += 1;
  stampTurnClock(state);
  state.activeSide = 'player';
  state.sides.player.locked = false;
  state.sides.foe.locked = false;
  fillWeave(state, rng);
  const gained = state.lastGranted.player
    .map((id) => ENERGY_META[id]?.short ?? id)
    .join('');
  state.log.push(
    gained
      ? `Echo ${state.echo} — banked [${gained}]. Unused Weave stays for finishers.`
      : `Echo ${state.echo} — your turn.`
  );
  state.log = state.log.slice(-14);
}

/** Resolve the active side's queue, then pass the turn (player → foe → next Echo). */
export function commitTurn(state: MatchState, sideId: SideId, rng: () => number): MatchState {
  if (state.phase !== 'pick' || state.winner) return state;
  if ((state.activeSide ?? 'player') !== sideId) return state;

  const next = autoAegisIfEmpty(state, sideId);
  next.sides[sideId].locked = true;

  const ctx: ResolveCtx = {
    combo: {
      player: sideId === 'player' ? factionCombo(next.sides.player) : false,
      foe: sideId === 'foe' ? factionCombo(next.sides.foe) : false,
    },
    hitsOn: {},
    firstDamage: { player: true, foe: true },
    events: [],
  };
  next.combatEvents = [];
  if (ctx.combo[sideId]) {
    next.log.push(sideId === 'player' ? 'Host side chained a faction combo (+6).' : 'Challenger side chained a faction combo (+6).');
  }

  const prepared = prepareSideQueue(next, sideId);
  runPreparedWaves(next, prepared, ctx, rng);
  next.combatEvents = ctx.events;
  next.sides[sideId].locked = false;

  if (checkWinnerAfterResolve(next)) return next;

  if (sideId === 'player') {
    next.activeSide = 'foe';
    stampTurnClock(next);
    next.sides.foe.locked = false;
    next.log.push("Opponent's turn.");
    next.log = next.log.slice(-14);
    return next;
  }

  tickStatuses(next);
  if (checkWinnerAfterResolve(next)) return next;
  advanceEcho(next, rng);
  return next;
}

/** @deprecated Prefer commitTurn — kept for any dual-lock leftovers. */
export function resolveEcho(state: MatchState, rng: () => number): MatchState {
  let next = commitTurn(state, state.activeSide ?? 'player', rng);
  if (next.winner || next.phase === 'ended') return next;
  if (next.activeSide === 'foe') {
    next = autoAegisIfEmpty(next, 'foe');
    next = commitTurn(next, 'foe', rng);
  }
  return next;
}

export function forfeitMatch(state: MatchState, loser: SideId): MatchState {
  const next = clone(state);
  if (next.winner) return next;
  next.winner = otherSide(loser);
  next.phase = 'ended';
  next.endReason = 'surrender';
  next.sides.player.locked = true;
  next.sides.foe.locked = true;
  next.combatEvents = [];
  next.log = [
    ...next.log.slice(-12),
    loser === 'player' ? 'Host surrendered. Challenger wins.' : 'Challenger surrendered. Host wins.',
  ];
  return next;
}

export function tickTimer(state: MatchState): MatchState {
  if (state.phase !== 'pick' || state.winner) return state;
  const next = clone(state);
  const left = secondsRemaining(next);
  next.secondsLeft = left;
  // Keep deadline authoritative; only nudge secondsLeft for legacy UI.
  if (!next.turnDeadlineAt) {
    next.secondsLeft = Math.max(0, next.secondsLeft - 1);
    next.turnDeadlineAt = Date.now() + next.secondsLeft * 1000;
  }
  return next;
}

export function isBloodied(unit: UnitState): boolean {
  return unit.hp > 0 && unit.hp <= BLOODIED_HP;
}

export function totalHp(side: SideState): number {
  return side.fighterIds.reduce((sum, id) => sum + side.units[id].hp, 0);
}
