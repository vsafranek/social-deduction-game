// src/moderator/TopBar/TopBar.jsx
import React, { useState } from 'react';
import './TopBar.css';

function TopBar({ gameState, onConnectionClick, onDevToggle, onTestStories, onReturnToMenu, onSettings }) {
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
        <h1> Lobby - Waiting for Players</h1>
      </div>

      <div className="topbar-right">
        {/* Test Stories Button - only visible in development */}
        {isDevelopment && onTestStories && (
          <button
            className="topbar-button test-stories-button"
            onClick={onTestStories}
            title="Play preview of all night stories"
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

        

        {/* Return to menu button */}
        {onReturnToMenu && (
          <button 
            className="topbar-button"
            onClick={onReturnToMenu}
            title="Return to main menu"
          >
            Menu
          </button>
        )}
        {/* Settings button */}
        {onSettings && (
          <button 
            className="topbar-button settings-button"
            onClick={onSettings}
            title="Settings"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}

export default TopBar;
