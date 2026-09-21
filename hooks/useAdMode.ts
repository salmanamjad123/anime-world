'use client';

import { useEffect, useState } from 'react';
import { isAdLocalHost } from '@/lib/ads';

export type AdMode = 'loading' | 'local' | 'live';

export function useAdMode(): AdMode {
  const [mode, setMode] = useState<AdMode>('loading');

  useEffect(() => {
    setMode(isAdLocalHost() ? 'local' : 'live');
  }, []);

  return mode;
}
