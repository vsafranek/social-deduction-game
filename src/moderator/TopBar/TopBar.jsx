// src/moderator/TopBar/TopBar.jsx
import React, { useState } from 'react';
import './TopBar.css';

function TopBar({ gameState, onConnectionClick, onDevToggle, onTestStories }) {
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isInLobby = gameState?.game?.phase === 'lobby';

  // TopBar se zobrazí pouze v lobby
  if (!isInLobby) {
    return null;
  }

  const handleDevToggle = () => {
    setIsDevPanelOpen(!isDevPanelOpen);
    if (onDevToggle) {
      onDevToggle(!isDevPanelOpen);
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>🎮 Lobby - Waiting for Players</h1>
      </div>

      <div className="topbar-right">
        {/* Test Stories Button - only visible in development */}
        {isDevelopment && onTestStories && (
          <button
            className="topbar-button test-stories-button"
            onClick={onTestStories}
            title="Play preview of all night stories"
            style={{ marginRight: '8px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.5)' }}
          >
            🎬 Stories Test
          </button>
        )}

        {/* Počet připojených hráčů */}
        <div className="player-count">
          👥 {gameState?.players?.length || 0} players
        </div>

        {/* Info tlačítko */}
        <button 
          className="topbar-button info-button"
          onClick={onConnectionClick}
          title="Show room code and connection URL"
        >
          ℹ️ Connection
        </button>

        {/* Dev tlačítko - pouze v development */}
        {isDevelopment && (
          <button 
            className={`topbar-button dev-button ${isDevPanelOpen ? 'active' : ''}`}
            onClick={handleDevToggle}
            title="Open dev panel (for testing)"
          >
            🛠️ Dev Panel
          </button>
        )}
      </div>
    </div>
  );
}

export default TopBar;
