'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { cn } from '@/lib/utils';

function isInternalNavHref(href: string, currentPath: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
    return false;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    const next = url.pathname + url.search + url.hash;
    const current = currentPath + window.location.search + window.location.hash;
    return next !== current;
  } catch {
    return false;
  }
}

/** Top loading line during client navigations; page content stays visible. */
export function NavigationProgress() {
  const pathname = usePathname();
  const closeAuthModal = useAuthModalStore((s) => s.closeAuthModal);
  const [pending, setPending] = useState(false);

  const start = useCallback(() => setPending(true), []);
  const finish = useCallback(() => setPending(false), []);

  useEffect(() => {
    closeAuthModal();
    document.body.style.overflow = '';
    finish();
  }, [pathname, closeAuthModal, finish]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || !isInternalNavHref(href, pathname)) return;
      start();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname, start]);

  useEffect(() => {
    const rawPush = history.pushState.bind(history);
    const rawReplace = history.replaceState.bind(history);

    const maybeStart = (url: string | URL | null | undefined) => {
      if (typeof url !== 'string') return;
      if (isInternalNavHref(url, pathname)) start();
    };

    history.pushState = (...args) => {
      maybeStart(args[2] as string | undefined);
      return rawPush(...args);
    };
    history.replaceState = (...args) => {
      maybeStart(args[2] as string | undefined);
      return rawReplace(...args);
    };

    return () => {
      history.pushState = rawPush;
      history.replaceState = rawReplace;
    };
  }, [pathname, start]);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden transition-opacity duration-200',
        pending ? 'opacity-100' : 'opacity-0'
      )}
      aria-hidden={!pending}
      aria-live="polite"
      aria-busy={pending}
    >
      <div
        className={cn(
          'h-full w-[35%] bg-gradient-to-r from-transparent via-blue-800 to-blue-600 shadow-[0_0_8px_rgba(29,78,216,0.55)]',
          pending && 'animate-[nav-progress_2.2s_ease-in-out_infinite]'
        )}
      />
    </div>
  );
}
