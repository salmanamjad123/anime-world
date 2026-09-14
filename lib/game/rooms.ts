'use client';

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import {
  createMatch,
  forfeitMatch,
  otherSide,
  type MatchState,
  type SideId,
  type SideState,
} from '@/lib/game/engine';
import { TEAM_SIZE, getFighter } from '@/lib/game/roster';

function assertTeam(team: string[]) {
  if (team.length !== TEAM_SIZE) {
    throw new Error(`Seal ${TEAM_SIZE} fighters before you open or join a gate.`);
  }
  const unique = new Set(team);
  if (unique.size !== TEAM_SIZE) {
    throw new Error('Pick 3 different fighters.');
  }
  for (const id of team) {
    const fighter = getFighter(id);
    if (!fighter) throw new Error('Unknown fighter on your team.');
    if (!fighter.unlocked) throw new Error(`${fighter.name} is locked.`);
  }
}

export const ROOM_TTL_MS = 10 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHANNEL = 'va-arena-rooms';
const COLLECTION = 'arenaRooms';

export type RoomStatus = 'waiting' | 'battle' | 'ended';

export type ArenaRoom = {
  code: string;
  hostUid: string;
  hostName: string;
  hostTeam: string[];
  guestUid: string | null;
  guestName: string | null;
  guestTeam: string[] | null;
  status: RoomStatus;
  match: MatchState | null;
  seed: number;
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
  transport: 'firestore' | 'local';
};

export type RoomPlayer = {
  uid: string;
  name: string;
  team: string[];
};

export type MatchWriteResult = {
  ok: boolean;
  reason?: 'missing' | 'stale' | 'ended' | 'not-your-turn';
  match: MatchState | null;
  room: ArenaRoom | null;
};

export type TurnExpect = {
  echo: number;
  activeSide: SideId;
  matchRev: number;
};

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!;
  }
  return code;
}

export function normalizeGateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function storageKey(code: string): string {
  return `va-room-${code}`;
}

function serialize(room: ArenaRoom): ArenaRoom {
  return JSON.parse(JSON.stringify(room)) as ArenaRoom;
}

function readLocal(code: string): ArenaRoom | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ArenaRoom;
  } catch {
    return null;
  }
}

function writeLocal(room: ArenaRoom) {
  if (typeof window === 'undefined') return;
  const packed = serialize({ ...room, transport: 'local' });
  window.localStorage.setItem(storageKey(room.code), JSON.stringify(packed));
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(packed);
    channel.close();
  } catch {
    /* BroadcastChannel optional */
  }
}

async function writeCloud(room: ArenaRoom): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const packed = serialize({ ...room, transport: 'firestore' });
    await setDoc(doc(db, COLLECTION, room.code), packed);
    writeLocal({ ...packed, transport: 'local' });
    return true;
  } catch {
    writeLocal(room);
    return false;
  }
}

function bumpRev(match: MatchState): MatchState {
  return { ...match, matchRev: (match.matchRev ?? 0) + 1 };
}

function statusOf(match: MatchState, current: RoomStatus): RoomStatus {
  if (match.winner) return 'ended';
  if (current === 'waiting') return 'waiting';
  return 'battle';
}

/**
 * Apply a room mutation with CAS. Prefers Firestore transactions so two
 * clients cannot last-write-wins each other. Falls back to localStorage.
 */
async function mutateRoom(
  code: string,
  mutate: (room: ArenaRoom) => ArenaRoom | null
): Promise<ArenaRoom | null> {
  const normalized = normalizeGateCode(code);
  if (isFirebaseConfigured() && db) {
    try {
      const ref = doc(db, COLLECTION, normalized);
      const next = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return null;
        const room = snap.data() as ArenaRoom;
        const updated = mutate(room);
        if (!updated) return null;
        const packed = serialize({ ...updated, transport: 'firestore' as const });
        tx.set(ref, packed);
        return packed;
      });
      if (next) {
        writeLocal({ ...next, transport: 'local' });
        return next;
      }
      // Transaction returned null (CAS reject) — still return current for callers.
      return null;
    } catch {
      /* fall through to local */
    }
  }

  const room = readLocal(normalized);
  if (!room) return null;
  const updated = mutate(room);
  if (!updated) return null;
  writeLocal(updated);
  return updated;
}

