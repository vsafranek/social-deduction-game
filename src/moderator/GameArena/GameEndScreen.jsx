// src/player/components/GameEndScreen/GameEndScreen.jsx
import React, { useEffect, useState } from 'react';
import './GameEndScreen.css';

const ROLE_INFO = {
  'Doctor': { emoji: '💉', team: 'good', teamLabel: 'Město' },
  'Jailer': { emoji: '👮', team: 'good', teamLabel: 'Město' },
  'Investigator': { emoji: '🔍', team: 'good', teamLabel: 'Město' },
  'Lookout': { emoji: '👁️', team: 'good', teamLabel: 'Město' },
  'Trapper': { emoji: '🪤', team: 'good', teamLabel: 'Město' },
  'Tracker': { emoji: '👣', team: 'good', teamLabel: 'Město' },
  'Citizen': { emoji: '👤', team: 'good', teamLabel: 'Město' },
  'Killer': { emoji: '🔪', team: 'evil', teamLabel: 'Mafie' },
  'Cleaner': { emoji: '🧹', team: 'evil', teamLabel: 'Mafie' },
  'Framer': { emoji: '🖼️', team: 'evil', teamLabel: 'Mafie' },
  'Diplomat': { emoji: '🕊️', team: 'neutral', teamLabel: 'Neutrální' },
  'Survivor': { emoji: '🛡️', team: 'neutral', teamLabel: 'Sériový vrah' },
  'Infected': { emoji: '🦠', team: 'neutral', teamLabel: 'Nakažlivý' }
};

const MODIFIER_INFO = {
  'Drunk': { emoji: '🍺', label: 'Opilý' },
  'Recluse': { emoji: '🏚️', label: 'Poustevník' }
};

const WINNER_LABELS = {
  'good': { label: 'Město vyhrává!', emoji: '✨', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  'evil': { label: 'Mafie vyhrává!', emoji: '🔥', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  'solo': { label: 'Sólové vítězství!', emoji: '👑', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  'custom': { label: 'Speciální vítězství!', emoji: '🌟', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)' },
  'draw': { label: 'Remíza', emoji: '🤝', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)' }
};

function GameEndScreen({ gameState, currentPlayer }) {
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowAnimation(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!gameState || !gameState.game) return null;

  const winner = gameState.game.winner || 'draw';
  const winnerInfo = WINNER_LABELS[winner] || WINNER_LABELS['draw'];
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

  return (
    <div className="game-end-screen">
      {showAnimation && (
        <div className="victory-animation">
          <div className="victory-banner" style={{ background: winnerInfo.gradient }}>
            <span className="victory-emoji">{winnerInfo.emoji}</span>
            <h1>{winnerInfo.label}</h1>
          </div>
        </div>
      )}

      <div className={`end-content ${showAnimation ? 'hidden' : ''}`}>
        <div className="end-header" style={{ background: winnerInfo.gradient }}>
          <h2>{winnerInfo.emoji} {winnerInfo.label}</h2>
        </div>

        <div className="teams-container">
          {/* Town */}
          {goodPlayers.length > 0 && (
            <div className="team-section good">
              <h3 className="team-title">
                <span className="team-icon">✨</span>
                Město
              </h3>
              <div className="players-grid">
                {goodPlayers.map(player => {
                  const roleData = ROLE_INFO[player.role] || ROLE_INFO['Citizen'];
                  const modifier = player.modifier ? MODIFIER_INFO[player.modifier] : null;
                  const won = isWinner(player._id);
                  const isSelf = isCurrentPlayer(player._id);

                  return (
                    <div 
                      key={player._id} 
                      className={`player-card ${won ? 'winner' : ''} ${isSelf ? 'self' : ''} ${player.alive ? 'alive' : 'dead'}`}
                    >
                      <div className="player-card-header">
                        <span className="role-emoji">{roleData.emoji}</span>
                        <div className="player-info">
                          <span className="player-name">{player.name}</span>
                          {isSelf && <span className="self-badge">TY</span>}
                        </div>
                        {won && <span className="winner-crown">👑</span>}
                      </div>
                      <div className="player-card-body">
                        <span className="role-name">{player.role}</span>
                        {modifier && (
                          <span className="modifier-badge">
                            {modifier.emoji} {modifier.label}
                          </span>
                        )}
                      </div>
                      <div className="player-card-footer">
                        <span className={`status-badge ${player.alive ? 'alive' : 'dead'}`}>
                          {player.alive ? '✅ Živý' : '💀 Mrtvý'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mafia */}
          {evilPlayers.length > 0 && (
            <div className="team-section evil">
              <h3 className="team-title">
                <span className="team-icon">🔥</span>
                Mafie
              </h3>
              <div className="players-grid">
                {evilPlayers.map(player => {
                  const roleData = ROLE_INFO[player.role] || ROLE_INFO['Citizen'];
                  const modifier = player.modifier ? MODIFIER_INFO[player.modifier] : null;
                  const won = isWinner(player._id);
                  const isSelf = isCurrentPlayer(player._id);

                  return (
                    <div 
                      key={player._id} 
                      className={`player-card ${won ? 'winner' : ''} ${isSelf ? 'self' : ''} ${player.alive ? 'alive' : 'dead'}`}
                    >
                      <div className="player-card-header">
                        <span className="role-emoji">{roleData.emoji}</span>
                        <div className="player-info">
                          <span className="player-name">{player.name}</span>
                          {isSelf && <span className="self-badge">TY</span>}
                        </div>
                        {won && <span className="winner-crown">👑</span>}
                      </div>
                      <div className="player-card-body">
                        <span className="role-name">{player.role}</span>
                        {modifier && (
                          <span className="modifier-badge">
                            {modifier.emoji} {modifier.label}
                          </span>
                        )}
                      </div>
                      <div className="player-card-footer">
                        <span className={`status-badge ${player.alive ? 'alive' : 'dead'}`}>
                          {player.alive ? '✅ Živý' : '💀 Mrtvý'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Neutral */}
          {neutralPlayers.length > 0 && (
            <div className="team-section neutral">
              <h3 className="team-title">
                <span className="team-icon">🌟</span>
                Neutrální
              </h3>
              <div className="players-grid">
                {neutralPlayers.map(player => {
                  const roleData = ROLE_INFO[player.role] || ROLE_INFO['Citizen'];
                  const modifier = player.modifier ? MODIFIER_INFO[player.modifier] : null;
                  const won = isWinner(player._id);
                  const isSelf = isCurrentPlayer(player._id);

                  return (
                    <div 
                      key={player._id} 
                      className={`player-card ${won ? 'winner' : ''} ${isSelf ? 'self' : ''} ${player.alive ? 'alive' : 'dead'}`}
                    >
                      <div className="player-card-header">
                        <span className="role-emoji">{roleData.emoji}</span>
                        <div className="player-info">
                          <span className="player-name">{player.name}</span>
                          {isSelf && <span className="self-badge">TY</span>}
                        </div>
                        {won && <span className="winner-crown">👑</span>}
                      </div>
                      <div className="player-card-body">
                        <span className="role-name">{player.role}</span>
                        {modifier && (
                          <span className="modifier-badge">
                            {modifier.emoji} {modifier.label}
                          </span>
                        )}
                      </div>
                      <div className="player-card-footer">
                        <span className={`status-badge ${player.alive ? 'alive' : 'dead'}`}>
                          {player.alive ? '✅ Živý' : '💀 Mrtvý'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameEndScreen;
