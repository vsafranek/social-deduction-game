// src/player/components/VotingModal/VotingModal.jsx
import React, { useState } from 'react';
import './VotingModal.css';

function VotingModal({ players, onVote, onClose, isMayorElection = false }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const SKIP_VALUE = 'skip';

  // Get details version path of avatar
  const getDetailAvatarPath = (avatarPath) => {
    if (!avatarPath) return null;
    
    // Extract filename and extension
    // avatarPath is like "/avatars/meercat.jpg"
    const pathParts = avatarPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const nameWithoutExt = filename.replace(/\.[^/.]+$/i, '');
    const originalExt = filename.match(/\.[^/.]+$/i)?.[0] || '';
    
    // Construct detail path: /avatars/meercat_detail.jpg
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  const handleVote = () => {
    // Pokud je vybrán skip, pošleme null, jinak ID hráče
    const targetId = selectedPlayer === SKIP_VALUE ? null : selectedPlayer;
    if (selectedPlayer) {
      onVote(targetId);
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
                  {player.avatar ? (
                    <img 
                      src={getDetailAvatarPath(player.avatar) || player.avatar} 
                      alt={player.name}
                      className="vote-avatar-img"
                      onError={(e) => {
                        const img = e.target;
                        const currentSrc = img.src;
                        
                        // Track attempts using data attribute to prevent infinite loops
                        const currentAttempts = parseInt(img.dataset.errorAttempts || '0', 10);
                        const attempts = currentAttempts + 1;
                        img.dataset.errorAttempts = attempts.toString();
                        
                        // Prevent infinite loops - max 3 attempts
                        if (attempts >= 4) {
                          img.style.display = 'none';
                          const fallback = img.nextElementSibling;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                          return;
                        }
                        
                        if (currentSrc.includes('_detail')) {
                          // We're trying a detail variant
                          const pathParts = currentSrc.split('_detail');
                          const basePath = pathParts[0];
                          const ext = pathParts[1];
                          
                          // Try alternate case only on first attempt
                          if (attempts === 1 && ext === ext.toLowerCase() && ext !== ext.toUpperCase()) {
                            img.src = `${basePath}_detail${ext.toUpperCase()}`;
                          } else if (attempts === 1 && ext === ext.toUpperCase() && ext !== ext.toLowerCase()) {
                            img.src = `${basePath}_detail${ext.toLowerCase()}`;
                          } else {
                            // All detail variants failed, use normal avatar
                            img.src = player.avatar;
                          }
                        } else {
                          // Normal avatar also failed, show fallback
                          img.style.display = 'none';
                          const fallback = img.nextElementSibling;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className="vote-avatar-fallback"
                    style={{ display: player.avatar ? 'none' : 'flex' }}
                  >
                    {player.alive ? '✅' : '💀'}
                  </div>
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
            
            {/* Tlačítko pro přeskočení */}
            <button
              className={`player-vote-item skip-vote-item ${selectedPlayer === SKIP_VALUE ? 'selected' : ''}`}
              onClick={() => setSelectedPlayer(SKIP_VALUE)}
            >
              <div className="player-vote-avatar">
                <div className="vote-avatar-fallback" style={{ display: 'flex' }}>
                  ⏭️
                </div>
              </div>
              <div className="player-vote-info">
                <span className="player-vote-name">Přeskočit hlasování</span>
                {selectedPlayer === SKIP_VALUE && (
                  <span className="selected-badge">Vybráno</span>
                )}
              </div>
              {selectedPlayer === SKIP_VALUE && (
                <span className="check-icon">✓</span>
              )}
            </button>
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
            {selectedPlayer === SKIP_VALUE ? 'Přeskočit' : 'Potvrdit hlas'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VotingModal;