export async function getRoom(code: string): Promise<ArenaRoom | null> {
  const normalized = normalizeGateCode(code);
  if (normalized.length < 4) return null;
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDoc(doc(db, COLLECTION, normalized));
      if (snap.exists()) return snap.data() as ArenaRoom;
    } catch {
      /* fall through to local */
    }
  }
  return readLocal(normalized);
}

function assertFresh(room: ArenaRoom) {
  if (Date.now() > room.expiresAt) {
    throw new Error('That gate expired. Create a new code.');
  }
}

export async function createRoom(host: RoomPlayer): Promise<{ room: ArenaRoom; cloud: boolean }> {
  assertTeam(host.team);
  const now = Date.now();
  const room: ArenaRoom = {
    code: generateCode(),
    hostUid: host.uid,
    hostName: host.name,
    hostTeam: host.team,
    guestUid: null,
    guestName: null,
    guestTeam: null,
    status: 'waiting',
    match: null,
    seed: now,
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
    updatedAt: now,
    transport: 'local',
  };
  const cloud = await writeCloud(room);
  if (!cloud) writeLocal(room);
  rememberSeat(room.code, 'host');
  return { room: { ...room, transport: cloud ? 'firestore' : 'local' }, cloud };
}

export async function joinRoom(code: string, guest: RoomPlayer): Promise<{ room: ArenaRoom; cloud: boolean }> {
  assertTeam(guest.team);
  const room = await getRoom(code);
  if (!room) throw new Error('No gate with that code.');
  assertFresh(room);
  if (room.status === 'ended') throw new Error('That match already ended. Create a new gate.');
  if (room.hostUid === guest.uid && rememberedSeat(room.code) === 'host') {
    return { room, cloud: room.transport === 'firestore' };
  }
  if (room.guestUid && room.guestUid !== guest.uid) {
    throw new Error('That gate already has a challenger.');
  }
  if (room.status === 'battle' && room.guestUid === guest.uid) {
    rememberSeat(room.code, 'guest');
    return { room, cloud: room.transport === 'firestore' };
  }
  const match = room.match ?? createMatch(room.hostTeam, guest.team, room.seed);
  const next: ArenaRoom = {
    ...room,
    guestUid: guest.uid,
    guestName: guest.name,
    guestTeam: guest.team,
    status: 'battle',
    match,
    updatedAt: Date.now(),
  };
  const cloud = await writeCloud(next);
  if (!cloud) writeLocal(next);
  rememberSeat(next.code, 'guest');
  return { room: { ...next, transport: cloud ? 'firestore' : 'local' }, cloud };
}

function expectStillCurrent(match: MatchState, expected: TurnExpect, mine: SideId): MatchWriteResult['reason'] | null {
  if (match.winner || match.phase !== 'pick') return 'ended';
  if ((match.activeSide ?? 'player') !== expected.activeSide) return 'not-your-turn';
  if (match.echo !== expected.echo) return 'stale';
  if ((match.activeSide ?? 'player') !== mine) return 'not-your-turn';
  // Allow remote rev ahead only if we somehow lagged; reject if remote is behind
  // our base (impossible) or if remote jumped past our base without matching turn.
  if ((match.matchRev ?? 0) < expected.matchRev) return 'stale';
  return null;
}

/**
 * Mid-turn pick write: only patches this seat's queue/weave.
 * Never touches activeSide, echo, units, or the opponent's side.
 */
export async function patchMySide(
  code: string,
  mine: SideId,
  expected: TurnExpect,
  side: Pick<SideState, 'queue' | 'weave'>
): Promise<MatchWriteResult> {
  let rejectReason: MatchWriteResult['reason'] | undefined;
  const updated = await mutateRoom(code, (room) => {
    if (!room.match) {
      rejectReason = 'missing';
      return null;
    }
    const reason = expectStillCurrent(room.match, expected, mine);
    if (reason) {
      rejectReason = reason;
      return null;
    }
    // Same turn but another of our patches already landed — still apply on top
    // if echo/activeSide match and rev is >= expected.
    if ((room.match.matchRev ?? 0) > expected.matchRev) {
      // Only accept if still our turn (already checked). Patch onto latest.
    }
    const nextMatch = bumpRev({
      ...room.match,
      sides: {
        ...room.match.sides,
        [mine]: {
          ...room.match.sides[mine],
          queue: side.queue,
          weave: side.weave,
        },
      },
    });
    return {
      ...room,
      match: nextMatch,
      status: statusOf(nextMatch, room.status),
      updatedAt: Date.now(),
    };
  });

  if (!updated?.match) {
    const room = await getRoom(code);
    return { ok: false, reason: rejectReason ?? 'stale', match: room?.match ?? null, room };
  }
  return { ok: true, match: updated.match, room: updated };
}

