// src/components/moderator/GameArena/InGameModMenu.jsx
import React, { useState } from 'react';
import './InGameModMenu.css';

function InGameModMenu({ gameId, onReturnToLobby }) {
  const [open, setOpen] = useState(false);

  const handleReturnToLobby = async () => {
    if (!window.confirm('Return to lobby? This will reset the game for all players.')) {
      return;
    }
    try {
      await onReturnToLobby();
      setOpen(false);
    } catch (e) {
      console.error('Failed to return to lobby:', e);
      alert('Error returning to lobby');
    }
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
            <button className="mod-option danger" onClick={handleReturnToLobby}>
              🔙 Return to Lobby
            </button>
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
    </>
  );
}

export default InGameModMenu;
