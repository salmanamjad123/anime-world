import type { Art, Effect, EnergyId, TargetKind } from '@/types/game';
import { getFighter, getFighterArts, TEAM_SIZE } from '@/lib/game/roster';
import { getResonance } from '@/lib/game/team-rules';

export type SideId = 'player' | 'foe';

export type QueuedArt = {
  fighterId: string;
  artId: string;
  targetId: string | null;
};

export type UnitState = {
  id: string;
  hp: number;
  maxHp: number;
  shield: number;
  cooldowns: Record<string, number>;
  stun: number;
  veil: number;
  mark: number;
  burn: number;
  tidebind: number;
};

export type SideState = {
  fighterIds: string[];
  units: Record<string, UnitState>;
  weave: EnergyId[];
  queue: QueuedArt[];
  locked: boolean;
  drainedThisEcho: boolean;
};

export type CombatKind = 'attack' | 'hit' | 'heal' | 'shield' | 'stun' | 'seal' | 'veil' | 'drain' | 'block';

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
  sides: Record<SideId, SideState>;
  log: string[];
  winner: SideId | 'draw' | null;
  seed: number;
  lastCasterId: string | null;
  combatEvents: CombatEvent[];
  endReason: 'seal' | 'echo-cap' | 'surrender' | 'draw' | null;
};

export const ECHO_SECONDS = 22;
export const MAX_ECHO = 12;
export const WEAVE_CAP = 7;
export const BLOODIED_HP = 35;
export const VEIL_COUNTER = 10;
export const COMBO_BONUS = 6;
export const FOCUS_BONUS = 8;
export const TRINITY_SHRED = 10;
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
    mark: 0,
    burn: 0,
    tidebind: 0,
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

function grantPips(count: number, rng: () => number, extraAny: boolean): EnergyId[] {
  const pips: EnergyId[] = [];
  for (let i = 0; i < count; i += 1) {
    pips.push(COLORED[Math.floor(rng() * COLORED.length)] ?? 'strike');
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
    sides: {
      player: makeSide(playerIds),
      foe: makeSide(foeIds),
    },
    log: ['Echo 1 — your turn. Pick powers, then Attack.'],
    winner: null,
    seed,
    lastCasterId: playerIds[0] ?? null,
    combatEvents: [],
    endReason: null,
  };

  fillWeave(state, rng);
  return state;
}

function fillWeave(state: MatchState, rng: () => number) {
  (['player', 'foe'] as SideId[]).forEach((sideId) => {
    const side = state.sides[sideId];
    const living = livingIds(side).length;
    const bound = livingIds(side).filter((id) => side.units[id].tidebind > 0).length;
    const fighters = livingIds(side).map((id) => getFighter(id)!).filter(Boolean);
    const chaos = getResonance(fighters) === 'chaos';
    const ash =
      state.echo === 1 ? (sideId === 'player' ? 1 : 3) : Math.max(0, living - bound);
    side.weave = [...side.weave, ...grantPips(ash, rng, chaos)].slice(-WEAVE_CAP);
    side.drainedThisEcho = false;
  });
}

