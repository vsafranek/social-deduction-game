// src/player/components/PlayersList/PlayersList.jsx
import React from 'react';
import './PlayersList.css';

function PlayersList({ 
  players, 
  onSelectPlayer, 
  selectedPlayer, 
  selectionMode = 'single',
  emptyMessage = 'Žádní hráči k dispozici'
}) {
  if (players.length === 0) {
    return (
      <div className="players-list-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const handlePlayerClick = (playerId) => {
    if (selectionMode === 'single') {
      onSelectPlayer(playerId === selectedPlayer ? null : playerId);
    }
  };

  return (
    <div className="players-list">
      {players.map(player => (
        <button
          key={player._id}
          className={`player-list-item ${selectedPlayer === player._id ? 'selected' : ''}`}
          onClick={() => handlePlayerClick(player._id)}
        >
          <div className="player-avatar">
            {player.alive ? '✅' : '💀'}
          </div>
          <div className="player-info">
            <span className="player-name">{player.name}</span>
            <span className="player-status">
              {player.alive ? 'Živý' : 'Mrtvý'}
            </span>
          </div>
          {selectedPlayer === player._id && (
            <div className="player-check">✓</div>
          )}
        </button>
      ))}
    </div>
  );
}

export default PlayersList;