/**
 * Turn commit: only accepted when echo/activeSide/matchRev still match.
 * This is the only client path allowed to advance activeSide / echo / HP.
 */
export async function commitTurnWrite(
  code: string,
  mine: SideId,
  expected: TurnExpect,
  resolved: MatchState
): Promise<MatchWriteResult> {
  let rejectReason: MatchWriteResult['reason'] | undefined;
  const updated = await mutateRoom(code, (room) => {
    if (!room.match) {
      rejectReason = 'missing';
      return null;
    }
    if (room.match.winner || room.match.phase === 'ended') {
      rejectReason = 'ended';
      return null;
    }
    if ((room.match.activeSide ?? 'player') !== mine || mine !== expected.activeSide) {
      rejectReason = 'not-your-turn';
      return null;
    }
    if (room.match.echo !== expected.echo) {
      rejectReason = 'stale';
      return null;
    }
    // Commit must be based on the latest rev for this turn. If queue patches
    // bumped rev after we snapshot expected, accept when still same turn and
    // remote rev >= expected (we already serialized writes on the client).
    if ((room.match.matchRev ?? 0) < expected.matchRev) {
      rejectReason = 'stale';
      return null;
    }
    const nextMatch = bumpRev({
      ...resolved,
      // Preserve any newer opponent pick fields if they somehow wrote (shouldn't
      // during our turn) — keep resolved as authority for combat/turn.
      matchRev: room.match.matchRev ?? 0,
    });
    return {
      ...room,
      match: nextMatch,
      status: statusOf(nextMatch, room.status),
      // Extend TTL while a live battle is progressing.
      expiresAt: Math.max(room.expiresAt, Date.now() + ROOM_TTL_MS),
      updatedAt: Date.now(),
    };
  });

  if (!updated?.match) {
    const room = await getRoom(code);
    return { ok: false, reason: rejectReason ?? 'stale', match: room?.match ?? null, room };
  }
  return { ok: true, match: updated.match, room: updated };
}

/**
 * @deprecated Prefer patchMySide / commitTurnWrite. Kept for surrender + legacy.
 * Still CAS-bumps matchRev and refuses to rewind echo/activeSide vs room.
 */
export async function writeMatch(code: string, match: MatchState, opts?: { mine?: SideId }): Promise<void> {
  await mutateRoom(code, (room) => {
    if (!room.match) {
      return {
        ...room,
        match: bumpRev(match),
        status: statusOf(match, room.status),
        updatedAt: Date.now(),
      };
    }

    // Never let a non-winner write rewind an ended match.
    if (room.match.winner && !match.winner) return null;

    let nextMatch = match;
    if (
      opts?.mine &&
      !match.winner &&
      !room.match.winner &&
      room.match.echo === match.echo &&
      room.match.phase === 'pick' &&
      match.phase === 'pick' &&
      (room.match.activeSide ?? 'player') === (match.activeSide ?? 'player')
    ) {
      const other = otherSide(opts.mine);
      nextMatch = {
        ...match,
        sides: {
          ...match.sides,
          [other]: room.match.sides[other],
        },
        activeSide: room.match.activeSide,
        echo: room.match.echo,
        turnDeadlineAt: room.match.turnDeadlineAt ?? match.turnDeadlineAt,
        combatEvents: match.combatEvents?.length ? match.combatEvents : room.match.combatEvents ?? [],
      };
    } else if (
      !match.winner &&
      room.match.echo > match.echo
    ) {
      // Stale full write trying to rewind echo — drop it.
      return null;
    } else if (
      !match.winner &&
      room.match.echo === match.echo &&
      (room.match.matchRev ?? 0) > (match.matchRev ?? 0) &&
      room.match.activeSide !== match.activeSide
    ) {
      // Stale write from before a turn commit — drop it.
      return null;
    }

    nextMatch = bumpRev({
      ...nextMatch,
      matchRev: Math.max(room.match.matchRev ?? 0, match.matchRev ?? 0),
    });

    return {
      ...room,
      match: nextMatch,
      status: statusOf(nextMatch, room.status),
      updatedAt: Date.now(),
    };
  });
}

