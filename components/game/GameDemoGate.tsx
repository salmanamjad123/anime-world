'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { canAccessGameDemo } from '@/lib/game-demo-access';
import { ROUTES } from '@/constants/routes';
import { Loader2 } from 'lucide-react';

/**
 * Hard gate for /game — invite-only demo. Nav hiding alone is not enough.
 */
export function GameDemoGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const allowed = canAccessGameDemo(user);

  useEffect(() => {
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

  if (isLoading || !allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking game access…
      </div>
    );
  }

  return <>{children}</>;
}
