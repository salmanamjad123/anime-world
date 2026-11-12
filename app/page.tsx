import { GameDemoGate } from '@/components/game/GameDemoGate';
import { GameLobby } from '@/components/game/GameLobby';
import './game/game.css';

export default function HomePage() {
  return (
    <GameDemoGate>
      <GameLobby />
    </GameDemoGate>
  );
}
