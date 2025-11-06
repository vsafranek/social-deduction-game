// src/components/moderator/GameArena/DeathReveal.jsx
import React from 'react';
import './DeathReveal.css';

function DeathReveal({ deadPlayers }) {
  return (
    <div className="death-reveal-overlay">
      <div className="death-reveal-bg"></div>
      
      {/* Particles */}
      <div className="death-particles"></div>
      
      <div className="death-reveal-content">
        <div className="death-title">💀 THE FALLEN 💀</div>
        
        <div className="death-list">
          {deadPlayers.map((player, idx) => (
            <div 
              key={player._id} 
              className="death-card"
              style={{ animationDelay: `${idx * 0.3}s` }}
            >
              <div className="death-avatar">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="death-name">{player.name}</div>
              <div className="death-role">{player.role || 'Unknown'}</div>
            </div>
          ))}
        </div>
        
        <div className="death-message">
          They will be remembered...
        </div>
      </div>
    </div>
  );
}

export default DeathReveal;
