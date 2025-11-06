// src/moderator/TopBar/TopBar.jsx
import React, { useState } from 'react';
import './TopBar.css';

function TopBar({ gameState, onConnectionClick, onDevToggle }) {
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
        <h1>🎮 Lobby - Čekání na Hráče</h1>
      </div>

      <div className="topbar-right">
        {/* Počet připojených hráčů */}
        <div className="player-count">
          👥 {gameState?.players?.length || 0} hráčů
        </div>

        {/* Info tlačítko */}
        <button 
          className="topbar-button info-button"
          onClick={onConnectionClick}
          title="Zobrazit room code a URL pro připojení"
        >
          ℹ️ Připojení
        </button>

        {/* Dev tlačítko - pouze v development */}
        {isDevelopment && (
          <button 
            className={`topbar-button dev-button ${isDevPanelOpen ? 'active' : ''}`}
            onClick={handleDevToggle}
            title="Otevřít dev panel (pro testování)"
          >
            🛠️ Dev Panel
          </button>
        )}
      </div>
    </div>
  );
}

export default TopBar;
