'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, CircleHelp, Copy, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FighterArt } from '@/components/game/FighterArt';
import { WeaveCost, WeavePip } from '@/components/game/WeavePips';
import { HowToPlay, TUTORIAL_KEYS } from '@/components/game/HowToPlay';
import { MusicToggle } from '@/components/game/MusicToggle';
import { SkillIcon, describeArtEffects, skillFamily, targetHint } from '@/components/game/SkillIcon';
import { ENERGY_META, FIGHTERS, TEAM_SIZE, getFighter, getFighterArts } from '@/lib/game/roster';
import { pickShadeTeam } from '@/lib/game/team-rules';
import { battleStrategyTip } from '@/lib/game/strategy';
import {
  type ArenaRoom,
  cancelRoom,
  joinRoom,
  rememberedSeat,
  seatFor,
  subscribeRoom,
  surrenderRoom,
  writeMatch,
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
  tickTimer,
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
  return {
    ...match,
    sides,
    activeSide: match.activeSide ?? 'player',
    combatEvents: match.combatEvents ?? [],
    endReason: match.endReason ?? null,
    lastGranted: match.lastGranted ?? { player: [], foe: [] },
    channels: match.channels ?? [],
  };
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
  const rngRef = useRef(() => Math.random());
  const lastSfxKey = useRef('');
  const endSfxDone = useRef(false);
  const pvp = Boolean(roomCode);

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
      if (next.match) setMatch(normalizeMatch(next.match));
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

  const mySide: SideId = pvp && room && user ? seatFor(room, user.uid) ?? 'player' : 'player';
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
    lockingRef.current = true;
    setPending(null);
    setNotice(null);
    setMatch((current) => {
      if (!current || current.phase !== 'pick' || current.winner) {
        lockingRef.current = false;
        return current;
      }
      if ((current.activeSide ?? 'player') !== mySide) {
        lockingRef.current = false;
        return current;
      }
      const resolved = commitTurn(current, mySide, rngRef.current);
      if (pvp && roomCode) void writeMatch(roomCode, resolved);
      lockingRef.current = false;
      return resolved;
    });
  };

  useEffect(() => {
    lockEchoRef.current = lockEcho;
  });

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

  const pickPhase = match?.phase;
  const activeSide = match?.activeSide;
  const echo = match?.echo;

  useEffect(() => {
    if (pickPhase !== 'pick' || !match) return;
    if ((activeSide ?? 'player') !== mySide) return;
    const id = window.setInterval(() => {
      setMatch((current) => {
        if (!current || current.phase !== 'pick' || current.winner) return current;
        if ((current.activeSide ?? 'player') !== mySide) return current;
        const ticked = tickTimer(current);
        if (ticked.secondsLeft > 0) return ticked;
        window.setTimeout(() => lockEchoRef.current(), 0);
        return ticked;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pickPhase, activeSide, echo, mySide, match]);

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
    if ((match.activeSide ?? 'player') !== mySide) {
      setNotice("Not your turn.");
      return;
    }
    const queued = me.queue.some((item) => item.fighterId === fighter.id && item.artId === art.id);
    if (queued) {
      const next = unqueueArt(match, mySide, fighter.id, art.id);
      setMatch(next);
      if (pvp && roomCode) void writeMatch(roomCode, next, { mine: mySide });
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
    setMatch(next);
    if (pvp && roomCode) void writeMatch(roomCode, next, { mine: mySide });
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

  const myTurn = match.phase === 'pick' && (match.activeSide ?? 'player') === mySide && !match.winner;
  const opponentTurn = match.phase === 'pick' && (match.activeSide ?? 'player') !== mySide && !match.winner;
  const timerLabel = `${String(Math.floor(match.secondsLeft / 10))}${String(match.secondsLeft % 10)}`;
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
      <div className="game-battle relative min-h-screen overflow-x-hidden bg-[#14301f] text-amber-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(74,222,128,0.18),transparent_50%),linear-gradient(180deg,#1c4d2a_0%,#14301f_55%,#0c1f14_100%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col gap-2 p-2 sm:p-3">
          <header className="grid items-center gap-2 rounded-xl border border-emerald-900/60 bg-black/45 px-3 py-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-wider">{displayName}</p>
              <p className="text-[10px] uppercase text-emerald-200/70">
                {gameTitle} · {pvp ? `Private ${room?.code}` : lastMode === 'ranked' ? 'Ranked' : 'Quick Duel'} · Echo{' '}
                {match.echo}/{match.maxEcho}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[10px] uppercase text-amber-200/60">Jutsu bank</span>
                {leftover.map((energy, index) => (
                  <WeavePip key={`${energy}-${index}`} energy={energy} size={16} />
                ))}
                {leftover.length === 0 && <span className="text-[10px] text-amber-200/50">empty</span>}
              </div>
              {(match.lastGranted?.[mySide]?.length ?? 0) > 0 && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-200/70">
                  <span>+Echo</span>
                  {match.lastGranted[mySide].map((energy, index) => (
                    <WeavePip key={`g-${energy}-${index}`} energy={energy} size={12} />
                  ))}
                  <span className="normal-case tracking-normal text-amber-100/50">
                    ·{' '}
                    {match.echo <= 1
                      ? mySide === 'player'
                        ? 'Ash Rule: you 1 · foe 3'
                        : 'Ash Rule: you 3 · foe 1'
                      : '1 per living'}{' '}
                    · bank for 3-cost spikes
                  </span>
                </div>
              )}
              {myTurn && me.weave.length >= WEAVE_EXCHANGE_COST && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-amber-200/55">
                    Exchange {WEAVE_EXCHANGE_COST}→1
                  </span>
                  {EXCHANGE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={`Trade ${WEAVE_EXCHANGE_COST} Weave for 1 ${ENERGY_META[color].label}`}
                      onClick={() => {
                        void playUiClick();
                        const next = exchangeWeave(match, mySide, color);
                        setMatch(next);
                        if (pvp && roomCode) void writeMatch(roomCode, next, { mine: mySide });
                        setNotice(next.log[next.log.length - 1] ?? null);
                      }}
                      className="rounded border border-amber-200/25 bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100 hover:border-amber-300/50 hover:bg-black/65"
                      style={{ boxShadow: `inset 0 0 0 1px ${ENERGY_META[color].color}55` }}
                    >
                      {ENERGY_META[color].short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'rounded-lg px-3 py-1 text-center text-[11px] font-black uppercase tracking-[0.18em]',
                  myTurn && 'bg-red-700 text-white animate-pulse',
                  opponentTurn && 'bg-sky-800 text-sky-50',
                  match.winner && 'bg-black/50 text-amber-100/80',
                  !myTurn && !opponentTurn && !match.winner && 'bg-black/50 text-amber-100/80'
                )}
              >
                {turnBanner}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-amber-200/60">Timer</p>
                  <p
                    className={cn(
                      'font-mono text-3xl font-black leading-none',
                      match.secondsLeft <= 10 ? 'text-red-400' : 'text-amber-200'
                    )}
                  >
                    {timerLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={lockEcho}
                  disabled={!myTurn}
                  className={cn(
                    'rounded-lg px-5 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg disabled:opacity-40',
                    myTurn
                      ? 'bg-gradient-to-r from-red-700 via-orange-600 to-red-700 ring-2 ring-amber-200/50'
                      : 'bg-stone-700'
                  )}
                >
                  {myTurn ? 'Attack / Ready' : readyLabel}
                </button>
              </div>
            </div>

            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-black uppercase tracking-wider">{foeName}</p>
              <p className="text-[10px] uppercase text-emerald-200/70">
                {opponentTurn ? 'Acting now' : 'Waiting'}
              </p>
            </div>
          </header>

          {pending && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-1.5 text-center text-xs font-bold text-amber-100">
              <span>
                {pending.art.target === 'enemy'
                  ? `Aim ${pending.art.name} → tap ENEMY (right)`
                  : pending.art.target === 'ally'
                    ? `Aim ${pending.art.name} → tap ALLY (left)`
                    : `Aim ${pending.art.name}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setNotice(null);
                }}
                className="rounded bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200 hover:bg-black/60"
              >
                Cancel
              </button>
            </div>
          )}
          {botStatus && (
            <p className="rounded-lg border border-sky-400/30 bg-sky-950/40 px-3 py-1.5 text-center text-xs font-bold text-sky-100">
              {botStatus}
            </p>
          )}

          <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_minmax(200px,0.65fr)_1fr]">
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">
                Your team · 1 jutsu / fighter{pending?.art.target === 'ally' ? ' · heal target' : ''}
              </p>
              <ul className="space-y-2">
                {me.fighterIds.map((id) => {
                  const fighter = getFighter(id);
                  if (!fighter) return null;
                  return (
                    <FighterRow
                      key={id}
                      fighter={fighter}
                      unit={me.units[id]}
                      side="player"
                      selected={selected?.id === id}
                      highlight={targeting.some((unit) => unit.id === id)}
                      targeted={aimTargetIds.has(id)}
                      queuedArtIds={me.queue.filter((item) => item.fighterId === id).map((item) => item.artId)}
                      canAct={myTurn}
                      onSelect={() => clickUnit(mySide, id)}
                      onArt={(art) => tryQueue(fighter, art, null)}
                    />
                  );
                })}
              </ul>
            </section>

            <div className="relative order-first flex min-h-[200px] flex-col items-center justify-center gap-2 lg:order-none">
              {showcase && (
                <div
                  className={cn(
                    'relative h-[220px] w-[170px] overflow-hidden rounded-2xl border-2 shadow-2xl sm:h-[280px] sm:w-[210px]',
                    aimedFoe ? 'border-red-400 ring-2 ring-red-400/50' : 'border-amber-200/40'
                  )}
                >
                  <FighterArt fighter={showcase} sizes="210px" priority />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-center text-xs font-black">
                    {aimedFoe ? `Target · ${showcase.name}` : showcase.name}
                  </span>
                </div>
              )}
              <p className="max-w-[240px] text-center text-[11px] leading-snug text-amber-100/75">{notice ?? strategy}</p>
              {me.queue.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {me.queue.map((item) => {
                    const owner = getFighter(item.fighterId);
                    if (!owner) return null;
                    const art = getFighterArts(owner).find((a) => a.id === item.artId);
                    if (!art) return null;
                    const targetName = item.targetId ? getFighter(item.targetId)?.name : null;
                    return (
                      <div
                        key={`${item.fighterId}-${item.artId}`}
                        className="flex flex-col items-center gap-0.5 rounded-lg border border-orange-400/40 bg-black/50 px-1.5 py-1"
                      >
                        <SkillIcon art={art} size={36} active />
                        {targetName && (
                          <span className="max-w-[72px] truncate text-[8px] font-bold uppercase tracking-wide text-red-200">
                            → {targetName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <section className="space-y-2">
              <p className="px-1 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-red-200/70">
                Enemy team · powers visible · tap to attack
                {pending?.art.target === 'enemy' ? ' (glowing)' : ''}
              </p>
              <ul className="space-y-2">
                {foe.fighterIds.map((id) => {
                  const fighter = getFighter(id);
                  if (!fighter) return null;
                  return (
                    <FighterRow
                      key={id}
                      fighter={fighter}
                      unit={foe.units[id]}
                      side="foe"
                      selected={false}
                      highlight={targeting.some((unit) => unit.id === id)}
                      targeted={aimTargetIds.has(id)}
                      queuedArtIds={foe.queue.filter((item) => item.fighterId === id).map((item) => item.artId)}
                      canAct={false}
                      onSelect={() => clickUnit(foeSide, id)}
                      onArt={() => undefined}
                    />
                  );
                })}
              </ul>
            </section>
          </div>

          <footer className="sticky bottom-0 z-10 space-y-2 rounded-xl border border-[#8a6a3b] bg-[#2a180c]/95 p-2 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => surrender()}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-900 px-3 py-2 text-xs font-bold uppercase tracking-widest"
              >
                <Flag className="h-3.5 w-3.5" />
                {match.winner ? 'Leave' : 'Surrender'}
              </button>
              <button
                type="button"
                onClick={() => setHelp(true)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-widest"
              >
                <CircleHelp className="h-3.5 w-3.5" />
                Help
              </button>
              <MusicToggle className="border-white/10 bg-black/40" />
              {selected && (
                <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Powers — {selected.name}</p>
              )}
            </div>

            {selected && selectedUnit && (
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="flex flex-wrap gap-2">
                  {getFighterArts(selected).map((art) => {
                    const cd = selectedUnit.cooldowns[art.id] ?? 0;
                    const queued = me.queue.some((item) => item.fighterId === selected.id && item.artId === art.id);
                    const fighterBusy =
                      !queued && me.queue.some((item) => item.fighterId === selected.id);
                    const affordable = queued || canAfford(leftover, art.energy);
                    const focused = pending?.art.id === art.id || selectedArt?.id === art.id;
                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => tryQueue(selected, art, null)}
                        disabled={!myTurn || fighterBusy || (cd > 0 && !queued)}
                        title={fighterBusy ? 'This fighter already queued a jutsu this Echo' : undefined}
                        className={cn(
                          'flex min-w-[7.5rem] flex-1 items-start gap-2 rounded-lg border px-2 py-2 text-left disabled:opacity-40',
                          queued
                            ? 'border-orange-400 bg-orange-800/80'
                            : focused
                              ? 'border-amber-200 bg-amber-950/70'
                              : 'border-amber-200/20 bg-black/35 hover:bg-black/50',
                          !affordable && 'opacity-50'
                        )}
                      >
                        <SkillIcon art={art} size={42} active={queued || focused} cooldown={queued ? 0 : cd} />
                        <span className="min-w-0">
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-bold">{art.name}</span>
                            <WeaveCost cost={art.energy} size={11} />
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-amber-100/55">
                            {skillFamily(art)} · CD {art.cooldown || 0}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedArt && (
                  <div className="rounded-lg border border-amber-200/25 bg-black/40 p-3">
                    <div className="flex items-start gap-3">
                      <SkillIcon art={selectedArt} size={52} active />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Power detail</p>
                        <h3 className="text-base font-black text-amber-50">{selectedArt.name}</h3>
                        <p className="mt-1 text-sm leading-snug text-amber-100/85">{selectedArt.description}</p>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 border-t border-amber-200/15 pt-2 text-[12px] text-amber-100/80">
                      {describeArtEffects(selectedArt).map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-orange-300">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                      <li className="flex gap-2 text-amber-200/90">
                        <span className="text-orange-300">•</span>
                        <span>{targetHint(selectedArt)}</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-orange-300">•</span>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          Cost <WeaveCost cost={selectedArt.energy} size={12} /> · Cooldown {selectedArt.cooldown || 0}{' '}
                          Echo(es)
                        </span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}
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

function StatusBadges({ unit, align = 'start' }: { unit: UnitState; align?: 'start' | 'end' }) {
  const badges: { key: string; label: string; className: string }[] = [];
  if (unit.stun > 0) badges.push({ key: 'stun', label: `Stun ${unit.stun}`, className: 'bg-violet-700/90 text-violet-50' });
  if (unit.veil > 0) badges.push({ key: 'veil', label: `Veil ${unit.veil}`, className: 'bg-slate-600/90 text-slate-50' });
  if ((unit.dodge ?? 0) > 0) {
    badges.push({ key: 'dodge', label: `Dodge ${unit.dodge}`, className: 'bg-cyan-700/90 text-cyan-50' });
  }
  if ((unit.dr ?? 0) > 0) {
    badges.push({
      key: 'dr',
      label: `DR ${unit.drAmount || 8}`,
      className: 'bg-stone-600/90 text-amber-50',
    });
  }
  if (unit.burn > 0) badges.push({ key: 'burn', label: `Burn ${unit.burn}`, className: 'bg-orange-700/90 text-orange-50' });
  if (unit.mark > 0) badges.push({ key: 'mark', label: `Mark ${unit.mark}`, className: 'bg-rose-800/90 text-rose-50' });
  if (unit.tidebind > 0) {
    badges.push({ key: 'bind', label: `Bind ${unit.tidebind}`, className: 'bg-sky-800/90 text-sky-50' });
  }
  if (!badges.length) return null;
  return (
    <div className={cn('mt-1 flex flex-wrap gap-0.5', align === 'end' && 'justify-end')}>
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={cn('rounded px-1 py-px text-[8px] font-black uppercase tracking-wide', badge.className)}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function FighterRow({
  fighter,
  unit,
  side,
  selected,
  highlight,
  targeted,
  queuedArtIds,
  canAct,
  onSelect,
  onArt,
}: {
  fighter: Fighter;
  unit: UnitState;
  side: SideId;
  selected: boolean;
  highlight: boolean;
  targeted: boolean;
  queuedArtIds: string[];
  canAct: boolean;
  onSelect: () => void;
  onArt: (art: Art) => void;
}) {
  const sealed = unit.hp <= 0;
  const arts = getFighterArts(fighter);
  const pct = Math.round((unit.hp / unit.maxHp) * 100);
  const bloodied = isBloodied(unit);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'relative grid cursor-pointer items-center gap-2 rounded-lg border bg-black/40 p-1.5 transition hover:bg-black/55',
          side === 'foe'
            ? 'grid-cols-[minmax(0,1fr)_72px] sm:grid-cols-[minmax(0,1fr)_88px]'
            : 'grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)]',
          targeted && side === 'foe' && 'border-red-500 bg-red-950/50 ring-2 ring-red-400 shadow-[0_0_20px_rgba(248,113,113,0.35)]',
          targeted && side === 'player' && 'border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-300/70',
          !targeted && selected && 'border-orange-400 ring-1 ring-orange-400/40',
          !targeted && !selected && 'border-emerald-900/70',
          highlight && !targeted && 'ring-2 ring-amber-300 animate-pulse',
          sealed && 'opacity-45'
        )}
      >
        {targeted && (
          <span
            className={cn(
              'absolute -top-2 z-[2] rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow',
              side === 'foe' ? 'right-2 bg-red-600' : 'left-2 bg-emerald-600'
            )}
          >
            {side === 'foe' ? 'Target' : 'Buffed'}
          </span>
        )}
        {side === 'player' && (
          <div
            className={cn(
              'relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md sm:h-20 sm:w-[88px]',
              targeted && 'ring-2 ring-emerald-300'
            )}
          >
            <FighterArt fighter={fighter} sizes="88px" />
          </div>
        )}
        <div className={cn('min-w-0', side === 'foe' && 'text-right')}>
          <p className="truncate text-xs font-black uppercase">{fighter.name}</p>
          <p className="text-[9px] uppercase tracking-wider text-amber-100/50">{fighter.role}</p>
          <div className="mt-1 h-2.5 overflow-hidden rounded bg-emerald-950">
            <div className={cn('h-full', pct > 30 ? 'bg-emerald-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-0.5 font-mono text-[10px]">
            {unit.hp}/{unit.maxHp}
            {unit.shield > 0 ? ` +${unit.shield}` : ''}
            {bloodied ? ' · bloodied' : ''}
          </p>
          <StatusBadges unit={unit} align={side === 'foe' ? 'end' : 'start'} />
          <div className={cn('mt-1.5 flex flex-nowrap gap-1', side === 'foe' && 'justify-end')}>
            {arts.map((art) => {
              const queued = queuedArtIds.includes(art.id);
              const fighterBusy = !queued && queuedArtIds.length > 0;
              const cd = queued ? 0 : unit.cooldowns[art.id] ?? 0;
              return (
                <button
                  key={art.id}
                  type="button"
                  title={
                    fighterBusy
                      ? 'Already queued a jutsu this Echo'
                      : `${art.name}${cd > 0 ? ` · CD ${cd}` : ''}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onArt(art);
                  }}
                  disabled={!canAct || sealed || fighterBusy || (cd > 0 && !queued)}
                  className={cn(
                    'flex min-w-0 flex-1 basis-0 flex-col items-center gap-0.5 rounded border px-0.5 py-1 disabled:opacity-50',
                    queued
                      ? 'border-orange-400 bg-orange-900/70'
                      : 'border-amber-200/15 bg-black/35 hover:bg-black/55',
                    !canAct && 'cursor-default hover:bg-black/35'
                  )}
                >
                  <SkillIcon art={art} size={30} active={queued} cooldown={cd} />
                  <span className="w-full truncate text-center text-[8px] font-bold leading-tight sm:text-[9px]">
                    {art.name}
                  </span>
                  <span className="inline-flex items-center justify-center gap-0.5">
                    <WeaveCost cost={art.energy} size={9} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {side === 'foe' && (
          <div
            className={cn(
              'relative h-[72px] w-[72px] shrink-0 justify-self-end overflow-hidden rounded-md border border-emerald-800/80 bg-emerald-950/40 sm:h-20 sm:w-[88px]',
              targeted && 'border-red-400 ring-2 ring-red-400',
              highlight && !targeted && 'ring-2 ring-amber-300'
            )}
          >
            <FighterArt fighter={fighter} sizes="88px" />
            {targeted && (
              <span className="absolute inset-x-0 bottom-0 bg-red-700/90 py-0.5 text-center text-[8px] font-black uppercase tracking-wider text-white">
                Aimed
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
