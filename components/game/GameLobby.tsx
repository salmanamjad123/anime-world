'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize, Minimize, Lock, Swords, Users, Zap, X, CircleHelp } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FighterArt } from '@/components/game/FighterArt';
import { WeaveCost } from '@/components/game/WeavePips';
import { HowToPlay } from '@/components/game/HowToPlay';
import { MusicToggle } from '@/components/game/MusicToggle';
import { FACTIONS, FEATURED_FIGHTER_IDS, FIGHTERS, RULESET_VERSION, TEAM_SIZE, getFighter, getFighterArts, lobbyFighters } from '@/lib/game/roster';
import { pickShadeTeam, validateTeam } from '@/lib/game/team-rules';
import { lobbyStrategyTips } from '@/lib/game/strategy';
import { createRoom, joinRoom, normalizeGateCode } from '@/lib/game/rooms';
import { useGameLobbyStore } from '@/store/useGameLobbyStore';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { Fighter, GameMode, ResonanceKind } from '@/types/game';

const RESONANCE_COPY: Record<ResonanceKind, string> = {
  none: 'No resonance yet',
  pair: 'Pair resonance — +5 art damage for the shared faction',
  trinity: 'Trinity — +8 damage and first art shreds 1 shield',
  chaos: 'Chaos Pulse — +1 Any Weave each Echo',
};

