// src/player/components/GameEndScreen/GameEndScreen.jsx
import React, { useEffect, useState } from 'react';
import './GameEndScreen.css';

const ROLE_INFO = {
  // GOOD
  'Doctor': { emoji: '💉', team: 'good', teamLabel: 'Město' },
  'Jailer': { emoji: '👮', team: 'good', teamLabel: 'Město' },
  'Investigator': { emoji: '🔍', team: 'good', teamLabel: 'Město' },
  'Lookout': { emoji: '👁️', team: 'good', teamLabel: 'Město' },
  'Trapper': { emoji: '🪤', team: 'good', teamLabel: 'Město' },
  'Tracker': { emoji: '👣', team: 'good', teamLabel: 'Město' },
  'Hunter': { emoji: '🏹', team: 'good', teamLabel: 'Město' },
  'Citizen': { emoji: '👤', team: 'good', teamLabel: 'Město' },
  
  // EVIL
  'Killer': { emoji: '🔪', team: 'evil', teamLabel: 'Mafie' },
  'Cleaner': { emoji: '🧹', team: 'evil', teamLabel: 'Mafie' },
  'Framer': { emoji: '🖼️', team: 'evil', teamLabel: 'Mafie' },
  'Consigliere': { emoji: '🕵️', team: 'evil', teamLabel: 'Mafie' },
  
  // NEUTRAL (each is individual)
  'Diplomat': { emoji: '🕊️', team: 'neutral', teamLabel: 'Diplomat' },
  'Survivor': { emoji: '🛡️', team: 'neutral', teamLabel: 'Survivor' },
  'Infected': { emoji: '🦠', team: 'neutral', teamLabel: 'Infected' }
};

const MODIFIER_INFO = {
  'Drunk': { emoji: '🍺', label: 'Opilý' },
  'Recluse': { emoji: '🏚️', label: 'Poustevník' },
  'Paranoid': { emoji: '😱', label: 'Paranoidní' },
  'Insomniac': { emoji: '😵', label: 'Nespavec' }
};

const WINNER_LABELS = {
  'good': { 
    label: 'Město vyhrává!', 
    emoji: '✨', 
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    description: 'Všichni zločinci byli eliminováni!'
  },
  'evil': { 
    label: 'Mafie vyhrává!', 
    emoji: '🔥', 
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    description: 'Mafie převzala kontrolu!'
  },
  'solo': { 
    label: 'Sólové vítězství!', 
    emoji: '👑', 
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: 'Poslední přeživší!'
  },
  'custom': { 
    label: 'Speciální vítězství!', 
    emoji: '🌟', 
    gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    description: 'Speciální win condition!'
  }
};

function GameEndScreen({ gameState, currentPlayer }) {
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowAnimation(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!gameState || !gameState.game) return null;

  const winner = gameState.game.winner || 'good';
  const winnerInfo = WINNER_LABELS[winner] || WINNER_LABELS['good'];
  const players = gameState.players || [];
  const winnerIds = gameState.game.winnerPlayerIds || [];

  // Rozdělení hráčů podle teamu
  const goodPlayers = players.filter(p => {
    const role = ROLE_INFO[p.role];
    return role && role.team === 'good';
  });

  const evilPlayers = players.filter(p => {
    const role = ROLE_INFO[p.role];
    return role && role.team === 'evil';
  });

  const neutralPlayers = players.filter(p => {
    const role = ROLE_INFO[p.role];
    return role && role.team === 'neutral';
  });

  const isWinner = (playerId) => {
    return winnerIds.some(id => id.toString() === playerId.toString());
  };

  const isCurrentPlayer = (playerId) => {
    return currentPlayer && playerId.toString() === currentPlayer._id.toString();
  };

  const renderPlayerCard = (player, showTeamLabel = true) => {
    const roleInfo = ROLE_INFO[player.role] || { emoji: '❓', team: 'neutral', teamLabel: '?' };
    const modifierInfo = player.modifier ? MODIFIER_INFO[player.modifier] : null;
    const isPlayerWinner = isWinner(player._id);
    const isCurrent = isCurrentPlayer(player._id);
    const isDead = !player.alive;

    return (
      <div 
        key={player._id}
        className={`player-card ${isPlayerWinner ? 'winner' : 'loser'} ${isCurrent ? 'self' : ''} ${isDead ? 'dead' : ''}`}
      >
        <div className="player-card-header">
          <span className="role-emoji">{roleInfo.emoji}</span>
          
          <div className="player-info">
            <div className="player-name">
              {player.name}
              {isCurrent && <span className="self-badge">(Ty)</span>}
            </div>
            
            {isPlayerWinner && (
              <span className="winner-crown" title="Vítěz">👑</span>
            )}
          </div>
        </div>

        <div className="player-card-body">
          <div className="role-name">{player.role}</div>
          
          {modifierInfo && (
            <span className="modifier-badge" title={modifierInfo.label}>
              {modifierInfo.emoji} {modifierInfo.label}
            </span>
          )}
        </div>

        <div className="player-card-footer">
          <span className={`status-badge ${player.alive ? 'alive' : 'dead'}`}>
            {player.alive ? '✅ Přežil' : '💀 Zemřel'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="game-end-screen">
      {/* Victory Animation */}
      {showAnimation && (
        <div className="victory-animation" style={{ background: winnerInfo.gradient }}>
          <div className="victory-banner">
            <span className="victory-emoji">{winnerInfo.emoji}</span>
            <h1>{winnerInfo.label}</h1>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="end-content">
        {/* ✅ Compact Header */}
        <div className="end-header" style={{ background: winnerInfo.gradient }}>
          <span className="victory-emoji-small">{winnerInfo.emoji}</span>
          <div className="header-text">
            <h2>{winnerInfo.label}</h2>
            <p>{winnerInfo.description}</p>
          </div>
        </div>

        {/* Team Sections */}
        <div className="teams-container">
          {/* Good Team */}
          {goodPlayers.length > 0 && (
            <div className="team-section good">
              <h3 className="team-title">
                <span className="team-icon">✨</span>
                Město ({goodPlayers.length})
              </h3>
              <div className="players-grid">
                {goodPlayers.map(p => renderPlayerCard(p))}
              </div>
            </div>
          )}

          {/* Evil Team */}
          {evilPlayers.length > 0 && (
            <div className="team-section evil">
              <h3 className="team-title">
                <span className="team-icon">🔥</span>
                Mafie ({evilPlayers.length})
              </h3>
              <div className="players-grid">
                {evilPlayers.map(p => renderPlayerCard(p))}
              </div>
            </div>
          )}

          {/* ✅ Neutral Players - Each in Own Container */}
          {neutralPlayers.length > 0 && (
            <div className="neutrals-section">
              <h3 className="section-title">
                <span className="team-icon">⚖️</span>
                Neutrální hráči
              </h3>
              <div className="neutrals-grid">
                {neutralPlayers.map(player => {
                  const roleInfo = ROLE_INFO[player.role] || { emoji: '❓', teamLabel: 'Neutrální' };
                  
                  return (
                    <div key={player._id} className="neutral-container">
                      <div className="neutral-header">
                        <span className="neutral-role-label">{roleInfo.teamLabel}</span>
                      </div>
                      <div className="neutral-player-wrapper">
                        {renderPlayerCard(player, false)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Game Stats */}
        <div className="game-stats">
          <div className="stat-card">
            <span className="stat-label">Kol</span>
            <span className="stat-value">{gameState.game.round}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Přeživší</span>
            <span className="stat-value">
              {players.filter(p => p.alive).length}/{players.length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Vítězů</span>
            <span className="stat-value">{winnerIds.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameEndScreen;
