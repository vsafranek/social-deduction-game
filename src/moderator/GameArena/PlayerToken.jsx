// src/components/moderator/GameArena/PlayerToken.jsx
import React from 'react';
import './PlayerToken.css';

function PlayerToken({ player, phase, votes, style }) {
  return (
    <div
      className={`player-token ${!player.alive ? 'dead' : ''}`}
      style={style}
      title={player.name}
    >
      {!player.alive && <div className="death-shroud">💀</div>}

      <div className="player-avatar">
        <div className="avatar-ring"></div>
        {player.avatar ? (
          <img 
            src={player.avatar} 
            alt={player.name}
            className="avatar-content avatar-image"
            onError={(e) => {
              // Fallback na písmenko, pokud se obrázek nenačte
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div 
          className="avatar-content avatar-fallback"
          style={{ display: player.avatar ? 'none' : 'flex' }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* badge s počtem hlasů během dne - vpravo nahoře nad avatarem */}
      {phase === 'day' && player.alive && votes > 0 && (
        <div className="vote-badge">🗳️ {votes}</div>
      )}

      {/* veřejné info bez meta */}
      <div className="player-public-info">
        <div className="token-name">{player.name}</div>
        {!player.alive && <div className="token-dead">Mrtvý</div>}
      </div>
    </div>
  );
}

export default PlayerToken;
