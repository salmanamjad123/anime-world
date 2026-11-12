import { redirect } from 'next/navigation';
import { IS_GAME_ARENA_ONLY } from '@/constants/site-mode';
import { GameLobby } from '@/components/game/GameLobby';

/** On arena-only deploys, lobby lives at `/` (middleware also redirects). */
export default function GamePage() {
  if (IS_GAME_ARENA_ONLY) {
    redirect('/');
  }
  return <GameLobby />;
}
