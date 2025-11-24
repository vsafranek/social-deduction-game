// src/player/components/VotingModal/VotingModal.jsx
import React, { useState } from 'react';
import './VotingModal.css';

function VotingModal({ players, onVote, onClose, isMayorElection = false }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const handleVote = () => {
    if (selectedPlayer) {
      onVote(selectedPlayer);
    }
  };

  return (
    <div className="voting-modal-overlay" onClick={onClose}>
      <div className="voting-modal" onClick={(e) => e.stopPropagation()}>
        <div className="voting-modal-header">
          <h2>🗳️ Hlasování</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="voting-modal-content">
          <p className="voting-instruction">
            {isMayorElection 
              ? 'Vyber hráče, který bude zvolen Starostou'
              : 'Vyber hráče, kterého chceš vyloučit ze hry'
            }
          </p>

          <div className="players-voting-list">
            {players.map(player => (
              <button
                key={player._id}
                className={`player-vote-item ${selectedPlayer === player._id ? 'selected' : ''}`}
                onClick={() => setSelectedPlayer(player._id)}
              >
                <div className="player-vote-avatar">
                  {player.alive ? '✅' : '💀'}
                </div>
                <div className="player-vote-info">
                  <span className="player-vote-name">{player.name}</span>
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

        <div className="voting-modal-footer">
          <button 
            className="cancel-vote-button" 
            onClick={onClose}
          >
            Zrušit
          </button>
          <button 
            className="confirm-vote-button" 
            onClick={handleVote}
            disabled={!selectedPlayer}
          >
            Potvrdit hlas
          </button>
        </div>
      </div>
    </div>
  );
}

export default VotingModal;
