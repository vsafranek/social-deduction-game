// src/moderator/GameArena/GameEndScreen.jsx
import React, { useEffect, useState } from 'react';
import RoleIcon from '../../components/icons/RoleIcon';
import { getRoleInfo, getModifierInfo } from '../../data/roleInfo';
import './GameEndScreen.css';

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
  },
  'unknown': {
    label: 'Výsledek neznámý',
    emoji: '❔',
    gradient: 'linear-gradient(135deg, #6b7280, #4b5563)',
    description: 'Čekáme na potvrzení vítěze.'
  }
};

function GameEndScreen({ gameState, currentPlayer }) {
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowAnimation(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!gameState || !gameState.game) return null;

  const winner = gameState.game.winner || 'unknown';
  const players = gameState.players || [];
  const winnerIds = gameState.game.winnerPlayerIds || [];
  
  // Determine custom winner type (Jester or Infected)
  let winnerInfo = WINNER_LABELS[winner] || WINNER_LABELS['unknown'];
  if (winner === 'custom') {
    const winnerPlayer = players.find(p => winnerIds.includes(p._id?.toString?.() ?? p._id));
    if (winnerPlayer?.role === 'Jester') {
      winnerInfo = {
        label: 'Vítězství Šaška!',
        emoji: '🎭',
        gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
        description: 'Šašek byl vyhlasován a vyhrál!'
      };
    } else if (winnerPlayer?.role === 'Infected') {
      winnerInfo = {
        label: 'Vítězství Nakaženého!',
        emoji: '🦠',
        gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        description: 'Všichni hráči byli nakaženi!'
      };
    }
  }

  // Rozdělení hráčů podle teamu
  const goodPlayers = players.filter(p => {
    const role = getRoleInfo(p.role);
    return role && role.team === 'good';
  });

  const evilPlayers = players.filter(p => {
    const role = getRoleInfo(p.role);
    return role && role.team === 'evil';
  });

  const neutralPlayers = players.filter(p => {
    const role = getRoleInfo(p.role);
    return role && role.team === 'neutral';
  });

  const isWinner = (playerId) => {
    return winnerIds.some(id => id.toString() === playerId.toString());
  };

  const isCurrentPlayer = (playerId) => {
    return currentPlayer && playerId.toString() === currentPlayer._id.toString();
  };

  const renderPlayerCard = (player, showTeamLabel = true) => {
    const roleInfo = getRoleInfo(player.role);
    const modifierInfo = getModifierInfo(player.modifier);
    const isPlayerWinner = isWinner(player._id);
    const isCurrent = isCurrentPlayer(player._id);
    const isDead = !player.alive;

    return (
      <div 
        key={player._id}
        className={`player-card ${isPlayerWinner ? 'winner' : 'loser'} ${isCurrent ? 'self' : ''} ${isDead ? 'dead' : ''}`}
      >
        <div className="player-card-header">
          {player.avatar ? (
            <img 
              src={player.avatar} 
              alt={player.name}
              className="player-card-avatar"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div 
            className="player-card-avatar-fallback"
            style={{ 
              display: player.avatar ? 'none' : 'flex',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              fontSize: '20px',
              color: '#fff',
              fontWeight: 'bold',
              flexShrink: 0
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <span className="role-emoji">
            <RoleIcon role={player.role} size={48} className="role-icon" />
          </span>
          
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
              <RoleIcon role={player.modifier} size={28} className="modifier-icon-inline" isModifier={true} /> {modifierInfo.label}
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
                  const roleInfo = getRoleInfo(player.role);
                  
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
