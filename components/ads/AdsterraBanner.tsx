'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const AD_KEY =
  process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY ||
  '75c80d90568a0501592e3b28771a6543';
const WIDTH = 300;
const HEIGHT = 250;

function isLocalHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function AdsterraBanner({
  variant = 'section',
}: {
  variant?: 'section' | 'grid';
}) {
  const [mode, setMode] = useState<'loading' | 'local' | 'live'>('loading');

  useEffect(() => {
    setMode(isLocalHost() ? 'local' : 'live');
  }, []);

  const slot =
    mode === 'live' ? (
      <iframe
        title="Advertisement"
        width={WIDTH}
        height={HEIGHT}
        scrolling="no"
        className="h-[250px] w-[300px] overflow-hidden rounded-lg border-0 bg-gray-800/40"
        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head><body>
<script>atOptions = { 'key' : '${AD_KEY}', 'format' : 'iframe', 'height' : ${HEIGHT}, 'width' : ${WIDTH}, 'params' : {} };</script>
<script src="https://www.highrevenueformat.com/${AD_KEY}/invoke.js"></script>
</body></html>`}
      />
    ) : (
      <div className="flex h-[250px] w-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800/50 px-4 text-center">
        <span className="text-sm font-medium text-gray-300">Ad slot 300×250</span>
        <span className="mt-1 text-xs text-gray-500">
          {mode === 'loading'
            ? 'Loading…'
            : 'Placeholder on localhost. Live ads show on animevillage.org'}
        </span>
      </div>
    );

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        'flex flex-col items-center justify-center',
        variant === 'section' && 'my-10',
        variant === 'grid' && 'h-full min-h-[250px] rounded-lg bg-gray-800/30 px-2 py-3'
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">
        Advertisement
      </p>
      {slot}
    </aside>
  );
}
