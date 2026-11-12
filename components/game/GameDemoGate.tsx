'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { canAccessGameDemo } from '@/lib/game-demo-access';
import { ROUTES } from '@/constants/routes';
import { IS_GAME_ARENA_ONLY } from '@/constants/site-mode';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Gate for /game (and arena home).
 * Anime Village: invite-only demo.
 * Game-arena branch: sign-in required; stay on page with login CTA.
 */
export function GameDemoGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const allowed = canAccessGameDemo(user);

  useEffect(() => {
    if (IS_GAME_ARENA_ONLY) return;
    if (isLoading) return;
    if (!user) {
      openAuthModal('login');
      router.replace(ROUTES.HOME);
      return;
    }
    if (!allowed) {
      router.replace(ROUTES.HOME);
    }
  }, [isLoading, user, allowed, openAuthModal, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking game access…
      </div>
    );
  }

  if (IS_GAME_ARENA_ONLY && !user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-white">Village Arena</h1>
        <p className="max-w-md text-sm text-gray-400">
          Sign in to enter the lobby, pick your team, and battle.
        </p>
        <Button variant="primary" onClick={() => openAuthModal('login')}>
          Sign in to play
        </Button>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking game access…
      </div>
    );
  }

  return <>{children}</>;
}
