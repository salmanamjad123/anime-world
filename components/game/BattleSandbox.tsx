'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, CircleHelp, Copy, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FighterArt } from '@/components/game/FighterArt';
import { WeaveCost, WeavePip } from '@/components/game/WeavePips';
import { HowToPlay } from '@/components/game/HowToPlay';
import { MusicToggle } from '@/components/game/MusicToggle';
import { SkillIcon, describeArtEffects, skillFamily, targetHint } from '@/components/game/SkillIcon';
import { FIGHTERS, TEAM_SIZE, getFighter, getFighterArts } from '@/lib/game/roster';
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
  canAfford,
  commitTurn,
  createMatch,
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
} from '@/lib/game/engine';
import { playCombatFromPerspective, playDefeat, playUiClick, playVictory } from '@/lib/game/sfx';
import { useGameLobbyStore } from '@/store/useGameLobbyStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { Art, Fighter } from '@/types/game';

function resolveFighters(ids: string[]): Fighter[] {
  return ids.map((id) => getFighter(id)).filter((fighter): fighter is Fighter => Boolean(fighter));
}

function normalizeMatch(match: MatchState): MatchState {
  return {
    ...match,
    activeSide: match.activeSide ?? 'player',
    combatEvents: match.combatEvents ?? [],
    endReason: match.endReason ?? null,
  };
}

