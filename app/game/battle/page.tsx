import { Suspense } from 'react';
import { BattleSandbox } from '@/components/game/BattleSandbox';

function BattleFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14301f] text-amber-100">
      Opening the gate…
    </div>
  );
}

export default function GameBattlePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  return (
    <Suspense fallback={<BattleFallback />}>
      <BattleFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function BattleFromParams({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const params = await searchParams;
  return <BattleSandbox roomCode={params.room ?? null} />;
}
