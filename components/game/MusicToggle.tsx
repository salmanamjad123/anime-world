'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  isArenaBgmWanted,
  releaseArenaBgm,
  retainArenaBgm,
  subscribeArenaBgm,
  toggleArenaBgm,
  unlockArenaBgm,
} from '@/lib/game/music';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function MusicToggle({ className }: Props) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    retainArenaBgm();
    setOn(isArenaBgmWanted());
    const unsub = subscribeArenaBgm(() => setOn(isArenaBgmWanted()));
    const unlock = () => {
      void unlockArenaBgm();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      unsub();
      releaseArenaBgm();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => void toggleArenaBgm()}
      aria-pressed={on}
      aria-label={on ? 'Pause background music' : 'Play background music'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-amber-200/30 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-100 hover:bg-black/70',
        className
      )}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      {on ? 'Music' : 'Muted'}
    </button>
  );
}
