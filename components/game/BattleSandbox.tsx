'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, CircleHelp, Copy, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FighterArt } from '@/components/game/FighterArt';
import { WeaveCost, WeaveBank } from '@/components/game/WeavePips';
import { HowToPlay, TUTORIAL_KEYS } from '@/components/game/HowToPlay';
import { MusicToggle } from '@/components/game/MusicToggle';
import { describeArtEffects, targetHint } from '@/components/game/SkillIcon';
import { SkillTile } from '@/components/game/SkillTile';
import { artClasses } from '@/lib/game/skill-art';
import { ENERGY_META, FIGHTERS, TEAM_SIZE, getFighter, getFighterArts } from '@/lib/game/roster';
import { pickShadeTeam } from '@/lib/game/team-rules';
import { battleStrategyTip } from '@/lib/game/strategy';
import {
  type ArenaRoom,
  cancelRoom,
  commitTurnWrite,
  joinRoom,
  patchMySide,
  rememberedSeat,
  seatFor,
  shouldApplyRemoteMatch,
  subscribeRoom,
  surrenderRoom,
} from '@/lib/game/rooms';
import {
  WEAVE_EXCHANGE_COST,
  canAfford,
  commitTurn,
  createMatch,
  exchangeWeave,
  forfeitMatch,
  isBloodied,
  legalTargets,
  mulberry32,
  needsExplicitTarget,
  otherSide,
  pickBotQueue,
  queueArt,
  queueError,
  remainingWeaveAfterQueue,
  secondsRemaining,
  unqueueArt,
  type MatchState,
  type SideId,
  type UnitState,
} from '@/lib/game/engine';
import { playCombatFromPerspective, playDefeat, playUiClick, playVictory } from '@/lib/game/sfx';
import { useGameLobbyStore } from '@/store/useGameLobbyStore';
import { useGameProfileStore } from '@/store/useGameProfileStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { Art, EnergyId, Fighter } from '@/types/game';

const EXCHANGE_COLORS: EnergyId[] = ['strike', 'tide', 'pulse', 'blood'];

function resolveFighters(ids: string[]): Fighter[] {
  return ids.map((id) => getFighter(id)).filter((fighter): fighter is Fighter => Boolean(fighter));
}

function normalizeMatch(match: MatchState): MatchState {
  const sides = { ...match.sides };
  (['player', 'foe'] as const).forEach((sideId) => {
    const side = sides[sideId];
    if (!side) return;
    const units = { ...side.units };
    for (const [id, unit] of Object.entries(units)) {
      units[id] = {
        ...unit,
        dodge: unit.dodge ?? 0,
        dr: unit.dr ?? 0,
        drAmount: unit.drAmount ?? 0,
      };
    }
    sides[sideId] = { ...side, units };
  });
  const secondsLeft = match.secondsLeft ?? 60;
  return {
    ...match,
    sides,
    activeSide: match.activeSide ?? 'player',
    matchRev: match.matchRev ?? 0,
    turnDeadlineAt: match.turnDeadlineAt ?? Date.now() + secondsLeft * 1000,
    secondsLeft,
    combatEvents: match.combatEvents ?? [],
    endReason: match.endReason ?? null,
    lastGranted: match.lastGranted ?? { player: [], foe: [] },
    channels: match.channels ?? [],
  };
}

/** Apply a room write result without clobbering a newer local commit. */
function mergeRoomMatch(local: MatchState | null, remoteRaw: MatchState): MatchState {
  const remote = normalizeMatch(remoteRaw);
  if (!local) return remote;
  if (!shouldApplyRemoteMatch(local, remote)) return local;
  // Same/newer rev but we already advanced the turn locally — keep local.
  if (
    remote.echo < local.echo ||
    (remote.echo === local.echo &&
      remote.activeSide !== local.activeSide &&
      (local.matchRev ?? 0) >= (remote.matchRev ?? 0) &&
      !remote.winner)
  ) {
    return local;
  }
  return remote;
}

