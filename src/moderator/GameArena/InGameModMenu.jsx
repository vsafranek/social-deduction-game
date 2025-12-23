// src/components/moderator/GameArena/InGameModMenu.jsx
import React, { useState } from 'react';
import './InGameModMenu.css';

function InGameModMenu({ gameId, onReturnToLobby }) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReturnToLobbyClick = () => {
    setShowConfirm(true);
    setOpen(false);
  };

  const handleConfirm = async () => {
    try {
      await onReturnToLobby();
      setShowConfirm(false);
    } catch (e) {
      console.error('Failed to return to lobby:', e);
      alert('Error returning to lobby');
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <button 
        className={`mod-menu-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        title={open ? 'Close menu' : 'Moderator menu'}
      >
        {open ? '✕' : '⚙️'}
      </button>

      {open && (
        <div className="mod-menu-panel">
          <div className="mod-menu-header">
            <h3>Moderator Menu</h3>
          </div>
          <div className="mod-menu-options">
            {onReturnToLobby && (
              <button className="mod-option danger" onClick={handleReturnToLobbyClick}>
              🔙 Return to Lobby
            </button>
            )}
            {/* Další možnosti pro debug/moderátora */}
            <button className="mod-option" onClick={() => alert('Not implemented yet')}>
              ⏸️ Pause Game
            </button>
            <button className="mod-option" onClick={() => alert('Not implemented yet')}>
              📊 View Stats
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="confirm-modal-overlay" onClick={handleCancel}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <h3>⚠️ Confirm Action</h3>
            </div>
            <div className="confirm-modal-content">
              <p className="confirm-message">
                Return to lobby? This will reset the game for all players.
              </p>
            </div>
            <div className="confirm-modal-actions">
              <button className="confirm-button cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button className="confirm-button confirm" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InGameModMenu;
