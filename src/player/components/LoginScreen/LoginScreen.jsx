// src/player/components/LoginScreen/LoginScreen.jsx
import React from 'react';
import { GAME_NAME } from '../../../config/gameConfig';
import './LoginScreen.css';

function LoginScreen({
  roomCode,
  playerName,
  loading,
  error,
  onRoomCodeChange,
  onPlayerNameChange,
  onLogin
}) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      onLogin();
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <h1>{GAME_NAME}</h1>
          <p>Připoj se ke hře</p>
        </div>

        <form className="login-form" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
          <div className="form-group">
            <label htmlFor="room-code">Room Kód</label>
            <input
              id="room-code"
              type="text"
              placeholder="Zadej 4 číslice"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={loading}
              maxLength="4"
              autoFocus={!roomCode}
            />
          </div>

          <div className="form-group">
            <label htmlFor="player-name">Tvoje Jméno</label>
            <input
              id="player-name"
              type="text"
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoFocus={!!roomCode}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Připojuji se...' : 'Připojit se'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <span>❌</span>
            <p>{error}</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default LoginScreen;
