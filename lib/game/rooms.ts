'use client';

import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase/config';
import { createMatch, forfeitMatch, otherSide, type MatchState, type SideId } from '@/lib/game/engine';
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

export async function writeMatch(code: string, match: MatchState, opts?: { mine?: SideId }): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;
  let nextMatch = match;
  // Never merge over an ended match, and never clobber the other side while picking.
  if (
    opts?.mine &&
    room.match &&
    !match.winner &&
    !room.match.winner &&
    room.match.echo === match.echo &&
    room.match.phase === 'pick' &&
    match.phase === 'pick'
  ) {
    const other = otherSide(opts.mine);
    nextMatch = {
      ...match,
      sides: {
        ...match.sides,
        [other]: room.match.sides[other],
      },
      // Prefer the latest combatEvents from the writer who just resolved.
      combatEvents: match.combatEvents?.length ? match.combatEvents : room.match.combatEvents ?? [],
    };
  }
  const next: ArenaRoom = {
    ...room,
    match: nextMatch,
    status: statusOf(nextMatch, room.status),
    updatedAt: Date.now(),
  };
  const cloud = await writeCloud(next);
  if (!cloud) writeLocal(next);
}

export async function surrenderRoom(code: string, loser: SideId): Promise<MatchState | null> {
  const room = await getRoom(code);
  if (!room?.match || room.match.winner) return room?.match ?? null;
  const nextMatch = forfeitMatch(room.match, loser);
  await writeMatch(code, nextMatch);
  return nextMatch;
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

function statusOf(match: MatchState, current: RoomStatus): RoomStatus {
  if (match.winner) return 'ended';
  if (current === 'waiting') return 'waiting';
  return 'battle';
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

export function subscribeRoom(code: string, onRoom: (room: ArenaRoom) => void): () => void {
  const normalized = normalizeGateCode(code);
  let cancelled = false;
  let lastUpdated = 0;

  const emit = (room: ArenaRoom | null) => {
    if (!room || cancelled) return;
    if (room.updatedAt && room.updatedAt < lastUpdated) return;
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
