// src/components/MainMenu/MainMenu.jsx
import React from 'react';
import ModeratorView from '../../moderator/ModeratorView';
import './MainMenu.css';

function MainMenu({ onCreateGame, onJoinGame, onSettings, onExit, isMobile = false, isElectron = false }) {
  const handleCreateGame = () => {
    if (onCreateGame) {
      onCreateGame();
    }
  };

  const handleJoinGame = () => {
    if (onJoinGame) {
      onJoinGame();
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings();
    }
  };

  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  // Create Game is only available in Electron
  const showCreateGame = isElectron;
  // Join Game is available in web version (not Electron) or on mobile devices
  const showJoinGame = !isElectron || isMobile;
  // Settings and Exit are only available in Electron
  const showSettings = isElectron;
  const showExit = isElectron;

  return (
    <div className={`main-menu ${!isElectron ? 'main-menu-web' : ''}`}>
      <div className="menu-header">
        <h1 className="menu-title">Social Deduction Game</h1>
        <p className="menu-subtitle">Choose an action</p>
      </div>
      
      <div className={`menu-content ${!isElectron ? 'menu-content-web' : ''}`}>
        <div className="menu-buttons">
          {showCreateGame && (
            <button 
              className="menu-button menu-button-primary"
              onClick={handleCreateGame}
            >
              <span className="button-text">Create Game</span>
            </button>
          )}

          <button 
            className={`menu-button menu-button-secondary ${!isElectron ? 'menu-button-web-center' : ''}`}
            onClick={handleJoinGame}
            disabled={!showJoinGame}
          >
            <span className="button-text">Join Game</span>
            {!showJoinGame && <span className="button-badge">Soon</span>}
          </button>

          {showSettings && (
            <button 
              className="menu-button menu-button-secondary"
              onClick={handleSettings}
            >
              <span className="button-text">Settings</span>
            </button>
          )}

          {showExit && (
            <button 
              className="menu-button menu-button-danger"
              onClick={handleExit}
            >
              <span className="button-text">Exit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MainMenu;


