// src/player/components/NightActionModal/NightActionModal.jsx
import React, { useState } from 'react';
import './NightActionModal.css';

function NightActionModal({ 
  players, 
  onAction, 
  onClose, 
  actionInfo, 
  selectedMode,
  isDualRole,
  usesRemaining 
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const handleConfirm = () => {
    if (selectedPlayer) {
      onAction(selectedPlayer, selectedMode);
      onClose();
    }
  };

  const currentActionInfo = isDualRole && actionInfo?.actions
    ? actionInfo.actions[selectedMode]
    : actionInfo;

  return (
    <div className="night-action-modal-overlay" onClick={onClose}>
      <div className="night-action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="night-action-modal-header">
          <h2>{currentActionInfo?.icon} {currentActionInfo?.verb}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="night-action-modal-content">
          <p className="action-instruction">
            {currentActionInfo?.description}
          </p>

          {isDualRole && selectedMode !== 'kill' && (
            <div className="uses-remaining-modal">
              ⚡ Speciální akce: {usesRemaining}x
            </div>
          )}

          {players.length === 0 && (
            <div className="no-players-message">
              <p>💀 {currentActionInfo?.verb === 'Proveď pitvu' ? 'Žádní mrtví hráči k vyšetření' : 'Žádní hráči k výběru'}</p>
            </div>
          )}

          <div className="players-action-list">
            {players.map(player => (
              <button
                key={player._id}
                className={`player-action-item ${selectedPlayer === player._id ? 'selected' : ''}`}
                onClick={() => setSelectedPlayer(player._id)}
              >
                <div className="player-action-avatar">
                  {player.avatar ? (
                    <img 
                      src={player.avatar} 
                      alt={player.name}
                      className="action-avatar-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.nextElementSibling;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className="action-avatar-fallback"
                    style={{ display: player.avatar ? 'none' : 'flex' }}
                  >
                    {player.alive ? '✅' : '💀'}
                  </div>
                </div>
                <div className="player-action-info">
                  <span className="player-action-name">{player.name}</span>
                  {!player.alive && (
                    <span className="dead-badge">💀 Mrtvý</span>
                  )}
                  {selectedPlayer === player._id && (
                    <span className="selected-badge">Vybráno</span>
                  )}
                </div>
                {selectedPlayer === player._id && (
                  <span className="check-icon">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="night-action-modal-footer">
          <button 
            className="cancel-action-button" 
            onClick={onClose}
          >
            Zrušit
          </button>
          <button 
            className={`confirm-action-button ${currentActionInfo?.color || 'blue'}`}
            onClick={handleConfirm}
            disabled={!selectedPlayer}
          >
            Potvrdit akci
          </button>
        </div>
      </div>
    </div>
  );
}

export default NightActionModal;


