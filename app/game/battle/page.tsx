'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useGameLobbyStore } from '@/store/useGameLobbyStore';
import { ROUTES } from '@/constants/routes';

function BattleRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const startBattle = useGameLobbyStore((s) => s.startBattle);
  const room = params.get('room');

  useEffect(() => {
    startBattle({ room: room || null, mode: room ? 'private' : 'quick' });
    router.replace(ROUTES.GAME);
  }, [room, router, startBattle]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14301f] text-amber-100">
      Opening the gate…
    </div>
  );
}

export default function GameBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#14301f] text-amber-100">
          Opening the gate…
        </div>
      }
    >
      <BattleRedirectInner />
    </Suspense>
  );
}