export async function surrenderRoom(code: string, loser: SideId): Promise<MatchState | null> {
  const updated = await mutateRoom(code, (room) => {
    if (!room.match || room.match.winner) return null;
    const nextMatch = bumpRev(forfeitMatch(room.match, loser));
    return {
      ...room,
      match: nextMatch,
      status: 'ended',
      updatedAt: Date.now(),
    };
  });
  if (updated?.match) return updated.match;
  const room = await getRoom(code);
  return room?.match ?? null;
}

export async function cancelRoom(code: string, uid: string): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;
  if (room.hostUid !== uid) return;
  if (room.status !== 'waiting') return;
  const next: ArenaRoom = {
    ...room,
    status: 'ended',
    updatedAt: Date.now(),
    expiresAt: Date.now(),
  };
  const cloud = await writeCloud(next);
  if (!cloud) writeLocal(next);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(storageKey(normalizeGateCode(code)));
  }
}

const SEAT_KEY = (code: string) => `va-gate-seat-${code}`;

export function rememberSeat(code: string, seat: 'host' | 'guest') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SEAT_KEY(normalizeGateCode(code)), seat);
}

export function rememberedSeat(code: string): 'host' | 'guest' | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(SEAT_KEY(normalizeGateCode(code)));
  return value === 'host' || value === 'guest' ? value : null;
}

export function seatFor(room: ArenaRoom, uid: string): SideId | null {
  const remembered = rememberedSeat(room.code);
  if (remembered === 'guest' && (!room.guestUid || room.guestUid === uid)) return 'foe';
  if (remembered === 'host' && room.hostUid === uid) return 'player';
  if (room.hostUid === uid && room.guestUid !== uid) return 'player';
  if (room.guestUid === uid) return 'foe';
  if (room.hostUid === uid) return 'player';
  return null;
}

/** Prefer remote match when its rev is newer; never rewind local commits. */
export function shouldApplyRemoteMatch(local: MatchState | null, remote: MatchState): boolean {
  if (!local) return true;
  const localRev = local.matchRev ?? 0;
  const remoteRev = remote.matchRev ?? 0;
  if (remoteRev > localRev) return true;
  if (remoteRev < localRev) return false;
  // Same rev: prefer remote echo/activeSide if remote has progressed (rare tie).
  if (remote.echo > local.echo) return true;
  if (remote.echo < local.echo) return false;
  if (remote.winner && !local.winner) return true;
  return true;
}

export function subscribeRoom(code: string, onRoom: (room: ArenaRoom) => void): () => void {
  const normalized = normalizeGateCode(code);
  let cancelled = false;
  let lastUpdated = 0;
  let lastRev = -1;

  const emit = (room: ArenaRoom | null) => {
    if (!room || cancelled) return;
    const rev = room.match?.matchRev ?? -1;
    // Prefer higher matchRev; fall back to updatedAt for waiting rooms.
    if (room.match) {
      if (rev < lastRev) return;
      if (rev === lastRev && room.updatedAt && room.updatedAt < lastUpdated) return;
      lastRev = rev;
    } else if (room.updatedAt && room.updatedAt < lastUpdated) {
      return;
    }
    lastUpdated = room.updatedAt ?? Date.now();
    onRoom(room);
  };

  const local = readLocal(normalized);
  if (local) emit(local);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(normalized) || !event.newValue) return;
    try {
      emit(JSON.parse(event.newValue) as ArenaRoom);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('storage', onStorage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<ArenaRoom>) => {
      if (event.data?.code === normalized) emit(event.data);
    };
  } catch {
    channel = null;
  }

  let unsubFs: Unsubscribe | undefined;
  if (isFirebaseConfigured() && db) {
    unsubFs = onSnapshot(
      doc(db, COLLECTION, normalized),
      (snap) => {
        if (snap.exists()) emit(snap.data() as ArenaRoom);
      },
      () => {
        /* permission — local path still live */
      }
    );
  }

  return () => {
    cancelled = true;
    window.removeEventListener('storage', onStorage);
    channel?.close();
    unsubFs?.();
  };
}
