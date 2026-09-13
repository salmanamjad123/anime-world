'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOBBY_STEPS = [
  {
    title: 'Build a team of 3',
    body: 'Tap fighters on the scroll to seal them. Six famous series — mix roles (striker / heal / control). Filters by anime help you build.',
  },
  {
    title: 'Read the jutsu panel',
    body: 'Each fighter has 4 powers with a different mix — chip attack, signature mid, dodge/stun/heal/drain tool, and a finisher. Pick a team for coverage, not four identical kits.',
  },
  {
    title: 'Start a duel',
    body: 'Quick Duel = practice vs Shade. Private Gate = friend with a code. You must seal 3 before you can start.',
  },
];

const BATTLE_STEPS = [
  {
    title: 'Your team is on the left',
    body: 'Tap YOUR portraits only to choose who casts. You cannot attack your own fighters. Heals and shields also go on the left.',
  },
  {
    title: 'Enemies are on the right',
    body: 'Enemy jutsu are fully visible — read their costs and cooldowns, then plan. Pick an ATK power and tap a glowing enemy portrait to aim.',
  },
  {
    title: 'Bank Weave, then Attack',
    body: 'Every Echo you gain +2 mixed jutsu energy (different colors). Unused energy stays until you spend it (bank up to 10). Spend 1-cost attacks anytime, or save for a finisher.',
  },
  {
    title: 'Play for seals',
    body: 'Stun, dodge, mark, and drain are character-unique. Dodge avoids the next hit fully. Focus one enemy. After both sides act, +2 energy again.',
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: 'lobby' | 'battle';
};

export function HowToPlay({ open, onClose, variant = 'lobby' }: Props) {
  const steps = variant === 'battle' ? BATTLE_STEPS : LOBBY_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open, variant]);

  if (!open) return null;

  const current = steps[step]!;
  const last = step >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-8" role="dialog" aria-labelledby="how-to-play-title">
      <div className="w-full max-w-md rounded-2xl border border-orange-400/40 bg-[#1c1008] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300">
              {variant === 'battle' ? 'Battle guide' : 'Village Arena'}
            </p>
            <h2 id="how-to-play-title" className="text-2xl font-black text-amber-50">
              {variant === 'battle' ? 'How to fight' : 'How to play'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-amber-100 hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-1.5">
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                'h-1.5 flex-1 rounded-full transition',
                index === step ? 'bg-orange-500' : index < step ? 'bg-orange-500/50' : 'bg-white/15'
              )}
              aria-label={`Step ${index + 1}`}
            />
          ))}
        </div>

        <div className="mt-5 min-h-[140px] rounded-xl bg-black/40 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">
            Step {step + 1} / {steps.length}
          </p>
          <h3 className="mt-2 text-lg font-black text-amber-50">{current.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/85">{current.body}</p>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-amber-200/20 bg-black/40 px-3 py-2.5 text-sm font-bold text-amber-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {last ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-500"
            >
              {variant === 'battle' ? 'Start fighting' : 'Got it — pick a team'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-orange-600 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-500"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const TUTORIAL_KEYS = {
  lobby: 'va-help-seen-v2',
  battle: 'va-battle-guide-seen-v1',
} as const;