function useHydratedTeam() {
  const teamIds = useGameLobbyStore((s) => s.teamIds);
  const focusedId = useGameLobbyStore((s) => s.focusedId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useGameLobbyStore.persist.onFinishHydration(finish);
    if (useGameLobbyStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  return { teamIds: hydrated ? teamIds : [], focusedId: hydrated ? focusedId : null, hydrated };
}

export function GameLobby() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { teamIds, focusedId, hydrated } = useHydratedTeam();
  const toggleFighter = useGameLobbyStore((s) => s.toggleFighter);
  const setFocused = useGameLobbyStore((s) => s.setFocused);
  const setShadeIds = useGameLobbyStore((s) => s.setShadeIds);
  const setLastMode = useGameLobbyStore((s) => s.setLastMode);
  const { user } = useUserStore();
  const openAuthModal = useAuthModalStore((s) => s.openAuthModal);

  const [fullscreen, setFullscreen] = useState(false);
  const [queueMode, setQueueMode] = useState<GameMode | null>(null);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [privateCode, setPrivateCode] = useState('');
  const [privateBusy, setPrivateBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [selectFlash, setSelectFlash] = useState(0);
  const scroll = useMemo(() => lobbyFighters(), []);

  const team = useMemo(
    () => teamIds.map((id) => getFighter(id)).filter((fighter): fighter is Fighter => Boolean(fighter)),
    [teamIds]
  );
  const validation = useMemo(() => validateTeam(team), [team]);
  const focused = getFighter(focusedId ?? teamIds[0] ?? scroll[0]?.id ?? '') ?? scroll[0] ?? FIGHTERS[0];
  const strategyTips = useMemo(() => lobbyStrategyTips(team, validation), [team, validation]);
  const playerName = user?.displayName || user?.email?.split('@')[0] || 'Challenger';

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!queueMode) return;
    const timer = window.setTimeout(() => {
      const shade = pickShadeTeam(teamIds, FIGHTERS);
      setShadeIds(shade.map((fighter) => fighter.id));
      setLastMode(queueMode);
      setQueueMode(null);
      router.push(ROUTES.GAME_BATTLE);
    }, queueMode === 'quick' ? 900 : 1600);
    return () => window.clearTimeout(timer);
  }, [queueMode, router, setLastMode, setShadeIds, teamIds]);

  const startMode = (mode: GameMode) => {
    if (!validation.ready) {
      setNotice(validation.reasons[0] ?? `Pick ${TEAM_SIZE} fighters first.`);
      return;
    }
    if ((mode === 'ranked' || mode === 'private') && !user) {
      openAuthModal('login');
      return;
    }
    if (mode === 'private') {
      setPrivateOpen(true);
      return;
    }
    setNotice(null);
    setQueueMode(mode);
  };

  const toggleFullscreen = async () => {
    const node = rootRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      setNotice('Fullscreen is blocked in this browser.');
    }
  };

  return (
    <div ref={rootRef} className="game-arena min-h-screen bg-[#140e0a] text-amber-50">
      <Header />
      <div className="relative mx-auto flex min-h-[calc(100svh-var(--site-header-height,4rem))] w-full max-w-[1400px] flex-col px-3 pb-6 pt-3 sm:px-5">
        <section className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-[#1c1008] shadow-[0_0_80px_rgba(234,88,12,0.25)]">
          <div className="pointer-events-none absolute inset-0 game-ember-wash" />
          <FloatingOrbs />
          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <MusicToggle />
            <button
              type="button"
              onClick={() => setHelp(true)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200/30 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-100 hover:bg-black/70"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              How to play
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200/30 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-100 hover:bg-black/70"
            >
              {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
          <div className="relative z-10 grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-6">
            <div className="flex min-h-[220px] items-end justify-center md:min-h-[320px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${focused.id}-${selectFlash}`}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.28 }}
                  className="relative h-[240px] w-[200px] sm:h-[300px] sm:w-[240px] md:h-[340px] md:w-[270px]"
                >
                  <div className="absolute -inset-6 rounded-full bg-orange-500/20 blur-3xl" />
                  <div className="game-select-ring relative h-full overflow-hidden rounded-[1.5rem] border-2 border-amber-200/40 shadow-2xl">
                    <FighterArt fighter={focused} sizes="270px" priority className="game-select-flash" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex flex-col justify-end gap-3 pb-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-orange-300/80">Village Arena · {RULESET_VERSION}</p>
              <h1 className="font-black leading-none tracking-tight text-3xl sm:text-5xl text-amber-50">
                {focused.name}
              </h1>
              <p className="text-sm text-orange-200/80">{focused.epithet} · {FACTIONS[focused.faction].name}</p>
              <p className="max-w-md text-sm text-amber-100/70">
                Seal three fighters. Echo Lock turns. Light music on the mute icon — pause anytime.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ModeButton
            label="Ranked Forge"
            hint="MMR + stars"
            icon={Swords}
            onClick={() => startMode('ranked')}
            disabled={Boolean(queueMode)}
          />
          <ModeButton
            label="Quick Duel"
            hint={user ? 'Human, then Shade' : 'Practice Shade'}
            icon={Zap}
            onClick={() => startMode('quick')}
            disabled={Boolean(queueMode)}
          />
          <ModeButton
            label="Private Gate"
            hint="Create or join a code"
            icon={Users}
            onClick={() => startMode('private')}
            disabled={Boolean(queueMode)}
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="game-parchment rounded-xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#5c3b18]">Fighter scroll</h2>
              <p className="text-xs text-[#7a5424]">
                {hydrated ? `${team.length}/${TEAM_SIZE} sealed · names on top` : 'Loading team…'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-9">
              {scroll.map((fighter) => {
                const slot = teamIds.indexOf(fighter.id);
                const selected = slot >= 0;
                const featured = FEATURED_FIGHTER_IDS.includes(fighter.id as (typeof FEATURED_FIGHTER_IDS)[number]);
                return (
                  <button
                    key={fighter.id}
                    type="button"
                    onClick={() => {
                      setFocused(fighter.id);
                      toggleFighter(fighter.id, fighter.unlocked);
                      setSelectFlash((count) => count + 1);
                    }}
                    onMouseEnter={() => setFocused(fighter.id)}
                    onFocus={() => setFocused(fighter.id)}
                    aria-pressed={selected}
                    aria-label={`${fighter.name}${fighter.unlocked ? '' : ' (locked)'}`}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg border-2 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                      selected ? 'border-[#d4a017] ring-2 ring-[#d4a017]/50' : 'border-[#8a6a3b]/60',
                      !fighter.unlocked && 'grayscale'
                    )}
                  >
                    <FighterArt fighter={fighter} sizes="96px" />
                    <span
                      className={cn(
                        'absolute inset-x-0 top-0 z-[1] bg-gradient-to-b from-black/85 to-transparent px-1 pb-3 pt-1 text-left text-[9px] font-black leading-tight sm:text-[10px]',
                        featured ? 'text-amber-200' : 'text-amber-50'
                      )}
                    >
                      {fighter.name}
                    </span>
                    {!fighter.unlocked && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <Lock className="h-4 w-4 text-amber-100" />
                      </span>
                    )}
                    {selected && (
                      <span className="absolute bottom-1 left-1 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-[#d4a017] text-[10px] font-black text-[#3b2410]">
                        {slot + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: TEAM_SIZE }, (_, index) => {
                const fighter = team[index];
                return (
                  <div
                    key={`slot-${index}`}
                    className="flex min-h-[64px] items-center gap-2 rounded-lg border border-[#8a6a3b]/70 bg-[#fff6e4]/70 px-2 py-1.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c2410c] text-xs font-black text-white">
                      {index + 1}
                    </span>
                    {fighter ? (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#3b2410]">{fighter.name}</p>
                        <p className="truncate text-[10px] uppercase tracking-wider text-[#7a5424]">{FACTIONS[fighter.faction].name}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#7a5424]">Empty seal</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="game-parchment rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a3412]">{FACTIONS[focused.faction].name}</p>
            <h3 className="mt-1 text-xl font-black text-[#3b2410]">{focused.name}</h3>
            <p className="text-sm text-[#7a5424]">{focused.epithet}</p>
            <dl className="mt-3 space-y-1 text-xs text-[#5c3b18]">
              <div className="flex justify-between"><dt>Role</dt><dd className="font-semibold capitalize">{focused.role}</dd></div>
              <div className="flex justify-between"><dt>Rarity</dt><dd className="font-semibold capitalize">{focused.rarity}</dd></div>
              <div className="flex justify-between"><dt>HP</dt><dd className="font-semibold">{focused.hp}</dd></div>
              <div className="flex justify-between"><dt>Unlock</dt><dd className="font-semibold capitalize">{focused.unlock}</dd></div>
            </dl>
            <ul className="mt-3 space-y-2">
              {getFighterArts(focused).map((skill) => (
                <li key={skill.id} className="rounded-md bg-[#fff6e4] px-2 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#3b2410]">{skill.name}</p>
                    <WeaveCost cost={skill.energy} />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#7a5424]">{skill.description}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-[#9a3412]">{RESONANCE_COPY[validation.resonance]}</p>
            <ul className="mt-2 space-y-1">
              {strategyTips.map((tip) => (
                <li key={tip} className="text-[11px] leading-snug text-[#5c3b18]">
                  {tip}
                </li>
              ))}
            </ul>
            {!validation.weaveCoverageOk && (
              <p className="mt-1 text-xs text-[#b45309]">{validation.reasons.find((r) => r.includes('Weave'))}</p>
            )}
            <p
              id="game-ready-status"
              className={cn(
                'mt-3 rounded-md px-2 py-2 text-center text-xs font-bold uppercase tracking-widest',
                validation.ready ? 'bg-emerald-700 text-emerald-50' : 'bg-[#c2410c] text-amber-50'
              )}
            >
              {validation.ready ? 'You are ready to start a game' : validation.reasons[0] ?? 'Seal 3 fighters'}
            </p>
          </aside>
        </div>

        {notice && (
          <p className="mt-3 text-center text-sm text-orange-200" role="status">
            {notice}
          </p>
        )}
      </div>

      <HowToPlay
        open={help}
        onClose={() => {
          window.localStorage.setItem('va-help-seen', '1');
          setHelp(false);
        }}
      />

      <AnimatePresence>
        {queueMode && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-[#1c1008] p-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Finding Echo</p>
              <p className="mt-2 text-2xl font-black text-amber-50">
                {queueMode === 'ranked' ? 'Ranked Forge' : queueMode === 'private' ? 'Private Gate' : 'Quick Duel'}
              </p>
              <p className="mt-2 text-sm text-amber-100/70">
                {queueMode === 'quick' && !user
                  ? 'No login — pairing you with a Shade bot.'
                  : 'Pairing a Shade. Private Gate is for human vs human.'}
              </p>
              <button
                type="button"
                className="mt-5 text-sm text-orange-200 underline"
                onClick={() => setQueueMode(null)}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {privateOpen && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-[#1c1008] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Private Gate</h2>
                <button type="button" onClick={() => setPrivateOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-amber-100/70">
                Both players must seal <span className="font-bold text-amber-50">3 fighters</span> first. Create a code and wait, or join a friend’s gate.
              </p>
              {!validation.ready && (
                <p className="mt-2 rounded-md bg-red-950/60 px-2 py-1.5 text-xs text-orange-200">
                  {validation.reasons[0] ?? `Pick ${TEAM_SIZE} fighters on the scroll before Create / Join.`}
                </p>
              )}
              <button
                type="button"
                disabled={privateBusy || !validation.ready}
                onClick={async () => {
                  if (!validation.ready) {
                    setNotice(`Seal ${TEAM_SIZE} fighters before you create a gate.`);
                    return;
                  }
                  if (!user) {
                    openAuthModal('login');
                    return;
                  }
                  setPrivateBusy(true);
                  try {
                    const { room, cloud } = await createRoom({
                      uid: user.uid,
                      name: playerName,
                      team: teamIds,
                    });
                    setLastMode('private');
                    setPrivateOpen(false);
                    if (!cloud) {
                      setNotice('Cloud gate unavailable — this code works in another tab on this device until Firestore rules are published.');
                    }
                    router.push(ROUTES.GAME_BATTLE_ROOM(room.code));
                  } catch (error) {
                    setNotice(error instanceof Error ? error.message : 'Could not open a gate.');
                  } finally {
                    setPrivateBusy(false);
                  }
                }}
                className="mt-4 w-full rounded-lg bg-orange-600 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-orange-500 disabled:opacity-60"
              >
                {privateBusy ? 'Opening…' : 'Create gate'}
              </button>
              <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-amber-100/40">
                <span className="h-px flex-1 bg-amber-100/20" />
                or join
                <span className="h-px flex-1 bg-amber-100/20" />
              </div>
              <input
                value={privateCode}
                onChange={(e) => setPrivateCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="A7K2MX"
                className="mt-4 w-full rounded-lg border border-orange-500/40 bg-black/40 px-3 py-2 uppercase tracking-[0.3em] text-amber-50 outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                disabled={privateBusy || !validation.ready}
                onClick={async () => {
                  if (!validation.ready) {
                    setNotice(`Seal ${TEAM_SIZE} fighters before you join.`);
                    return;
                  }
                  if (!user) {
                    openAuthModal('login');
                    return;
                  }
                  const code = normalizeGateCode(privateCode);
                  if (code.length < 4) {
                    setNotice('Enter a 4–6 character gate code.');
                    return;
                  }
                  setPrivateBusy(true);
                  try {
                    const { room, cloud } = await joinRoom(code, {
                      uid: user.uid,
                      name: playerName,
                      team: teamIds,
                    });
                    setLastMode('private');
                    setPrivateOpen(false);
                    if (!cloud) {
                      setNotice('Joined a local gate — both players must be on this device.');
                    }
                    router.push(ROUTES.GAME_BATTLE_ROOM(room.code));
                  } catch (error) {
                    setNotice(error instanceof Error ? error.message : 'Could not join that gate.');
                  } finally {
                    setPrivateBusy(false);
                  }
                }}
                className="mt-4 w-full rounded-lg border border-orange-400/50 bg-black/40 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-black/60 disabled:opacity-60"
              >
                Join gate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeButton({
  label,
  hint,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  icon: typeof Swords;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-xl border border-orange-400/50 bg-gradient-to-r from-[#7c2d12] via-[#c2410c] to-[#9a3412] px-4 py-3 text-left shadow-lg disabled:opacity-60"
    >
      <span className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-red-700/80 ring-2 ring-amber-200/40" />
      <span className="relative flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-100" />
        <span>
          <span className="block text-sm font-black uppercase tracking-wider text-amber-50">{label}</span>
          <span className="block text-[10px] text-amber-100/70">{hint}</span>
        </span>
      </span>
    </button>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 7 }, (_, index) => (
        <span
          key={index}
          className="game-orb absolute rounded-full bg-orange-600/70 blur-[1px]"
          style={{
            width: `${12 + (index % 3) * 8}px`,
            height: `${12 + (index % 3) * 8}px`,
            left: `${8 + index * 12}%`,
            top: `${12 + (index % 4) * 18}%`,
            animationDelay: `${index * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
