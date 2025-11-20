// src/player/components/PlayersList/PlayersList.jsx
import React from 'react';
import './PlayersList.css';

function PlayersList({ 
  players, 
  onSelectPlayer,  // ✅ Primary prop name
  onSelect,        // ✅ Alias for compatibility
  selectedPlayer,  // ✅ Primary prop name
  selectedPlayerId, // ✅ Alias for compatibility
  selectionMode = 'single',
  showRole = false,
  emptyMessage = 'Žádní hráči k dispozici'
}) {
  // ✅ Support both prop names
  const handleSelect = onSelectPlayer || onSelect;
  const selected = selectedPlayer || selectedPlayerId;

  if (players.length === 0) {
    return (
      <div className="players-list-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const handlePlayerClick = (playerId) => {
    if (!handleSelect) {
      console.warn('⚠️ No onSelect or onSelectPlayer handler provided');
      return;
    }

    console.log('🎯 Player clicked:', playerId);
    
    if (selectionMode === 'single') {
      // Toggle selection
      handleSelect(playerId === selected ? null : playerId);
    } else {
      // Always select (no toggle)
      handleSelect(playerId);
    }
  };

  return (
    <div className="players-list">
      {players.map(player => (
        <button
          key={player._id}
          className={`player-list-item ${selected === player._id ? 'selected' : ''}`}
          onClick={() => handlePlayerClick(player._id)}
          type="button"
        >
          <div className="player-avatar">
            {player.alive ? '✅' : '💀'}
          </div>
          <div className="player-info">
            <span className="player-name">{player.name}</span>
            <span className="player-status">
              {player.alive ? 'Živý' : 'Mrtvý'}
              {showRole && player.role && ` - ${player.role}`}
            </span>
          </div>
          {selected === player._id && (
            <div className="player-check">✓</div>
          )}
        </button>
      ))}
    </div>
  );
}

export default PlayersList;
