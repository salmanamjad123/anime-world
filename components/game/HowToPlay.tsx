'use client';

import { X } from 'lucide-react';

const STEPS = [
  {
    title: '1. Seal a team of 3',
    body: 'Open Game and tap fighters until three seals are filled. Mix factions if you can — three Weave colors is safer than one. Lead names sit on the top row of the scroll.',
  },
  {
    title: '2. Start a duel',
    body: 'Quick Duel fights Shade. Private Gate needs both players sealed with 3 fighters — Create a code or Join. Surrender gives the other player the win.',
  },
  {
    title: '3. Spend Weave',
    body: 'Each Echo you bank colored pips (Strike, Tide, Pulse, Blood), capped at 7. Arts cost those pips. Any can be paid with leftover color. Echo 1 uses the Ash Rule: host 1 pip, challenger 3.',
  },
  {
    title: '4. Turns go one by one',
    body: 'When YOUR TURN is red, pick a fighter, tap a power, then tap an enemy portrait if the power needs a target. Press Attack to resolve your powers. Then the opponent takes their turn. After both sides act, the next Echo starts.',
  },
  {
    title: '5. Read power details',
    body: 'The bottom panel shows exactly what the selected power does, its Weave cost, cooldown, and who it hits. Enemy portraits stay visible on the right — tap them to aim.',
  },
  {
    title: '6. Control beats raw damage',
    body: 'Stun, drain, veil, and binds resolve first on your turn. A stun can cancel their later strike in the same Echo. Hitting a veil deals 10 back to you. Tidebind cuts their damage and their Weave grant.',
  },
  {
    title: '7. Combos and closers',
    body: 'Two arts from the same faction in one turn = +6. A second hit on the same fighter = +8 focus. Bloodied (≤35 HP) fighters deal +20%. After 12 Echoes, higher remaining HP wins.',
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HowToPlay({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4 py-8" role="dialog" aria-labelledby="how-to-play-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-orange-400/40 bg-[#1c1008] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300">Village Arena</p>
            <h2 id="how-to-play-title" className="text-2xl font-black text-amber-50">
              How to play
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-amber-100 hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step) => (
            <li key={step.title} className="rounded-xl bg-black/35 px-3 py-2.5">
              <p className="text-sm font-bold text-orange-200">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-100/80">{step.body}</p>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-500"
        >
          Got it — pick a team
        </button>
      </div>
    </div>
  );
}
