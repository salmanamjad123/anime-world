import type { Art, Effect } from '@/types/game';
import { cn } from '@/lib/utils';

export type SkillFamily = 'damage' | 'heal' | 'shield' | 'stun' | 'status' | 'drain' | 'defend';

export function skillFamily(art: Art): SkillFamily {
  if (art.id === 'aegis-veil' || art.universal) return 'defend';
  const types = new Set(art.effects.map((effect) => effect.type));
  if (types.has('DAMAGE')) return 'damage';
  if (types.has('HEAL')) return 'heal';
  if (types.has('SHIELD')) return 'shield';
  if (types.has('STUN')) return 'stun';
  if (types.has('DRAIN_WEAVE')) return 'drain';
  if (types.has('APPLY_STATUS')) return 'status';
  return 'damage';
}

const FAMILY_META: Record<
  SkillFamily,
  { label: string; bg: string; ring: string; title: string }
> = {
  damage: { label: 'ATK', bg: 'from-red-700 to-orange-600', ring: 'ring-red-400/50', title: 'Attack' },
  heal: { label: 'HEAL', bg: 'from-emerald-700 to-lime-600', ring: 'ring-emerald-400/50', title: 'Heal' },
  shield: { label: 'SHD', bg: 'from-sky-700 to-cyan-600', ring: 'ring-sky-400/50', title: 'Shield' },
  stun: { label: 'STUN', bg: 'from-violet-700 to-fuchsia-600', ring: 'ring-violet-400/50', title: 'Stun' },
  status: { label: 'FX', bg: 'from-amber-700 to-yellow-600', ring: 'ring-amber-400/50', title: 'Status' },
  drain: { label: 'DRN', bg: 'from-rose-800 to-pink-700', ring: 'ring-rose-400/50', title: 'Drain' },
  defend: { label: 'AEG', bg: 'from-slate-600 to-slate-800', ring: 'ring-slate-300/40', title: 'Defend' },
};

function Glyph({ family }: { family: SkillFamily }) {
  if (family === 'damage') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M4 16 L12 4 L14 10 L20 8 L12 20 L10 14 Z" fill="currentColor" />
        <path d="M7 17 L17 7" stroke="#7f1d1d" strokeWidth="1.4" />
      </svg>
    );
  }
  if (family === 'heal') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z" fill="currentColor" />
      </svg>
    );
  }
  if (family === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V7 Z" fill="currentColor" />
      </svg>
    );
  }
  if (family === 'stun') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M11 2 L13 10 H19 L14 13 L16 22 L12 16 L8 22 L10 13 L5 10 H11 Z" fill="currentColor" />
      </svg>
    );
  }
  if (family === 'drain') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M12 3 C8 9 6 12 6 15 A6 6 0 0 0 18 15 C18 12 16 9 12 3 Z" fill="currentColor" />
      </svg>
    );
  }
  if (family === 'defend') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
      <circle cx="12" cy="12" r="7" fill="currentColor" />
      <circle cx="12" cy="12" r="3" fill="#1c1008" />
    </svg>
  );
}

type Props = {
  art: Art;
  size?: number;
  active?: boolean;
  dim?: boolean;
  cooldown?: number;
  className?: string;
};

export function SkillIcon({ art, size = 44, active, dim, cooldown = 0, className }: Props) {
  const family = skillFamily(art);
  const meta = FAMILY_META[family];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-amber-50 shadow-md ring-1',
        meta.bg,
        meta.ring,
        active && 'ring-2 ring-amber-200 scale-105',
        dim && 'opacity-40 grayscale',
        className
      )}
      style={{ width: size, height: size }}
      title={`${art.name} · ${meta.title}`}
    >
      <Glyph family={family} />
      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-0.5 text-[8px] font-black leading-none">
        {meta.label}
      </span>
      {cooldown > 0 && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/65 text-sm font-black text-amber-100">
          {cooldown}
        </span>
      )}
    </span>
  );
}

export function describeArtEffects(art: Art): string[] {
  return art.effects.map((effect) => effectLine(effect));
}

function effectLine(effect: Effect): string {
  switch (effect.type) {
    case 'DAMAGE':
      return `Deals ${effect.amount} damage to ${targetWords(effect.target)}.`;
    case 'HEAL':
      return `Heals ${effect.amount} HP on ${targetWords(effect.target)}.`;
    case 'SHIELD':
      return `Grants ${effect.amount} shield to ${targetWords(effect.target)}.`;
    case 'STUN':
      return `Stuns ${targetWords(effect.target)} for ${effect.echoes} Echo (their queued arts fizzle).`;
    case 'DRAIN_WEAVE':
      return `Drains ${effect.amount} Weave from the enemy bank.`;
    case 'APPLY_STATUS':
      return `Applies ${effect.status} for ${effect.echoes} Echo(es) on ${targetWords(effect.target)}.`;
    default:
      return 'Special effect.';
  }
}

function targetWords(target: string): string {
  if (target === 'self') return 'self';
  if (target === 'ally') return 'one ally';
  if (target === 'enemy') return 'one enemy';
  if (target === 'all-enemies') return 'all enemies';
  if (target === 'all-allies') return 'all allies';
  if (target === 'random-enemy') return 'a random enemy';
  return target;
}

export function targetHint(art: Art): string {
  if (art.target === 'enemy') return 'Then tap an enemy portrait.';
  if (art.target === 'ally') return 'Then tap an ally portrait.';
  if (art.target === 'self') return 'Targets this fighter automatically.';
  if (art.target === 'all-enemies') return 'Hits every living enemy.';
  if (art.target === 'all-allies') return 'Affects your whole living team.';
  if (art.target === 'random-enemy') return 'Picks a random living enemy.';
  return '';
}
