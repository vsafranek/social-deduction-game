// src/moderator/GameArena/GameEndScreen.jsx
import React, { useEffect, useState } from 'react';
import RoleIcon from '../../components/icons/RoleIcon';
import { getRoleInfo, getModifierInfo } from '../../data/roleInfo';
import InGameModMenu from './InGameModMenu';
import './GameEndScreen.css';

const WINNER_LABELS = {
  'good': { 
    label: 'The Order wins!', 
    gradient: 'linear-gradient(135deg, rgba(46, 125, 50, 0.3), rgba(27, 94, 32, 0.2))',
    description: 'All criminals have been eliminated!'
  },
  'evil': { 
    label: 'The Shadows win!', 
    gradient: 'linear-gradient(135deg, rgba(198, 40, 40, 0.3), rgba(183, 28, 28, 0.2))',
    description: 'The Shadows have taken control!'
  },
  'solo': { 
    label: 'Solo Victory!', 
    gradient: 'linear-gradient(135deg, rgba(245, 127, 23, 0.3), rgba(230, 81, 0, 0.2))',
    description: 'Last survivor!'
  },
  'custom': { 
    label: 'Special Victory!', 
    gradient: 'linear-gradient(135deg, rgba(106, 27, 154, 0.3), rgba(74, 20, 140, 0.2))',
    description: 'Special win condition!'
  },
  'unknown': {
    label: 'Unknown Result',
    gradient: 'linear-gradient(135deg, rgba(69, 90, 100, 0.3), rgba(38, 50, 56, 0.2))',
    description: 'Waiting for winner confirmation.'
  }
};

function GameEndScreen({ gameState, currentPlayer, onReturnToLobby, onReturnToMenu }) {
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
        label: 'Jester Victory!',
        gradient: 'linear-gradient(135deg, rgba(123, 31, 162, 0.3), rgba(74, 20, 140, 0.2))',
        description: 'The Jester was executed and won!'
      };
    } else if (winnerPlayer?.role === 'Infected') {
      winnerInfo = {
        label: 'Infected Victory!',
        gradient: 'linear-gradient(135deg, rgba(81, 45, 168, 0.3), rgba(49, 27, 146, 0.2))',
        description: 'All players have been infected!'
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

  // Get details version path of avatar
  const getDetailAvatarPath = (avatarPath) => {
    if (!avatarPath) return null;
    
    // Extract filename and extension
    // avatarPath is like "/avatars/meercat.jpg"
    const pathParts = avatarPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const nameWithoutExt = filename.replace(/\.[^/.]+$/i, '');
    const originalExt = filename.match(/\.[^/.]+$/i)?.[0] || '';
    
    // Construct detail path: /avatars/meercat_detail.jpg
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  const renderPlayerCard = (player, showTeamLabel = true) => {
    const roleInfo = getRoleInfo(player.role);
    const modifierInfo = getModifierInfo(player.modifier);
    const isPlayerWinner = isWinner(player._id);
    const isCurrent = isCurrentPlayer(player._id);
    const isDead = !player.alive;
    const hasAvatar = player.avatar && player.avatar.trim();
    const detailAvatarPath = hasAvatar ? getDetailAvatarPath(player.avatar) : null;

    return (
      <div 
        key={player._id}
        className={`player-card ${isPlayerWinner ? 'winner' : 'loser'} ${isCurrent ? 'self' : ''} ${isDead ? 'dead' : ''}`}
      >
        <div className="player-card-header">
          {hasAvatar ? (
            <img 
              src={detailAvatarPath || player.avatar} 
              alt={player.name}
              className="player-card-avatar"
              onError={(e) => {
                const img = e.target;
                const currentSrc = img.src;
                
                // Track attempts using data attribute to prevent infinite loops
                const currentAttempts = parseInt(img.dataset.errorAttempts || '0', 10);
                const attempts = currentAttempts + 1;
                img.dataset.errorAttempts = attempts.toString();
                
                // Prevent infinite loops - max 3 attempts
                if (attempts >= 4) {
                  img.style.display = 'none';
                  if (img.nextSibling) {
                    img.nextSibling.style.display = 'flex';
                  }
                  return;
                }
                
                if (currentSrc.includes('_detail')) {
                  // We're trying a detail variant
                  const pathParts = currentSrc.split('_detail');
                  const basePath = pathParts[0];
                  const ext = pathParts[1];
                  
                  // Try alternate case only on first attempt
                  if (attempts === 1 && ext === ext.toLowerCase() && ext !== ext.toUpperCase()) {
                    img.src = `${basePath}_detail${ext.toUpperCase()}`;
                  } else if (attempts === 1 && ext === ext.toUpperCase() && ext !== ext.toLowerCase()) {
                    img.src = `${basePath}_detail${ext.toLowerCase()}`;
                  } else {
                    // All detail variants failed, use normal avatar
                    img.src = player.avatar;
                  }
                } else {
                  // Normal avatar also failed, show fallback
                  img.style.display = 'none';
                  if (img.nextSibling) {
                    img.nextSibling.style.display = 'flex';
                  }
                }
              }}
            />
          ) : null}
          <div 
            className="player-card-avatar-fallback"
            style={{ 
              display: hasAvatar ? 'none' : 'flex',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle at 30% 30%, #3e2723, #1a1520)',
              border: '1px solid rgba(197, 160, 89, 0.2)',
              fontSize: '20px',
              color: '#c5a059',
              fontWeight: 'bold',
              fontFamily: "'MedievalSharp', cursive",
              flexShrink: 0
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <span className="role-emoji">
            <RoleIcon role={player.role} size={48} className="role-icon" useDetails={true} />
          </span>
          
          <div className="player-info">
            <div className="player-name">
              {player.name}
              {isCurrent && <span className="self-badge">(You)</span>}
            </div>
            
            {isPlayerWinner && (
              <span className="winner-crown" title="Winner">👑</span>
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
            {player.alive ? '✅ Survived' : '💀 Died'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="game-end-screen">
      {/* Moderator Menu - Top Right */}
      <InGameModMenu 
        gameId={gameState.game._id}
        onReturnToLobby={onReturnToLobby}
      />

      {/* Victory Animation */}
      {showAnimation && (
        <div className="victory-animation" style={{ background: winnerInfo.gradient }}>
          <div className="victory-banner">
            <h1>{winnerInfo.label}</h1>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="end-content">
        {/* ✅ Compact Header */}
        <div className="end-header" style={{ background: winnerInfo.gradient }}>
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
                The Order ({goodPlayers.length})
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
                The Shadows ({evilPlayers.length})
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
                Neutral Players
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
            <span className="stat-label">Round</span>
            <span className="stat-value">{gameState.game.round}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Survivors</span>
            <span className="stat-value">
              {players.filter(p => p.alive).length}/{players.length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Winners</span>
            <span className="stat-value">{winnerIds.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameEndScreen;
