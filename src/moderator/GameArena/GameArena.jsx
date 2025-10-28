import React, { useEffect, useState } from 'react';
import CenterCircle from './CenterCircle';
import PlayersCircle from './PlayersCircle';
import FloatingLogDock from './FloatingLogDock';
import './GameArena.css';

function GameArena({ gameState, onEndNight, onEndDay }) {
  const phase = gameState.game.phase;
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    let mounted = true;

    const updateRemaining = () => {
      const phaseEndsAt = gameState.game?.timerState?.phaseEndsAt ? new Date(gameState.game.timerState.phaseEndsAt).getTime() : null;
      if (!phaseEndsAt) {
        if (mounted) setRemaining(null);
        return;
      }
      const diff = Math.max(0, phaseEndsAt - Date.now());
      if (mounted) setRemaining(Math.floor(diff / 1000));
    };
    updateRemaining();
    const int = setInterval(() => {
      updateRemaining();
      // případně tick
      // gameApi.tick(gameState.game._id).catch(() => {});
    }, 2000);
    return () => clearInterval(int);
  }, [gameState.game._id, gameState.game.timerState?.phaseEndsAt]);

  return (
    <div className={`game-arena ${phase}`}>
      <CenterCircle
        phase={gameState.game.phase}
        round={gameState.game.round}
        aliveCount={gameState.players.filter(p => p.alive).length}
        countdownSec={remaining}
      />
      <PlayersCircle players={gameState.players} phase={phase} />
      <FloatingLogDock logs={gameState.logs} players={gameState.players} />
      <div className={`atmosphere-overlay ${phase}`}></div>
    </div>
  );
}

export default GameArena;
