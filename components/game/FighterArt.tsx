'use client';

import { useState } from 'react';
import Image from 'next/image';
import { fighterPortrait } from '@/lib/game/roster';
import type { Fighter } from '@/types/game';
import { cn } from '@/lib/utils';

type Props = {
  fighter: Fighter;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function FighterArt({ fighter, className, sizes = '220px', priority = false }: Props) {
  const [broken, setBroken] = useState(false);
  const initial = fighter.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span className={cn('relative block h-full w-full overflow-hidden', className)} style={{ background: fighter.accent }}>
      {!broken ? (
        <Image
          src={fighterPortrait(fighter.id)}
          alt={fighter.name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-top"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/20 to-black/55 text-4xl font-black text-white/90">
          {initial}
        </span>
      )}
    </span>
  );
}
