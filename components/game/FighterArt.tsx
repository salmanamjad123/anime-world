'use client';

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
  return (
    <span className={cn('relative block h-full w-full overflow-hidden', className)}>
      <Image
        src={fighterPortrait(fighter.id)}
        alt={fighter.name}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover object-top"
      />
    </span>
  );
}