function isControlEffect(effect: Effect): boolean {
  return effect.type === 'STUN' || effect.type === 'DRAIN_WEAVE' || effect.type === 'APPLY_STATUS';
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
    if (!queueError(next, sideId, id, 'aegis-veil', id)) {
      side.queue.push({ fighterId: id, artId: 'aegis-veil', targetId: id });
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
  const art = artById(fighterId, artId);
  if (!art) return 'Unknown art.';
  if (!canAfford(remainingWeaveAfterQueue(side), art.energy)) return 'Not enough Weave.';
  if (needsExplicitTarget(art.target) && !targetId) return 'Pick a target.';
  if (targetId) {
    const legal = legalTargets(state, sideId, fighterId, art).some((unitState) => unitState.id === targetId);
    if (!legal) return 'Illegal target.';
  }
  return null;
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

  if (bloodiedSelf && !queueError(next, 'foe', bloodiedSelf, 'aegis-veil', bloodiedSelf)) {
    side.queue.push({ fighterId: bloodiedSelf, artId: 'aegis-veil', targetId: bloodiedSelf });
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
      if (side.queue.length >= 3) break;
    }
  }

  if (side.queue.length === 0 && livingIds(side)[0]) {
    const id = livingIds(side)[0];
    if (!queueError(next, 'foe', id, 'aegis-veil', id)) {
      side.queue.push({ fighterId: id, artId: 'aegis-veil', targetId: id });
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

  for (const targetId of targetIds) {
    const targetSideId: SideId = allies.units[targetId] ? sourceSide : otherSide(sourceSide);
    const unit = state.sides[targetSideId].units[targetId];
    if (!unit || unit.hp <= 0) continue;
    const name = getFighter(targetId)?.name ?? targetId;

    if (effect.type === 'HEAL') {
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
      unit[effect.status === 'veil' ? 'veil' : effect.status] = Math.max(
        unit[effect.status === 'veil' ? 'veil' : effect.status],
        effect.echoes
      );
      if (effect.status === 'veil') {
        pushEvent(ctx, { kind: 'veil', sourceSide, targetSide: targetSideId, fighterId: targetId });
      }
      lines.push(`${name} gained ${effect.status}.`);
    }
    if (effect.type === 'DAMAGE') {
      pushEvent(ctx, { kind: 'attack', sourceSide, targetSide: targetSideId, fighterId: sourceId });
      if (unit.veil > 0) {
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
        continue;
      }
      if (art.id === 'black-prize' && !allies.drainedThisEcho) {
        lines.push(`${sourceFighter?.name}'s Black Prize fizzled — no drain this Echo.`);
        continue;
      }
      let amount = effect.amount + bonus;
      if (ctx.combo[sourceSide]) amount += COMBO_BONUS;
      if ((sourceUnit?.hp ?? 100) <= BLOODIED_HP) amount = Math.round(amount * 1.2);
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
      if (art.id === 'true-name') unit.shield = Math.max(0, unit.shield - 12);
      if (art.id === 'tap' || art.id === 'shatter-note' || art.id === 'hollow-palm') unit.shield = 0;
      let incoming = amount;
      if (art.id === 'fang-break') incoming = Math.max(0, incoming - Math.min(10, unit.shield));
      if (ctx.firstDamage[sourceSide] && resonance === 'trinity') {
        incoming = Math.max(0, incoming - Math.min(TRINITY_SHRED, unit.shield));
      }
      ctx.firstDamage[sourceSide] = false;
      ctx.hitsOn[targetId] = priorHits + 1;
      const absorbed = Math.min(unit.shield, incoming);
      unit.shield -= absorbed;
      incoming -= absorbed;
      unit.hp = Math.max(0, unit.hp - incoming);
      pushEvent(ctx, { kind: 'hit', sourceSide, targetSide: targetSideId, fighterId: targetId, amount });
      lines.push(`${sourceFighter?.name} hit ${name} for ${amount}${absorbed ? ` (${absorbed} shielded)` : ''}.`);
      if (unit.hp <= 0) {
        pushEvent(ctx, { kind: 'seal', sourceSide, targetSide: targetSideId, fighterId: targetId });
        lines.push(`${name} is sealed.`);
      }
    }
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
  (['player', 'foe'] as SideId[]).forEach((sideId) => {
    const side = state.sides[sideId];
    for (const id of side.fighterIds) {
      const unit = side.units[id];
      if (unit.hp <= 0) {
        unit.shield = 0;
        unit.stun = 0;
        unit.veil = 0;
        continue;
      }
      if (unit.burn > 0) {
        unit.hp = Math.max(0, unit.hp - 6);
        state.log.push(`${getFighter(id)?.name} burned for 6.`);
        unit.burn -= 1;
      }
      if (unit.stun > 0) unit.stun -= 1;
      if (unit.veil > 0) unit.veil -= 1;
      if (unit.mark > 0) unit.mark -= 1;
      if (unit.tidebind > 0) unit.tidebind -= 1;
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
  state.secondsLeft = ECHO_SECONDS;
  state.activeSide = 'player';
  state.sides.player.locked = false;
  state.sides.foe.locked = false;
  fillWeave(state, rng);
  state.log.push(`Echo ${state.echo} — your turn.`);
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
    next.secondsLeft = ECHO_SECONDS;
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
  next.secondsLeft = Math.max(0, next.secondsLeft - 1);
  return next;
}

export function isBloodied(unit: UnitState): boolean {
  return unit.hp > 0 && unit.hp <= BLOODIED_HP;
}

export function totalHp(side: SideState): number {
  return side.fighterIds.reduce((sum, id) => sum + side.units[id].hp, 0);
}
