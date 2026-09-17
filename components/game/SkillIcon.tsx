'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Art, Effect } from '@/types/game';
import { fighterPortrait, skillArtPath } from '@/lib/game/roster';
import { cn } from '@/lib/utils';

export type SkillFamily = 'damage' | 'heal' | 'shield' | 'stun' | 'status' | 'drain' | 'defend' | 'dodge';

export function skillFamily(art: Art): SkillFamily {
  if (art.id === 'aegis-veil' || art.universal) return 'defend';
  if (
    art.effects.some(
      (effect) => effect.type === 'APPLY_STATUS' && effect.status === 'dodge'
    )
  ) {
    return 'dodge';
  }
  const types = new Set(art.effects.map((effect) => effect.type));
  if (types.has('DAMAGE')) return 'damage';
  if (types.has('HEAL')) return 'heal';
  if (types.has('SHIELD')) return 'shield';
  if (types.has('STUN')) return 'stun';
  if (types.has('DRAIN_WEAVE') || types.has('STEAL_WEAVE')) return 'drain';
  if (types.has('APPLY_STATUS')) {
    if (art.effects.some((effect) => effect.type === 'APPLY_STATUS' && (effect.status === 'veil' || effect.status === 'dr'))) {
      return 'defend';
    }
    return 'status';
  }
  return 'damage';
}

/** NA-style class tags for the detail panel. */
export function artClasses(art: Art): string[] {
  const family = skillFamily(art);
  const tags: string[] = [];
  if (family === 'damage') tags.push('Melee', 'Physical');
  if (family === 'heal') tags.push('Heal', 'Medical');
  if (family === 'shield' || family === 'defend') tags.push('Guard');
  if (family === 'dodge') tags.push('Evasion');
  if (family === 'stun') tags.push('Control', 'Stun');
  if (family === 'drain') tags.push('Drain');
  if (family === 'status') tags.push('Status');
  if (art.target === 'all-enemies' || art.target === 'all-allies') tags.push('AoE');
  if (art.effects.some((e) => e.type === 'DAMAGE' && e.kind === 'pierce')) tags.push('Pierce');
  if (art.effects.some((e) => e.type === 'DAMAGE' && e.kind === 'affliction')) tags.push('Affliction');
  if (art.persistence === 'action') tags.push('Action');
  if (art.persistence === 'control') tags.push('Control');
  if ((art.cooldown ?? 0) === 0) tags.push('Static');
  return tags.length > 0 ? tags : ['Jutsu'];
}

const FAMILY_META: Record<
  SkillFamily,
  { label: string; bg: string; ring: string; title: string; tint: string }
> = {
  damage: { label: 'ATK', bg: 'from-red-800/90 to-orange-700/90', ring: 'ring-red-400/50', title: 'Attack', tint: 'rgba(185,28,28,0.45)' },
  heal: { label: 'HEAL', bg: 'from-emerald-800/90 to-lime-700/90', ring: 'ring-emerald-400/50', title: 'Heal', tint: 'rgba(21,128,61,0.45)' },
  shield: { label: 'SHD', bg: 'from-sky-800/90 to-cyan-700/90', ring: 'ring-sky-400/50', title: 'Shield', tint: 'rgba(3,105,161,0.45)' },
  stun: { label: 'STUN', bg: 'from-violet-800/90 to-fuchsia-700/90', ring: 'ring-violet-400/50', title: 'Stun', tint: 'rgba(109,40,217,0.45)' },
  status: { label: 'FX', bg: 'from-amber-800/90 to-yellow-700/90', ring: 'ring-amber-400/50', title: 'Status', tint: 'rgba(180,83,9,0.45)' },
  drain: { label: 'DRN', bg: 'from-rose-900/90 to-pink-800/90', ring: 'ring-rose-400/50', title: 'Drain', tint: 'rgba(159,18,57,0.45)' },
  defend: { label: 'GRD', bg: 'from-slate-700/90 to-slate-900/90', ring: 'ring-slate-300/40', title: 'Guard', tint: 'rgba(51,65,85,0.5)' },
  dodge: { label: 'DGE', bg: 'from-teal-800/90 to-cyan-700/90', ring: 'ring-teal-300/50', title: 'Dodge', tint: 'rgba(15,118,110,0.45)' },
};

