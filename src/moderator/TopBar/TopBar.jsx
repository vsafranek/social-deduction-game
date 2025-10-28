import React from 'react';
import './TopBar.css';

function TopBar({ gameState, onConnectionClick }) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <h1>🎮 Moderátor</h1>
        {gameState && (
          <div className="game-status">
            <span className={`phase-badge ${gameState.game.phase}`}>
              {gameState.game.phase === 'lobby' && '🏠 LOBBY'}
              {gameState.game.phase === 'night' && '🌙 NOC'}
              {gameState.game.phase === 'day' && '☀️ DEN'}
              {gameState.game.phase === 'end' && '🏁 KONEC'}
            </span>
            {gameState.game.phase !== 'lobby' && (
              <span className="round-badge">Kolo {gameState.game.round}</span>
            )}
          </div>
        )}
      </div>
      
      <div className="top-bar-right">
        <button className="btn-connection" onClick={onConnectionClick}>
          📱 Připojení
        </button>
      </div>
    </div>
  );
}

export default TopBar;
