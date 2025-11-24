import React, { useEffect, useState, useRef } from 'react';
import { gameApi } from '../../api/gameApi';
import CenterCircle from './CenterCircle';
import PlayersCircle from './PlayersCircle';
import FloatingLogDock from './FloatingLogDock';
import InGameModMenu from './InGameModMenu';
import PhaseTransition from './PhaseTransition';
import DeathReveal from './DeathReveal';
import GameEndScreen from './GameEndScreen';
import './GameArena.css';

function GameArena({ gameState, onRefresh }) {
  const [remaining, setRemaining] = useState(null);
  const [transition, setTransition] = useState(null);
  const [deadReveal, setDeadReveal] = useState([]);
  
  const phase = gameState.game.phase;
  const phaseEndsAt = gameState.game?.timerState?.phaseEndsAt;
  
  const countdownZeroTriggeredRef = useRef(false);

  // Reset trigger when server phase changes
  useEffect(() => {
    countdownZeroTriggeredRef.current = false;
  }, [phase]);

  // Frontend countdown (pouze pokud není end)
  useEffect(() => {
    if (phase === 'end') return; // Žádný countdown po konci hry

    let mounted = true;
    let countdownInterval = null;

    const updateCountdown = () => {
      if (!phaseEndsAt) {
        if (mounted) setRemaining(null);
        return;
      }
      
      const endsAtMs = new Date(phaseEndsAt).getTime();
      const diff = Math.max(0, endsAtMs - Date.now());
      const sec = Math.floor(diff / 1000);
      
      if (mounted) setRemaining(sec);

      if (sec === 0 && !countdownZeroTriggeredRef.current) {
        countdownZeroTriggeredRef.current = true;
        const nextPhase = phase === 'day' ? 'night' : 'day';
        
        console.log(`⏰ [COUNTDOWN] Hit 0: ${phase} → ${nextPhase}`);
        
        if (mounted) setTransition({ from: phase, to: nextPhase });
        
        gameApi.endPhase(gameState.game._id).catch(e => {
          console.error('❌ End-phase error:', e);
        });
        
        setTimeout(() => {
          if (mounted) setTransition(null);
        }, 2000);
      }
    };

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    return () => {
      mounted = false;
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [phaseEndsAt, phase, gameState.game._id]);

  // Periodic sync
  useEffect(() => {
    let mounted = true;
    let syncInterval = null;

    const doSync = async () => {
      try {
        const freshState = await gameApi.getGameState(gameState.game._id);
        
        if (freshState.game.phase !== phase) {
          console.log(`🔄 [SYNC] Phase changed: ${phase} → ${freshState.game.phase}`);
          
          if (freshState.game.phase === 'day' && phase === 'night') {
            const newDead = freshState.players.filter(p => 
              !p.alive && gameState.players.find(old => old._id === p._id)?.alive
            );
            
            if (newDead.length > 0 && mounted) {
              console.log('💀 Deaths:', newDead.map(p => p.name));
              setDeadReveal(newDead);
              setTimeout(() => {
                if (mounted) setDeadReveal([]);
              }, 5000);
            }
          }
          
          if (onRefresh) await onRefresh();
        }
      } catch (e) {
        console.error('❌ Sync error:', e);
      }
    };

    syncInterval = setInterval(doSync, 2000);
    doSync();

    return () => {
      mounted = false;
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [gameState.game._id, onRefresh, gameState.players, phase]);

  const handleReturnToLobby = async () => {
    await gameApi.resetToLobby(gameState.game._id);
    await onRefresh();
  };

  // Pokud je hra u konce, zobraz end screen
  if (phase === 'end') {
    return (
      <GameEndScreen 
        gameState={gameState}
        onReturnToLobby={handleReturnToLobby}
      />
    );
  }

  return (
    <div className={`game-arena ${phase}`}>
      <InGameModMenu 
        gameId={gameState.game._id}
        onReturnToLobby={handleReturnToLobby}
      />
      
      <CenterCircle
        phase={phase}
        round={gameState.game.round}
        aliveCount={gameState.players.filter(p => p.alive).length}
        countdownSec={remaining}
      />
      
      <PlayersCircle players={gameState.players} phase={phase} game={gameState.game} />
      <FloatingLogDock logs={gameState.logs || []} players={gameState.players} />
      
      <div className={`atmosphere-overlay ${phase}`}>
        {phase === 'night' && <div className="stars"></div>}
        {phase === 'day' && (
          <>
            <div className="fog fog-1"></div>
            <div className="fog fog-2"></div>
            <div className="fog fog-3"></div>
          </>
        )}
      </div>
      
      {transition && <PhaseTransition from={transition.from} to={transition.to} />}
      {deadReveal.length > 0 && <DeathReveal deadPlayers={deadReveal} />}
    </div>
  );
}

export default GameArena;
