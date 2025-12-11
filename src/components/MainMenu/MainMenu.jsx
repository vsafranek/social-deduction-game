// src/components/MainMenu/MainMenu.jsx
import React from 'react';
import ModeratorView from '../../moderator/ModeratorView';
import './MainMenu.css';

function MainMenu({ onCreateGame, onJoinGame, onSettings, onExit }) {
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

  return (
    <div className="main-menu">
      <div className="menu-header">
        <h1 className="menu-title">Social Deduction Game</h1>
        <p className="menu-subtitle">Choose an action</p>
      </div>
      
      <div className="menu-content">
        <div className="menu-buttons">
          <button 
            className="menu-button menu-button-primary"
            onClick={handleCreateGame}
          >
            <span className="button-text">Create Game</span>
          </button>

          <button 
            className="menu-button menu-button-secondary"
            onClick={handleJoinGame}
            disabled
          >
            <span className="button-text">Join Game</span>
            <span className="button-badge">Soon</span>
          </button>

          <button 
            className="menu-button menu-button-secondary"
            onClick={handleSettings}
          >
            <span className="button-text">Settings</span>
          </button>

          <button 
            className="menu-button menu-button-danger"
            onClick={handleExit}
          >
            <span className="button-text">Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MainMenu;