export function BattleSandbox({
  roomCode = null,
  onExit,
}: {
  roomCode?: string | null;
  onExit?: () => void;
}) {
  const router = useRouter();
  const teamIds = useGameLobbyStore((s) => s.teamIds);
  const shadeIds = useGameLobbyStore((s) => s.shadeIds);
  const setShadeIds = useGameLobbyStore((s) => s.setShadeIds);
  const lastMode = useGameLobbyStore((s) => s.lastMode);
  const exitToLobby = useGameLobbyStore((s) => s.exitToLobby);
  const { user, isLoading: authLoading } = useUserStore();
  const openAuthModal = useAuthModalStore((s) => s.openAuthModal);
  const arenaName = useGameProfileStore((s) => s.arenaName);
  const gameTitle = useGameProfileStore((s) => s.title);
  const [hydrated, setHydrated] = useState(false);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ fighterId: string; art: Art } | null>(null);
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const lockingRef = useRef(false);
  const lockEchoRef = useRef<() => void>(() => {});
  const joiningRef = useRef(false);
  const writeChainRef = useRef(Promise.resolve());
  const autoLockKeyRef = useRef('');
  const matchRef = useRef<MatchState | null>(null);
  const rngRef = useRef(() => Math.random());
  const lastSfxKey = useRef('');
  const endSfxDone = useRef(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const pvp = Boolean(roomCode);

  matchRef.current = match;

  const applyMatch = (next: MatchState | null) => {
    if (!next) return;
    const normalized = normalizeMatch(next);
    matchRef.current = normalized;
    setMatch(normalized);
  };

  const applyMergedRemote = (remote: MatchState) => {
    const merged = mergeRoomMatch(matchRef.current, remote);
    matchRef.current = merged;
    setMatch(merged);
  };

  const enqueueRoomWrite = (task: () => Promise<void>) => {
    writeChainRef.current = writeChainRef.current.then(task).catch(() => {
      /* keep chain alive */
    });
  };

  const goLobby = () => {
    if (onExit) onExit();
    else {
      exitToLobby();
      router.replace(ROUTES.GAME);
    }
  };

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useGameLobbyStore.persist.onFinishHydration(finish);
    if (useGameLobbyStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    return subscribeRoom(roomCode, (next) => {
      setRoom(next);
      setRoomError(null);
      if (!next.match) return;
      const remote = normalizeMatch(next.match);
      setMatch((local) => {
        const merged = mergeRoomMatch(local, remote);
        matchRef.current = merged ?? local;
        return merged;
      });
    });
  }, [roomCode]);

  const playerTeam = useMemo(() => resolveFighters(teamIds), [teamIds]);
  const needsTeam = playerTeam.length < TEAM_SIZE;

  const foeIds = useMemo(() => {
    if (pvp) return room?.guestTeam ?? [];
    const stored = resolveFighters(shadeIds).map((fighter) => fighter.id);
    if (stored.length === 3) return stored;
    return pickShadeTeam(teamIds, FIGHTERS).map((fighter) => fighter.id);
  }, [pvp, room?.guestTeam, shadeIds, teamIds]);

  const seatedSide = pvp && room && user ? seatFor(room, user.uid) : null;
  const mySide: SideId = seatedSide ?? 'player';
  const seatMissing = Boolean(pvp && room && user && !seatedSide);
  const foeSide = otherSide(mySide);

  useEffect(() => {
    if (!pvp || !hydrated) return;
    if (!needsTeam) return;
    if (room && rememberedSeat(room.code) === 'host' && room.status === 'waiting') return;
    if (!room) {
      setRoomError(`Seal ${TEAM_SIZE} fighters on the Game scroll, then join this gate again.`);
    }
  }, [pvp, hydrated, needsTeam, room]);

  useEffect(() => {
    if (!hydrated) return;
    if (!pvp && playerTeam.length < TEAM_SIZE) goLobby();
  }, [hydrated, pvp, playerTeam.length]);

  useEffect(() => {
    if (pvp || !hydrated || playerTeam.length < TEAM_SIZE) return;
    if (shadeIds.length !== 3) {
      const ids = foeIds.length === 3 ? foeIds : pickShadeTeam(teamIds, FIGHTERS).map((f) => f.id);
      setShadeIds(ids);
      return;
    }
    if (!match && foeIds.length === 3) {
      setMatch(createMatch(teamIds, foeIds));
    }
  }, [pvp, hydrated, playerTeam.length, shadeIds.length, foeIds, match, teamIds, setShadeIds]);

  // Block browser back during an active fight — ask to surrender instead of flipping views.
  useEffect(() => {
    if (!match || match.winner) return;
    const pushGuard = () => {
      try {
        window.history.pushState({ vaBattle: true }, '', window.location.href);
      } catch {
        /* ignore */
      }
    };
    pushGuard();
    const onPop = () => {
      pushGuard();
      setLeavePrompt(true);
    };
    window.addEventListener('popstate', onPop);
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [match?.seed, match?.winner]);

  useEffect(() => {
    if (!pvp || authLoading) return;
    if (!user) openAuthModal('login');
  }, [pvp, authLoading, user, openAuthModal]);

  useEffect(() => {
    if (!pvp || !roomCode || !room || !user || joiningRef.current) return;
    if (room.status !== 'waiting') return;
    if (room.hostUid === user.uid && rememberedSeat(room.code) !== 'guest') return;
    if (playerTeam.length < TEAM_SIZE) {
      setRoomError(`Seal ${TEAM_SIZE} fighters before you join.`);
      return;
    }
    joiningRef.current = true;
    void joinRoom(roomCode, {
      uid: user.uid,
      name: arenaName(),
      team: teamIds,
    }).catch((error: unknown) => {
      joiningRef.current = false;
      setRoomError(error instanceof Error ? error.message : 'Could not join that gate.');
    });
  }, [pvp, roomCode, room, user, playerTeam.length, teamIds, arenaName]);

  useEffect(() => {
    if (match) rngRef.current = mulberry32(match.seed + match.echo * 997);
  }, [match]);

  useEffect(() => {
    if (!match) return;
    endSfxDone.current = false;
  }, [match?.seed]);

  useEffect(() => {
    if (!match?.combatEvents?.length) return;
    // Stamp by finished echo: after resolve, echo may already have advanced.
    const stamp = match.log.filter((line) => line.includes('hit') || line.includes('sealed') || line.includes('combo')).slice(-3).join('|');
    const key = `${match.seed}-${match.echo}-${match.combatEvents.map((e) => e.kind).join(',')}-${stamp}`;
    if (lastSfxKey.current === key) return;
    lastSfxKey.current = key;
    void playCombatFromPerspective(match.combatEvents, mySide);
  }, [match?.seed, match?.echo, match?.combatEvents, match?.log, mySide]);

  useEffect(() => {
    if (!match?.winner || endSfxDone.current) return;
    endSfxDone.current = true;
    if (match.winner === 'draw') return;
    if (match.winner === mySide) void playVictory();
    else void playDefeat();
  }, [match?.winner, mySide]);

  const lockEcho = () => {
    if (lockingRef.current) return;
    if (seatMissing) {
      setNotice('Seat not assigned — rejoin the gate.');
      return;
    }
    lockingRef.current = true;
    setPending(null);
    setNotice(null);
    const current = matchRef.current;
    if (!current || current.phase !== 'pick' || current.winner) {
      lockingRef.current = false;
      return;
    }
    if ((current.activeSide ?? 'player') !== mySide) {
      lockingRef.current = false;
      return;
    }
    const expected = {
      echo: current.echo,
      activeSide: mySide,
      matchRev: current.matchRev ?? 0,
    };
    const resolved = commitTurn(current, mySide, rngRef.current);
    // Optimistic bump so stale remote queue echoes cannot overwrite us.
    const optimistic = normalizeMatch({ ...resolved, matchRev: expected.matchRev + 1 });
    matchRef.current = optimistic;
    setMatch(optimistic);

    if (pvp && roomCode) {
      enqueueRoomWrite(async () => {
        const result = await commitTurnWrite(roomCode, mySide, expected, resolved);
        if (result.match) applyMergedRemote(result.match);
        else if (result.reason === 'stale' || result.reason === 'not-your-turn') {
          setNotice('Turn sync lagged — board refreshed.');
        }
        lockingRef.current = false;
      });
      return;
    }
    lockingRef.current = false;
  };

  useEffect(() => {
    lockEchoRef.current = lockEcho;
  });

  // Clear lock gate when the turn hands off (PvP only — bot uses lockingRef during think).
  useEffect(() => {
    if (pvp) lockingRef.current = false;
  }, [pvp, match?.activeSide, match?.echo]);

  // Shared clock for deadline countdown (both seats see the same timer).
  useEffect(() => {
    if (match?.phase !== 'pick' || match.winner) return;
    const id = window.setInterval(() => setClockMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [match?.phase, match?.winner, match?.echo, match?.activeSide]);

  // Auto-lock once when the absolute deadline hits on our turn.
  useEffect(() => {
    if (!match || match.phase !== 'pick' || match.winner) return;
    if ((match.activeSide ?? 'player') !== mySide) return;
    if (seatMissing) return;
    const left = secondsRemaining(match, clockMs);
    if (left > 0) return;
    const key = `${match.seed}-${match.echo}-${match.activeSide}-${match.matchRev ?? 0}`;
    if (autoLockKeyRef.current === key) return;
    autoLockKeyRef.current = key;
    lockEchoRef.current();
  }, [clockMs, match, mySide, seatMissing]);

  // First battle: open the guided coach once.
  useEffect(() => {
    if (!match || match.winner) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(TUTORIAL_KEYS.battle) === '1') return;
    setHelp(true);
  }, [match?.seed]);

  // Bot takes a human-paced thinking turn.
  useEffect(() => {
    if (pvp || !match || match.winner || match.phase !== 'pick') {
      setBotStatus(null);
      return;
    }
    if ((match.activeSide ?? 'player') !== 'foe') {
      setBotStatus(null);
      return;
    }
    if (lockingRef.current) return;
    lockingRef.current = true;

    const thinkMs = 2800 + Math.floor(Math.random() * 1600);
    const lines = ['Shade is reading the board…', 'Shade is picking jutsu…', 'Shade locks in…'];
    setBotStatus(lines[0]!);
    const tick = window.setInterval(() => {
      setBotStatus((current) => {
        const index = lines.indexOf(current ?? lines[0]!);
        return lines[Math.min(index + 1, lines.length - 1)]!;
      });
    }, Math.max(900, Math.floor(thinkMs / 3)));

    const id = window.setTimeout(() => {
      window.clearInterval(tick);
      setBotStatus('Shade attacks!');
      setMatch((latest) => {
        if (!latest || latest.winner || (latest.activeSide ?? 'player') !== 'foe') {
          lockingRef.current = false;
          setBotStatus(null);
          return latest;
        }
        const withBot = pickBotQueue(latest, rngRef.current);
        lockingRef.current = false;
        window.setTimeout(() => setBotStatus(null), 600);
        return commitTurn(withBot, 'foe', rngRef.current);
      });
    }, thinkMs);

    return () => {
      window.clearTimeout(id);
      window.clearInterval(tick);
      lockingRef.current = false;
    };
  }, [pvp, match?.activeSide, match?.echo, match?.phase, match?.winner]);

  const myTeamIds = pvp && room ? (mySide === 'player' ? room.hostTeam : room.guestTeam ?? teamIds) : teamIds;
  const selected =
    getFighter(
      selectedId && myTeamIds.includes(selectedId) ? selectedId : myTeamIds[0] ?? ''
    ) ?? getFighter(myTeamIds[0] ?? '');

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice('Copy failed — select the code yourself.');
    }
  };

  if (pvp && (authLoading || !hydrated)) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen items-center justify-center bg-[#14301f] text-amber-100">Opening the gate…</div>
      </>
    );
  }

  if (pvp && !user) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14301f] px-4 text-amber-100">
          <p>Log in to enter a private gate.</p>
          <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold" onClick={() => openAuthModal('login')}>
            Sign in
          </button>
        </div>
      </>
    );
  }

  if (pvp && roomError) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14301f] px-4 text-center text-amber-100">
          <p>{roomError}</p>
          <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold" onClick={() => goLobby()}>
            Pick fighters on Game
          </button>
        </div>
      </>
    );
  }

  if (pvp && hydrated && needsTeam && !(room && rememberedSeat(room.code) === 'host' && room.status === 'waiting')) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14301f] px-4 text-center text-amber-100">
          <p className="text-lg font-black">Seal {TEAM_SIZE} fighters first</p>
          <p className="max-w-sm text-sm text-amber-100/70">
            Multiplayer gates need a full team. Pick three on the Game scroll, then create or join again.
          </p>
          <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold" onClick={() => goLobby()}>
            Back to scroll
          </button>
        </div>
      </>
    );
  }

  if (pvp && room && room.status === 'waiting') {
    return (
      <>
        <Header />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#14301f] px-4 text-center text-amber-50">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Private Gate</p>
          <h1 className="text-2xl font-black">Waiting for a challenger</h1>
          <p className="font-mono text-4xl font-black tracking-[0.35em] text-amber-200">{room.code}</p>
          <div className="flex justify-center gap-2">
            {room.hostTeam.map((id) => {
              const fighter = getFighter(id);
              if (!fighter) return null;
              return (
                <div key={id} className="relative h-16 w-14 overflow-hidden rounded-md border border-amber-200/30">
                  <FighterArt fighter={fighter} sizes="56px" />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold uppercase tracking-widest"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <p className="max-w-sm text-sm text-amber-100/70">
            Friend must seal 3 fighters, log in, then Join with this code.
            {room.transport !== 'firestore' ? ' Local tab mode until Firestore rules are live.' : ''}
          </p>
          <button
            type="button"
            className="text-sm text-orange-200 underline"
            onClick={() => {
              if (user && roomCode) void cancelRoom(roomCode, user.uid);
              goLobby();
            }}
          >
            Cancel gate
          </button>
          <MusicToggle />
        </div>
      </>
    );
  }

  if (!hydrated || !match || (pvp && !room?.match)) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen items-center justify-center bg-[#14301f] text-amber-100">
          {pvp ? 'Waiting on the other side…' : 'Opening the gate…'}
        </div>
      </>
    );
  }

  const me = match.sides[mySide];
  const foe = match.sides[foeSide];
  const leftover = remainingWeaveAfterQueue(me);
  const aimTargetIds = new Set(
    me.queue.map((item) => item.targetId).filter((id): id is string => Boolean(id))
  );
  const aimedFoe =
    [...aimTargetIds]
      .map((id) => (foe.fighterIds.includes(id) ? getFighter(id) : null))
      .find(Boolean) ?? null;
  const showcase = aimedFoe ?? getFighter(match.lastCasterId ?? '') ?? selected;
  const displayName = arenaName();
  const foeName = pvp ? (mySide === 'player' ? room?.guestName : room?.hostName) ?? 'Challenger' : 'Shade';
  const targeting = pending ? legalTargets(match, mySide, pending.fighterId, pending.art) : [];
  const strategy = battleStrategyTip(match, mySide);
  const iWon = match.winner === mySide;

  const tryQueue = (fighter: Fighter, art: Art, targetId: string | null) => {
    if (match.phase !== 'pick' || match.winner) return;
    if (lockingRef.current) return;
    if (seatMissing) {
      setNotice('Seat not assigned — rejoin the gate.');
      return;
    }
    if ((match.activeSide ?? 'player') !== mySide) {
      setNotice("Not your turn.");
      return;
    }
    const queued = me.queue.some((item) => item.fighterId === fighter.id && item.artId === art.id);
    if (queued) {
      const next = unqueueArt(match, mySide, fighter.id, art.id);
      applyMatch(next);
      if (pvp && roomCode) {
        enqueueRoomWrite(async () => {
          const latest = matchRef.current;
          if (!latest || (latest.activeSide ?? 'player') !== mySide || latest.winner) return;
          const expected = {
            echo: latest.echo,
            activeSide: mySide,
            matchRev: latest.matchRev ?? 0,
          };
          const result = await patchMySide(roomCode, mySide, expected, {
            queue: latest.sides[mySide].queue,
            weave: latest.sides[mySide].weave,
          });
          if (result.match) {
            applyMergedRemote(result.match);
          }
        });
      }
      setPending(null);
      return;
    }
    if (needsExplicitTarget(art.target) && !targetId) {
      setPending({ fighterId: fighter.id, art });
      setSelectedId(fighter.id);
      setNotice(
        art.target === 'enemy'
          ? `${art.name}: tap an ENEMY on the right (not your team).`
          : `${art.name}: tap an ALLY on the left.`
      );
      return;
    }
    const error = queueError(match, mySide, fighter.id, art.id, targetId);
    if (error) {
      setNotice(error);
      return;
    }
    void playUiClick();
    const next = queueArt(match, mySide, fighter.id, art.id, targetId);
    applyMatch(next);
    if (pvp && roomCode) {
      enqueueRoomWrite(async () => {
        const latest = matchRef.current;
        if (!latest || (latest.activeSide ?? 'player') !== mySide || latest.winner) return;
        const expected = {
          echo: latest.echo,
          activeSide: mySide,
          matchRev: latest.matchRev ?? 0,
        };
        const result = await patchMySide(roomCode, mySide, expected, {
          queue: latest.sides[mySide].queue,
          weave: latest.sides[mySide].weave,
        });
        if (result.match) {
          applyMergedRemote(result.match);
        }
      });
    }
    setPending(null);
    setSelectedId(fighter.id);
    if (targetId) {
      const targetName = getFighter(targetId)?.name ?? 'target';
      setNotice(
        art.target === 'ally'
          ? `${art.name} → ${targetName} (ally)`
          : `${art.name} → ${targetName} (locked on)`
      );
    } else {
      setNotice(null);
    }
  };

  const surrender = (andLeave = false) => {
    if (!match || match.winner) {
      goLobby();
      return;
    }
    if (!andLeave && !window.confirm('Surrender this match? Your opponent wins.')) return;
    if (pvp && roomCode) {
      void surrenderRoom(roomCode, mySide).then((next) => {
        if (next) setMatch(normalizeMatch(next));
        if (andLeave) goLobby();
      });
      return;
    }
    setMatch(forfeitMatch(match, mySide));
    if (andLeave) window.setTimeout(() => goLobby(), 350);
  };

  const myTurn =
    match.phase === 'pick' &&
    (match.activeSide ?? 'player') === mySide &&
    !match.winner &&
    !seatMissing;
  const opponentTurn =
    match.phase === 'pick' && (match.activeSide ?? 'player') !== mySide && !match.winner;
  const displaySeconds = secondsRemaining(match, clockMs);
  const timerLabel = `${String(Math.floor(displaySeconds / 10))}${String(displaySeconds % 10)}`;
  const selectedArt =
    pending?.art ??
    (selected
      ? getFighterArts(selected).find((art) =>
          me.queue.some((item) => item.fighterId === selected.id && item.artId === art.id)
        ) ?? getFighterArts(selected)[0]
      : null);
  const selectedUnit = selected ? me.units[selected.id] : null;

  const clickUnit = (side: SideId, fighterId: string) => {
    if (!myTurn) {
      setNotice('Wait for your turn.');
      return;
    }

    const aimArt = pending?.art ?? null;
    const aimOwner = pending ? getFighter(pending.fighterId) : null;

    if (aimArt && aimOwner) {
      const wantsEnemy = aimArt.target === 'enemy';
      const wantsAlly = aimArt.target === 'ally';

      if (wantsEnemy && side === mySide) {
        setPending(null);
        setSelectedId(fighterId);
        setNotice('Selected caster. ATK powers aim at enemies on the right.');
        return;
      }
      if (wantsAlly && side === foeSide) {
        setNotice('Heals and buffs only work on YOUR team (left).');
        return;
      }

      const ok = targeting.some((unit) => unit.id === fighterId);
      if (!ok) {
        setNotice(wantsEnemy ? 'Tap a glowing enemy on the right.' : 'Tap a glowing ally on the left.');
        return;
      }
      tryQueue(aimOwner, aimArt, fighterId);
      return;
    }

    if (side === mySide) {
      if (selected && selectedArt && selectedArt.target === 'ally' && needsExplicitTarget(selectedArt.target)) {
        const ok = legalTargets(match, mySide, selected.id, selectedArt).some((unit) => unit.id === fighterId);
        if (ok && selected.id !== fighterId) {
          tryQueue(selected, selectedArt, fighterId);
          return;
        }
      }
      setSelectedId(fighterId);
      setPending(null);
      return;
    }

    if (side === foeSide) {
      if (selected && selectedArt && selectedArt.target === 'enemy' && needsExplicitTarget(selectedArt.target)) {
        const ok = legalTargets(match, mySide, selected.id, selectedArt).some((unit) => unit.id === fighterId);
        if (!ok) {
          setNotice('That enemy is not a legal target.');
          return;
        }
        tryQueue(selected, selectedArt, fighterId);
        return;
      }
      setNotice('Pick an ATK power first, then tap an enemy on the right.');
    }
  };

  const turnBanner = match.winner
    ? 'Match over'
    : myTurn
      ? pending
        ? pending.art.target === 'enemy'
          ? 'YOUR TURN — tap an ENEMY on the right'
          : pending.art.target === 'ally'
            ? 'YOUR TURN — tap an ALLY on the left'
            : `YOUR TURN — tap a glowing ${pending.art.target}`
        : me.queue.length
          ? 'YOUR TURN — add powers or press Attack'
          : 'YOUR TURN — pick fighter + power'
      : opponentTurn
        ? botStatus
          ? `OPPONENT'S TURN — ${botStatus}`
          : `OPPONENT'S TURN — ${foeName} is thinking`
        : '…';
  const foeTeam = resolveFighters(foe.fighterIds);
  const readyLabel = opponentTurn ? (botStatus ?? "Opponent's turn") : 'Press when ready';


  return (
    <>
      <Header />
      <HowToPlay
        open={help}
        variant="battle"
        onClose={() => {
          window.localStorage.setItem(TUTORIAL_KEYS.battle, '1');
          setHelp(false);
        }}
      />
      <div className="game-battle relative min-h-screen overflow-x-hidden bg-[#0d2818] text-amber-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(74,222,128,0.12),transparent_45%),linear-gradient(180deg,#1a3d28_0%,#0d2818_55%,#081810_100%)]" />

        <div className="relative mx-auto flex max-w-[1280px] flex-col gap-1 p-2 pb-2 sm:p-3">
          <header className="grid items-center gap-x-2 gap-y-1 rounded border border-[#8a6a3b]/70 bg-black/55 px-2 py-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-amber-200/40">
                {selected ? (
                  <FighterArt fighter={selected} sizes="32px" />
                ) : (
                  <span className="block h-full w-full bg-emerald-950" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase leading-tight tracking-wide">{displayName}</p>
                <p className="truncate text-[9px] uppercase leading-tight tracking-wider text-amber-200/65">
                  {gameTitle || 'Academy'} · {match.echo}/{match.maxEcho}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  'w-full max-w-md rounded-sm px-2 py-0.5 text-center text-[10px] font-black uppercase tracking-[0.16em]',
                  myTurn && 'bg-red-700 text-white',
                  opponentTurn && 'bg-sky-800 text-sky-50',
                  !myTurn && !opponentTurn && 'bg-black/50 text-amber-100/80'
                )}
              >
                {turnBanner}
              </div>
              <div className="flex h-1.5 w-full max-w-md overflow-hidden rounded-sm bg-black/60">
                <div
                  className={cn('h-full transition-all', displaySeconds <= 10 ? 'bg-red-500' : 'bg-red-700')}
                  style={{ width: `${Math.max(4, (displaySeconds / 60) * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                <WeaveBank weave={leftover} size={16} />
                <p
                  className={cn(
                    'font-mono text-lg font-black leading-none',
                    displaySeconds <= 10 ? 'text-red-400' : 'text-amber-200'
                  )}
                >
                  {timerLabel}
                </p>
                <button
                  type="button"
                  onClick={lockEcho}
                  disabled={!myTurn}
                  className={cn(
                    'rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-40',
                    myTurn ? 'bg-gradient-to-r from-red-700 via-orange-600 to-red-700 ring-1 ring-amber-200/40' : 'bg-stone-700'
                  )}
                >
                  {myTurn ? 'Press when ready' : readyLabel}
                </button>
              </div>
              {myTurn && me.weave.length >= WEAVE_EXCHANGE_COST && (
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <span className="text-[8px] uppercase tracking-wider text-amber-200/55">
                    Ex {WEAVE_EXCHANGE_COST}→1
                  </span>
                  {EXCHANGE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={`Trade ${WEAVE_EXCHANGE_COST} Weave for 1 ${ENERGY_META[color].label}`}
                      onClick={() => {
                        if (lockingRef.current) return;
                        void playUiClick();
                        const next = exchangeWeave(match, mySide, color);
                        applyMatch(next);
                        if (pvp && roomCode) {
                          enqueueRoomWrite(async () => {
                            const latest = matchRef.current;
                            if (!latest || (latest.activeSide ?? 'player') !== mySide || latest.winner) return;
                            const expected = {
                              echo: latest.echo,
                              activeSide: mySide,
                              matchRev: latest.matchRev ?? 0,
                            };
                            const result = await patchMySide(roomCode, mySide, expected, {
                              queue: latest.sides[mySide].queue,
                              weave: latest.sides[mySide].weave,
                            });
                            if (result.match) applyMergedRemote(result.match);
                          });
                        }
                        setNotice(next.log[next.log.length - 1] ?? null);
                      }}
                      className="rounded border border-amber-200/25 bg-black/45 px-1 py-px text-[8px] font-bold uppercase text-amber-100"
                      style={{ boxShadow: `inset 0 0 0 1px ${ENERGY_META[color].color}55` }}
                    >
                      {ENERGY_META[color].short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-black uppercase leading-tight tracking-wide">{foeName}</p>
                <p className="truncate text-[9px] uppercase leading-tight tracking-wider text-amber-200/65">
                  {opponentTurn ? 'Acting' : 'Waiting'} · {pvp ? room?.code : 'Shade'}
                </p>
              </div>
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-red-300/40">
                {foeTeam[0] ? (
                  <FighterArt fighter={foeTeam[0]} sizes="32px" />
                ) : (
                  <span className="block h-full w-full bg-red-950" />
                )}
              </div>
            </div>
          </header>

          <div className="relative shrink-0">
            {showcase && (
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[32%] opacity-15 lg:block">
                <div className="relative h-full min-h-[160px] w-full">
                  <FighterArt fighter={showcase} sizes="280px" className="h-full w-full" />
                </div>
              </div>
            )}

            <div className="relative z-[1] mb-1 flex justify-between gap-2 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/70">
                Your village · pick jutsu
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-200/70">
                Enemy · tap to target
              </p>
            </div>

            <ul className="relative z-[1] space-y-3">
              {me.fighterIds.map((id, index) => {
                const fighter = getFighter(id);
                const foeId = foe.fighterIds[index];
                const foeFighter = foeId ? getFighter(foeId) : null;
                if (!fighter) return null;
                return (
                  <li key={id} className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
                    <AllyRow
                      fighter={fighter}
                      unit={me.units[id]}
                      selected={selected?.id === id}
                      highlight={targeting.some((unit) => unit.id === id)}
                      targeted={aimTargetIds.has(id)}
                      queuedArtIds={me.queue.filter((item) => item.fighterId === id).map((item) => item.artId)}
                      focusedArtId={
                        pending?.fighterId === id
                          ? pending.art.id
                          : selected?.id === id
                            ? selectedArt?.id
                            : undefined
                      }
                      canAct={myTurn}
                      leftover={leftover}
                      onSelect={() => clickUnit(mySide, id)}
                      onArt={(art) => tryQueue(fighter, art, null)}
                    />
                    {foeFighter && foeId ? (
                      <EnemyRow
                        fighter={foeFighter}
                        unit={foe.units[foeId]}
                        highlight={targeting.some((unit) => unit.id === foeId)}
                        targeted={aimTargetIds.has(foeId)}
                        onSelect={() => clickUnit(foeSide, foeId)}
                      />
                    ) : (
                      <div />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {strategy && (
            <p className="shrink-0 truncate px-1 text-center text-[10px] text-amber-100/55">{strategy}</p>
          )}

          {/* NA bottom tray — sits directly under the roster */}
          <footer className="z-10 mt-1 shrink-0 border-t border-[#8a6a3b] bg-gradient-to-b from-[#c4a574] to-[#a8844a] p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:p-2.5">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-2 sm:flex-row sm:items-stretch">
              {/* Left rail — like NA surrender / settings + selected fighter */}
              <div className="flex shrink-0 items-end gap-2 sm:w-[150px] sm:flex-col sm:items-stretch">
                {selected && (
                  <div className="relative hidden h-[110px] w-[88px] overflow-hidden rounded-sm border-2 border-[#5c3d1e] shadow-md sm:block">
                    <FighterArt fighter={selected} sizes="88px" priority />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => surrender()}
                  className="rounded-sm border border-[#5c3d1e] bg-[#6b1d1d] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#f5e6c8] shadow"
                >
                  <span className="inline-flex items-center gap-1">
                    <Flag className="h-3.5 w-3.5" />
                    {match.winner ? 'Leave' : 'Surrender'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHelp(true)}
                  className="rounded-sm border border-[#5c3d1e] bg-[#3d2914] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#f5e6c8] shadow"
                >
                  <span className="inline-flex items-center gap-1">
                    <CircleHelp className="h-3.5 w-3.5" />
                    Help
                  </span>
                </button>
                <MusicToggle className="border-[#5c3d1e] bg-[#3d2914]/90 text-[#f5e6c8]" />
              </div>

              {/* Detail scroll — skill icon LEFT, copy flows horizontally (NA) */}
              <div className="game-parchment min-h-[128px] min-w-0 flex-1 overflow-hidden rounded-sm border-2 border-[#5c3d1e] p-3">
                {selectedArt && selected ? (
                  <div className="flex h-full gap-3 sm:gap-4">
                    <div className="shrink-0">
                      <div className="overflow-hidden rounded-sm border-2 border-[#8a6a3b] bg-[#1c1008] shadow-inner">
                        <SkillTile
                          art={selectedArt}
                          fighterId={selected.id}
                          size={96}
                          active
                          showName={false}
                          className="!max-w-none"
                        />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b3f18]">
                            {selected.name}
                          </p>
                          <h3 className="text-xl font-black uppercase leading-tight tracking-wide text-[#b91c1c] sm:text-2xl">
                            {selectedArt.name}
                          </h3>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b3f18]">
                            Energy
                          </span>
                          <WeaveCost cost={selectedArt.energy} size={18} />
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[#2a180c]">
                        {selectedArt.description}
                      </p>
                      {describeArtEffects(selectedArt).length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-[#3d2914]/90">
                          {describeArtEffects(selectedArt).slice(0, 3).map((line) => (
                            <li key={line}>• {line}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b3f18]">
                          Classes: {artClasses(selectedArt).join(', ')}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#6b3f18]">
                          Cooldown: {selectedArt.cooldown || 0}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] italic text-[#5c3d1e]/90">{targetHint(selectedArt)}</p>
                    </div>
                  </div>
                ) : selected ? (
                  <div className="flex h-full items-center gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm border-2 border-[#8a6a3b]">
                      <FighterArt fighter={selected} sizes="96px" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-black uppercase text-[#b91c1c]">{selected.name}</h3>
                      <p className="mt-1 text-sm text-[#2a180c]">
                        {selected.epithet} · {selected.role}. Tap a jutsu on their row to inspect it.
                      </p>
                      {selectedUnit && (
                        <p className="mt-2 font-mono text-xs text-[#3d2914]">
                          HP {selectedUnit.hp}/{selectedUnit.maxHp}
                          {selectedUnit.shield > 0 ? ` · shield ${selectedUnit.shield}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="flex h-full items-center text-sm text-[#3d2914]/80">
                    Select a fighter or jutsu to inspect.
                  </p>
                )}
              </div>
            </div>
          </footer>
        </div>

        {match.winner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-[#1c1008] p-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Gate closed</p>
              <h2 className="mt-2 text-3xl font-black">
                {match.winner === 'draw' ? 'Draw' : iWon ? 'Victory' : 'Defeat'}
              </h2>
              <p className="mt-2 text-sm text-amber-100/70">
                {match.endReason === 'surrender'
                  ? iWon
                    ? 'Opponent surrendered.'
                    : 'You surrendered.'
                  : match.log[match.log.length - 1]}
              </p>
              <button
                type="button"
                onClick={() => goLobby()}
                className="mt-5 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-black uppercase tracking-widest hover:bg-orange-500"
              >
                Back to scroll
              </button>
            </div>
          </div>
        )}

        {leavePrompt && !match.winner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-[#1c1008] p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Leave match?</p>
              <h2 className="mt-2 text-2xl font-black">Surrender to quit</h2>
              <p className="mt-2 text-sm text-amber-100/70">
                Leaving now counts as a loss. Stay in the fight or surrender and return to the scroll.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLeavePrompt(false);
                  surrender(true);
                }}
                className="mt-4 w-full rounded-xl bg-red-700 py-2.5 text-sm font-black uppercase tracking-widest hover:bg-red-600"
              >
                Surrender & leave
              </button>
              <button
                type="button"
                onClick={() => setLeavePrompt(false)}
                className="mt-2 w-full rounded-xl border border-amber-200/30 bg-black/40 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-black/60"
              >
                Keep fighting
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


function StatusPips({
  unit,
  align = 'start',
  extras,
}: {
  unit: UnitState;
  align?: 'start' | 'end';
  extras?: { key: string; node: ReactNode; title: string }[];
}) {
  const pips: { key: string; label: string; className: string; title: string }[] = [];
  if (unit.stun > 0)
    pips.push({ key: 'stun', label: 'ST', className: 'bg-violet-700 text-violet-50', title: `Stun ${unit.stun}` });
  if (unit.dodge > 0)
    pips.push({ key: 'dodge', label: 'DG', className: 'bg-teal-700 text-teal-50', title: 'Dodge' });
  if (unit.veil > 0)
    pips.push({ key: 'veil', label: 'VL', className: 'bg-slate-600 text-slate-50', title: `Veil ${unit.veil}` });
  if (unit.dr > 0)
    pips.push({
      key: 'dr',
      label: 'DR',
      className: 'bg-sky-800 text-sky-50',
      title: `DR −${unit.drAmount} (${unit.dr})`,
    });
  if (unit.mark > 0)
    pips.push({ key: 'mark', label: 'MK', className: 'bg-amber-700 text-amber-50', title: `Mark ${unit.mark}` });
  if (unit.burn > 0)
    pips.push({ key: 'burn', label: 'BR', className: 'bg-orange-700 text-orange-50', title: `Burn ${unit.burn}` });
  if (unit.tidebind > 0)
    pips.push({
      key: 'tide',
      label: 'BD',
      className: 'bg-cyan-800 text-cyan-50',
      title: `Bind ${unit.tidebind}`,
    });
  if (unit.shield > 0)
    pips.push({
      key: 'sh',
      label: `+${unit.shield}`,
      className: 'bg-emerald-800 text-emerald-50',
      title: `Shield ${unit.shield}`,
    });

  return (
    <div
      className={cn(
        'flex h-8 min-h-[2rem] flex-wrap items-end gap-0.5 pb-0.5',
        align === 'end' && 'justify-end'
      )}
    >
      {extras?.map((item) => (
        <span
          key={item.key}
          title={item.title}
          className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-sm border border-amber-200/40 bg-black/60"
        >
          {item.node}
        </span>
      ))}
      {pips.map((pip) => (
        <span
          key={pip.key}
          title={pip.title}
          className={cn(
            'inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-sm px-0.5 text-[9px] font-black leading-none',
            pip.className
          )}
        >
          {pip.label}
        </span>
      ))}
    </div>
  );
}

function AllyRow({
  fighter,
  unit,
  selected,
  highlight,
  targeted,
  queuedArtIds,
  focusedArtId,
  canAct,
  leftover,
  onSelect,
  onArt,
}: {
  fighter: Fighter;
  unit: UnitState;
  selected: boolean;
  highlight: boolean;
  targeted: boolean;
  queuedArtIds: string[];
  focusedArtId?: string;
  canAct: boolean;
  leftover: EnergyId[];
  onSelect: () => void;
  onArt: (art: Art) => void;
}) {
  const sealed = unit.hp <= 0;
  const arts = getFighterArts(fighter);
  const pct = Math.round((unit.hp / unit.maxHp) * 100);
  const bloodied = isBloodied(unit);
  const tile = 64;
  const queuedArts = arts.filter((art) => queuedArtIds.includes(art.id));

  return (
    <div className="pt-0">
      {/* items-end: parchment lines up with bottom of portrait + HP; status strip sits above */}
      <div className={cn('flex items-end gap-2', sealed && 'opacity-45')}>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'relative w-[88px] shrink-0 text-left sm:w-[96px]',
            selected && 'drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]'
          )}
        >
          <div
            className={cn(
              'relative h-[88px] w-[88px] overflow-hidden rounded-sm border-2 border-black sm:h-[96px] sm:w-[96px]',
              targeted && 'ring-2 ring-emerald-400',
              highlight && !targeted && 'ring-2 ring-amber-300 animate-pulse'
            )}
          >
            <FighterArt fighter={fighter} sizes="96px" />
          </div>
          <div className="relative mt-0 h-3 overflow-hidden rounded-sm border border-white/40 bg-white/90">
            <div
              className={cn('h-full', pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold leading-none text-black/80 drop-shadow-sm">
              {unit.hp}/{unit.maxHp}
              {bloodied ? '!' : ''}
            </span>
          </div>
        </button>

        {/* Width = cards only; status strip above parchment (NA used-power lane) */}
        <div className="flex w-fit max-w-full flex-col">
          <StatusPips
            unit={unit}
            extras={queuedArts.map((art) => ({
              key: art.id,
              title: `Queued · ${art.name}`,
              node: (
                <SkillTile art={art} fighterId={fighter.id} size={24} active showName={false} />
              ),
            }))}
          />

          <div className={cn('game-jutsu-scroll', selected && 'is-selected')}>
            <div className="game-jutsu-scroll-inner">
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-sm border border-black/40 bg-[#2a2a2a] text-lg font-black text-amber-100/40"
                style={{ width: tile, height: tile }}
                title="Aim / select slot"
              >
                {queuedArtIds.length > 0 ? '✓' : '?'}
              </span>

              {arts.map((art) => {
                const queued = queuedArtIds.includes(art.id);
                const cd = unit.cooldowns[art.id] ?? 0;
                const fighterBusy = !queued && queuedArtIds.length > 0;
                const affordable = queued || canAfford(leftover, art.energy);
                const focused = focusedArtId === art.id;
                return (
                  <button
                    key={art.id}
                    type="button"
                    disabled={!canAct || sealed || fighterBusy || (cd > 0 && !queued)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect();
                      onArt(art);
                    }}
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center p-0 leading-none disabled:opacity-40',
                      !affordable && 'opacity-50'
                    )}
                    style={{ width: tile, height: tile }}
                    title={art.name}
                  >
                    <SkillTile
                      art={art}
                      fighterId={fighter.id}
                      size={tile}
                      active={queued || focused}
                      cooldown={queued ? 0 : cd}
                      showName={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function EnemyRow({
  fighter,
  unit,
  highlight,
  targeted,
  onSelect,
}: {
  fighter: Fighter;
  unit: UnitState;
  highlight: boolean;
  targeted: boolean;
  onSelect: () => void;
}) {
  const sealed = unit.hp <= 0;
  const pct = Math.round((unit.hp / unit.maxHp) * 100);

  return (
    <div className="flex justify-end">
      <div className={cn('flex items-end gap-2', sealed && 'opacity-45')}>
        <div className="flex flex-col items-end">
          <StatusPips unit={unit} align="end" />
        </div>
        <button
          type="button"
          onClick={onSelect}
          className="relative w-[88px] shrink-0 sm:w-[96px]"
        >
          <div
            className={cn(
              'relative h-[88px] w-[88px] overflow-hidden rounded-sm border-2 border-black sm:h-[96px] sm:w-[96px]',
              targeted && 'ring-2 ring-red-400',
              highlight && !targeted && 'ring-2 ring-amber-300 animate-pulse'
            )}
          >
            {sealed ? (
              <span className="flex h-full w-full items-center justify-center bg-black/80 text-3xl font-black text-white/50">
                ✕
              </span>
            ) : (
              <FighterArt fighter={fighter} sizes="96px" />
            )}
            {targeted && (
              <span className="absolute right-0.5 top-0.5 rounded bg-red-600 px-1 text-[8px] font-black uppercase text-white">
                Target
              </span>
            )}
          </div>
          <div className="relative mt-0 h-3 overflow-hidden rounded-sm border border-white/40 bg-white/90">
            <div
              className={cn('h-full', pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold leading-none text-black/80">
              {sealed ? '0' : unit.hp}/{unit.maxHp}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
