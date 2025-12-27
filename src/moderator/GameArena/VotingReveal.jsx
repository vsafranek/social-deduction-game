// src/moderator/GameArena/VotingReveal.jsx
import React from "react";
import "./VotingReveal.css";

function VotingReveal({ type, player }) {
  // type: 'execution' | 'mayor_election'
  // player: { name, avatar, _id }
  
  const isExecution = type === 'execution';
  const title = isExecution ? '⚖️ EXECUTED ⚖️' : '🏛️ MAYOR ELECTED 🏛️';
  const message = isExecution 
    ? 'They have been voted out...'
    : 'The new leader has been chosen...';

  return (
    <div className="voting-reveal-overlay">
      <div className="voting-reveal-bg"></div>

      {/* Particles */}
      <div className="voting-particles"></div>

      <div className="voting-reveal-content">
        <div className={`voting-title ${isExecution ? 'execution' : 'mayor'}`}>
          {title}
        </div>

        <div className="voting-player-card">
          <div className="voting-avatar">
            {player.avatar ? (
              <img
                src={player.avatar}
                alt={player.name}
                className="voting-avatar-img"
                onError={(e) => {
                  e.target.style.display = "none";
                  const fallback = e.target.nextElementSibling;
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className="voting-avatar-fallback"
              style={{ display: player.avatar ? "none" : "flex" }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="voting-name">{player.name}</div>
        </div>

        <div className="voting-message">{message}</div>
      </div>
    </div>
  );
}

export default VotingReveal;


