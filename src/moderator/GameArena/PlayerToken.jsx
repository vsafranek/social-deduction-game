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
        <div className="avatar-content">{player.name.charAt(0).toUpperCase()}</div>
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
