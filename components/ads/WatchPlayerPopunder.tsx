'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ADSTERRA_POPUNDER_SRC,
  canShowWatchPopunder,
  markWatchPopunderShown,
} from '@/lib/ads';
import { useAdMode } from '@/hooks/useAdMode';
import { useAdPlacementVisible } from '@/hooks/useAdsSettings';

const SCRIPT_ATTR = 'data-av-watch-popunder';

/**
 * Dismissible overlay in front of the watch player (once per session).
 * Injects the Adsterra popunder script into document.body — those units do not
 * render inside a box; the overlay is our UI with a close control.
 */
export function WatchPlayerPopunder() {
  const mode = useAdMode();
  const { visible: adsVisible, isLoading } = useAdPlacementVisible('watch_popunder');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || mode === 'loading') return;
    if (!adsVisible && mode === 'live') return;
    // Localhost: always preview when placement isn't explicitly off after load
    if (mode === 'live' && !ADSTERRA_POPUNDER_SRC) return;
    if (!canShowWatchPopunder()) return;

    setOpen(true);
    markWatchPopunderShown();
  }, [isLoading, mode, adsVisible]);

  useEffect(() => {
    if (!open || mode !== 'live' || !ADSTERRA_POPUNDER_SRC) return;
    if (document.querySelector(`script[${SCRIPT_ATTR}]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.dataset.cfasync = 'false';
    script.src = ADSTERRA_POPUNDER_SRC;
    script.setAttribute(SCRIPT_ATTR, '1');
    document.body.appendChild(script);

    return () => {
      document.querySelectorAll(`script[${SCRIPT_ATTR}]`).forEach((node) => node.remove());
    };
  }, [open, mode]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg bg-black/90 px-4"
      role="dialog"
      aria-label="Advertisement"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="absolute right-2 top-2 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        aria-label="Close advertisement"
      >
        <X className="h-5 w-5" />
      </button>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">Advertisement</p>
      <p className="mt-2 max-w-sm text-center text-sm text-gray-200">
        {mode === 'local'
          ? 'Player ad overlay (localhost preview). Close with × — live site loads the Adsterra unit.'
          : 'Thanks for supporting Anime Village. Close to continue watching.'}
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Continue watching
      </button>
    </div>
  );
}