function Glyph({ family }: { family: SkillFamily }) {
  if (family === 'damage') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M4 16 L12 4 L14 10 L20 8 L12 20 L10 14 Z" fill="currentColor" />
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
  if (family === 'shield' || family === 'defend') {
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
  if (family === 'dodge') {
    return (
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
        <path d="M4 12 H14 M14 12 L10 8 M14 12 L10 16 M16 6 L20 12 L16 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden>
      <circle cx="12" cy="12" r="7" fill="currentColor" />
    </svg>
  );
}

type Props = {
  art: Art;
  /** When set, uses fighter portrait / dedicated skill art (NA-style tiles). */
  fighterId?: string;
  size?: number;
  active?: boolean;
  dim?: boolean;
  cooldown?: number;
  className?: string;
};

export function SkillIcon({
  art,
  fighterId,
  size = 44,
  active,
  dim,
  cooldown = 0,
  className,
}: Props) {
  const family = skillFamily(art);
  const meta = FAMILY_META[family];
  const [srcIndex, setSrcIndex] = useState(0);

  const candidates: string[] = [];
  if (art.icon) candidates.push(art.icon);
  if (fighterId) {
    candidates.push(skillArtPath(fighterId, art.id));
    candidates.push(fighterPortrait(fighterId));
  }
  const src = candidates[srcIndex];
  const useArt = Boolean(src);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm text-amber-50 shadow-md ring-1',
        !useArt && `bg-gradient-to-br ${meta.bg}`,
        meta.ring,
        active && 'ring-2 ring-amber-200 scale-105',
        dim && 'opacity-40 grayscale',
        className
      )}
      style={{ width: size, height: size }}
      title={`${art.name} · ${meta.title}`}
    >
      {useArt && src ? (
        <>
          <Image
            src={src}
            alt={art.name}
            fill
            sizes={`${size}px`}
            className="object-cover object-top"
            onError={() => setSrcIndex((i) => i + 1)}
          />
          <span
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(160deg, transparent 35%, ${meta.tint})` }}
          />
        </>
      ) : (
        <Glyph family={family} />
      )}
      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/65 px-0.5 text-[7px] font-black leading-none tracking-wide">
        {meta.label}
      </span>
      {cooldown > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-black text-amber-100">
          {cooldown}
        </span>
      )}
    </span>
  );
}

export function describeArtEffects(art: Art): string[] {
  const lines = art.effects.map((effect) => effectLine(effect));
  if (art.persistence === 'action') {
    lines.push('Action: keeps ticking each Echo unless the caster is stunned.');
  }
  if (art.persistence === 'control') {
    lines.push('Control: bond persists until the caster or target is sealed.');
  }
  return lines;
}

function effectLine(effect: Effect): string {
  switch (effect.type) {
    case 'DAMAGE': {
      const kind = effect.kind === 'pierce' ? ' pierce' : effect.kind === 'affliction' ? ' affliction' : '';
      return `Deals ${effect.amount}${kind} damage to ${targetWords(effect.target)}.`;
    }
    case 'HEAL':
      return `Heals ${effect.amount} HP on ${targetWords(effect.target)}.`;
    case 'SHIELD':
      return `Grants ${effect.amount} shield to ${targetWords(effect.target)}.`;
    case 'STUN':
      return `Stuns ${targetWords(effect.target)} for ${effect.echoes} Echo (their queued arts fizzle).`;
    case 'DRAIN_WEAVE':
      return `Drains ${effect.amount} Weave from the enemy bank.`;
    case 'STEAL_WEAVE':
      return `Steals ${effect.amount} Weave from the enemy bank into yours.`;
    case 'APPLY_STATUS':
      if (effect.status === 'dodge') {
        return `Grants dodge — the next damaging hit on ${targetWords(effect.target)} is fully avoided.`;
      }
      if (effect.status === 'veil') {
        return `Veil on ${targetWords(effect.target)} — blocks hits and counters for 8.`;
      }
      if (effect.status === 'dr') {
        return `Damage reduction −${effect.amount ?? 8} for ${effect.echoes} Echo(es) on ${targetWords(effect.target)}.`;
      }
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
  if (art.target === 'enemy') return 'Then tap an ENEMY on the right — never your own team.';
  if (art.target === 'ally') return 'Then tap an ALLY on the left.';
  if (art.target === 'self') return 'Hits the caster automatically.';
  if (art.target === 'all-enemies') return 'Hits every enemy automatically.';
  if (art.target === 'all-allies') return 'Hits your whole team automatically.';
  if (art.target === 'random-enemy') return 'Picks a random enemy automatically.';
  return 'No extra target needed.';
}