export function BattleSandbox({ roomCode = null }: { roomCode?: string | null }) {
  const router = useRouter();
  const teamIds = useGameLobbyStore((s) => s.teamIds);
  const shadeIds = useGameLobbyStore((s) => s.shadeIds);
  const setShadeIds = useGameLobbyStore((s) => s.setShadeIds);
  const lastMode = useGameLobbyStore((s) => s.lastMode);
  const { user, isLoading: authLoading } = useUserStore();
  const openAuthModal = useAuthModalStore((s) => s.openAuthModal);
  const [hydrated, setHydrated] = useState(false);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ fighterId: string; art: Art } | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lockingRef = useRef(false);
  const lockEchoRef = useRef<() => void>(() => {});
  const joiningRef = useRef(false);
  const rngRef = useRef(() => Math.random());
  const lastSfxKey = useRef('');
  const endSfxDone = useRef(false);
  const pvp = Boolean(roomCode);

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

  useEffect(() => {
    if (!hydrated) return;
    if (!pvp && playerTeam.length < TEAM_SIZE) router.replace(ROUTES.GAME);
  }, [hydrated, pvp, playerTeam.length, router]);

  useEffect(() => {
    if (!pvp || !hydrated) return;
    if (!needsTeam) return;
    // Host who already created a room keeps waiting UI; guest must pick 3 first.
    if (room && rememberedSeat(room.code) === 'host' && room.status === 'waiting') return;
    if (!room) {
      setRoomError(`Seal ${TEAM_SIZE} fighters on the Game scroll, then join this gate again.`);
    }
  }, [pvp, hydrated, needsTeam, room]);

  const foeIds = useMemo(() => {
    if (pvp) return room?.guestTeam ?? [];
    const stored = resolveFighters(shadeIds).map((fighter) => fighter.id);
    if (stored.length === 3) return stored;
    return pickShadeTeam(teamIds, FIGHTERS).map((fighter) => fighter.id);
  }, [pvp, room?.guestTeam, shadeIds, teamIds]);

  const mySide: SideId = pvp && room && user ? seatFor(room, user.uid) ?? 'player' : 'player';
  const foeSide = otherSide(mySide);

  if (!pvp && hydrated && playerTeam.length >= 3 && shadeIds.length !== 3) {
    setShadeIds(foeIds);
  }
  if (!pvp && hydrated && playerTeam.length >= 3 && !match && foeIds.length === 3) {
    setMatch(createMatch(teamIds, foeIds));
  }

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
      name: user.displayName || user.email?.split('@')[0] || 'Challenger',
      team: teamIds,
    }).catch((error: unknown) => {
      joiningRef.current = false;
      setRoomError(error instanceof Error ? error.message : 'Could not join that gate.');
    });
  }, [pvp, roomCode, room, user, playerTeam.length, teamIds]);

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

  // Bot takes its turn after the player commits.
  useEffect(() => {
    if (pvp || !match || match.winner || match.phase !== 'pick') return;
    if ((match.activeSide ?? 'player') !== 'foe') return;
    if (lockingRef.current) return;
    lockingRef.current = true;
    const id = window.setTimeout(() => {
      setMatch((latest) => {
        if (!latest || latest.winner || (latest.activeSide ?? 'player') !== 'foe') {
          lockingRef.current = false;
          return latest;
        }
        const withBot = pickBotQueue(latest, rngRef.current);
        lockingRef.current = false;
        return commitTurn(withBot, 'foe', rngRef.current);
      });
    }, 1200);
    return () => {
      window.clearTimeout(id);
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
          <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold" onClick={() => router.push(ROUTES.GAME)}>
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
          <button type="button" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold" onClick={() => router.push(ROUTES.GAME)}>
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
              router.push(ROUTES.GAME);
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
  const showcase = getFighter(match.lastCasterId ?? '') ?? selected;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Guest';
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
      setNotice(`Choose a ${art.target} for ${art.name}.`);
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
    setNotice(null);
    setSelectedId(fighter.id);
  };

  const surrender = () => {
    if (match.winner) {
      router.push(ROUTES.GAME);
      return;
    }
    if (!window.confirm('Surrender this match? Your opponent wins.')) return;
    if (pvp && roomCode) {
      void surrenderRoom(roomCode, mySide).then((next) => {
        if (next) setMatch(normalizeMatch(next));
      });
      return;
    }
    setMatch(forfeitMatch(match, mySide));
  };

  const clickUnit = (side: SideId, fighterId: string) => {
    if (pending) {
      const ok = targeting.some((unit) => unit.id === fighterId);
      if (!ok) {
        setNotice('That is not a legal target.');
        return;
      }
      const fighter = getFighter(pending.fighterId);
      if (fighter) tryQueue(fighter, pending.art, fighterId);
      return;
    }
    if (side === foeSide && myTurn && selected && selectedArt && needsExplicitTarget(selectedArt.target)) {
      const ok = legalTargets(match, mySide, selected.id, selectedArt).some((unit) => unit.id === fighterId);
      if (!ok) {
        setNotice('That is not a legal target for this power.');
        return;
      }
      tryQueue(selected, selectedArt, fighterId);
      return;
    }
    if (side === mySide) {
      setSelectedId(fighterId);
    }
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
  const turnBanner = match.winner
    ? 'Match over'
    : myTurn
      ? pending
        ? `YOUR TURN — tap a glowing ${pending.art.target}`
        : me.queue.length
          ? 'YOUR TURN — add powers or press Attack'
          : 'YOUR TURN — pick fighter + power'
      : opponentTurn
        ? `OPPONENT'S TURN — ${foeName} is attacking`
        : '…';
  const readyLabel = opponentTurn ? "Opponent's turn" : 'Press when ready';

  return (
    <>
      <Header />
      <HowToPlay open={help} onClose={() => setHelp(false)} />
      <div className="game-battle relative min-h-screen overflow-x-hidden bg-[#14301f] text-amber-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(74,222,128,0.18),transparent_50%),linear-gradient(180deg,#1c4d2a_0%,#14301f_55%,#0c1f14_100%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col gap-2 p-2 sm:p-3">
          <header className="grid items-center gap-2 rounded-xl border border-emerald-900/60 bg-black/45 px-3 py-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-wider">{displayName}</p>
              <p className="text-[10px] uppercase text-emerald-200/70">
                {pvp ? `Private ${room?.code}` : lastMode === 'ranked' ? 'Ranked' : 'Quick Duel'} · Echo{' '}
                {match.echo}/{match.maxEcho}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[10px] uppercase text-amber-200/60">Weave</span>
                {leftover.map((energy, index) => (
                  <WeavePip key={`${energy}-${index}`} energy={energy} size={16} />
                ))}
                {leftover.length === 0 && <span className="text-[10px] text-amber-200/50">empty</span>}
              </div>
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
                      match.secondsLeft <= 5 ? 'text-red-400' : 'text-amber-200'
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
            <p className="rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-1.5 text-center text-xs font-bold text-amber-100">
              Targeting: {pending.art.name} — tap a glowing {pending.art.target} portrait
            </p>
          )}

          <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_minmax(200px,0.65fr)_1fr]">
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">Your team</p>
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
                      hiddenArts={false}
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
                <div className="relative h-[220px] w-[170px] overflow-hidden rounded-2xl border-2 border-amber-200/40 shadow-2xl sm:h-[280px] sm:w-[210px]">
                  <FighterArt fighter={showcase} sizes="210px" priority />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-center text-xs font-black">
                    {showcase.name}
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
                    return <SkillIcon key={`${item.fighterId}-${item.artId}`} art={art} size={36} active />;
                  })}
                </div>
              )}
            </div>

            <section className="space-y-2">
              <p className="px-1 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-red-200/70">Enemy team</p>
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
                      hiddenArts
                      queuedArtIds={[]}
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
                onClick={surrender}
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
                    const affordable = queued || canAfford(leftover, art.energy);
                    const focused = pending?.art.id === art.id || selectedArt?.id === art.id;
                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => tryQueue(selected, art, null)}
                        disabled={!myTurn || (cd > 0 && !queued)}
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
                onClick={() => router.push(ROUTES.GAME)}
                className="mt-5 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-black uppercase tracking-widest hover:bg-orange-500"
              >
                Back to scroll
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FighterRow({
  fighter,
  unit,
  side,
  selected,
  highlight,
  hiddenArts,
  queuedArtIds,
  canAct,
  onSelect,
  onArt,
}: {
  fighter: Fighter;
  unit: MatchState['sides']['player']['units'][string];
  side: SideId;
  selected: boolean;
  highlight: boolean;
  hiddenArts: boolean;
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
        role={highlight ? 'button' : undefined}
        tabIndex={highlight ? 0 : undefined}
        onClick={highlight ? onSelect : undefined}
        onKeyDown={
          highlight
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect();
                }
              }
            : undefined
        }
        className={cn(
          'grid items-center gap-2 rounded-lg border bg-black/40 p-1.5',
          side === 'foe'
            ? 'grid-cols-[minmax(0,1fr)_72px] sm:grid-cols-[minmax(0,1fr)_88px]'
            : 'grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)]',
          selected ? 'border-orange-400 ring-1 ring-orange-400/40' : 'border-emerald-900/70',
          highlight && 'cursor-pointer ring-2 ring-amber-300 animate-pulse',
          sealed && 'opacity-45'
        )}
      >
        {side === 'player' && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md sm:h-20 sm:w-[88px]"
          >
            <FighterArt fighter={fighter} sizes="88px" />
          </button>
        )}
        <div className={cn('min-w-0', side === 'foe' && 'text-right')}>
          <p className="truncate text-xs font-black uppercase">{fighter.name}</p>
          <div className="mt-1 h-2.5 overflow-hidden rounded bg-emerald-950">
            <div className={cn('h-full', pct > 30 ? 'bg-emerald-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-0.5 font-mono text-[10px]">
            {unit.hp}/{unit.maxHp}
            {unit.shield > 0 ? ` +${unit.shield}` : ''}
            {unit.veil > 0 ? ' veil' : ''}
            {unit.stun > 0 ? ' stun' : ''}
            {unit.tidebind > 0 ? ' bind' : ''}
            {unit.burn > 0 ? ' burn' : ''}
            {unit.mark > 0 ? ' mark' : ''}
            {bloodied ? ' bloodied' : ''}
          </p>
          <div className={cn('mt-1 flex gap-1', side === 'foe' && 'justify-end')}>
            {arts.slice(0, 3).map((art) =>
              hiddenArts ? (
                <span
                  key={art.id}
                  className="flex h-9 w-9 items-center justify-center rounded border border-amber-200/20 bg-[#3b2410] text-amber-100"
                >
                  <span className="text-xs">?</span>
                </span>
              ) : (
                <button
                  key={art.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onArt(art);
                  }}
                  disabled={!canAct || sealed || ((unit.cooldowns[art.id] ?? 0) > 0 && !queuedArtIds.includes(art.id))}
                  className="disabled:opacity-40"
                >
                  <SkillIcon
                    art={art}
                    size={36}
                    active={queuedArtIds.includes(art.id)}
                    cooldown={queuedArtIds.includes(art.id) ? 0 : unit.cooldowns[art.id] ?? 0}
                  />
                </button>
              )
            )}
          </div>
        </div>
        {side === 'foe' && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="relative h-[72px] w-[72px] shrink-0 justify-self-end overflow-hidden rounded-md border border-emerald-800/80 bg-emerald-950/40 sm:h-20 sm:w-[88px]"
          >
            <FighterArt fighter={fighter} sizes="88px" />
          </button>
        )}
      </div>
    </li>
  );
}
