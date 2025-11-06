// src/components/moderator/GameArena/GameEndScreen.jsx
import React from 'react';
import './GameEndScreen.css';

function GameEndScreen({ gameState, onReturnToLobby }) {
  const winner = gameState.game.winner; // 'good' | 'evil' | 'neutral'
  const players = gameState.players;
  
  // Rozdělení hráčů
  const winners = players.filter(p => {
    if (winner === 'good') return p.affiliations?.includes('good');
    if (winner === 'evil') return p.affiliations?.includes('evil');
    return p.affiliations?.includes('neutral');
  });
  
  const losers = players.filter(p => !winners.includes(p));
  const dead = players.filter(p => !p.alive);

  return (
    <div className={`game-end-screen ${winner}`}>
      {/* Background overlay */}
      <div className="end-bg-overlay"></div>
      
      {/* Confetti pro výherce */}
      <div className="confetti-container">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="confetti" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`
          }}></div>
        ))}
      </div>

      {/* Main content */}
      <div className="end-content">
        <h1 className="end-title">
          {winner === 'good' && '🎉 GOOD TEAM WINS! 🎉'}
          {winner === 'evil' && '💀 EVIL TEAM WINS! 💀'}
          {winner === 'neutral' && '🌟 NEUTRAL WINS! 🌟'}
        </h1>

        <div className="end-sections">
          {/* Winners */}
          <div className="end-section winners">
            <h2>👑 Winners</h2>
            <div className="player-grid">
              {winners.map(p => (
                <div key={p._id} className="end-player winner">
                  <div className="player-avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="player-info">
                    <div className="player-name">{p.name}</div>
                    <div className="player-role">{p.role}</div>
                    <div className={`player-status ${p.alive ? 'alive' : 'dead'}`}>
                      {p.alive ? '✅ Survived' : '💀 Died'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Losers */}
          <div className="end-section losers">
            <h2>😔 Defeated</h2>
            <div className="player-grid">
              {losers.map(p => (
                <div key={p._id} className="end-player loser">
                  <div className="player-avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="player-info">
                    <div className="player-name">{p.name}</div>
                    <div className="player-role">{p.role}</div>
                    <div className={`player-status ${p.alive ? 'alive' : 'dead'}`}>
                      {p.alive ? '❌ Lost' : '💀 Died'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="end-actions">
          <button className="btn-return-lobby" onClick={onReturnToLobby}>
            🔙 Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameEndScreen;
