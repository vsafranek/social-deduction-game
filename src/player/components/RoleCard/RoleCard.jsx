// src/player/components/RoleCard/RoleCard.jsx
import React, { useState } from 'react';
import RoleIcon from '../../../components/icons/RoleIcon';
import { getRoleInfo } from '../../../data/roleInfo';
import './RoleCard.css';

function RoleCard({ player, gameState }) {
  const [expanded, setExpanded] = useState(false);
  const role = player.role || 'Citizen';
  const roleData = getRoleInfo(role);
  const isMayor = gameState?.game?.mayor && gameState.game.mayor.toString() === player._id.toString();

  return (
    <div className={`role-card ${expanded ? 'expanded' : ''} ${roleData.team} ${!player.alive ? 'dead' : ''}`}>
      <button
        className="role-card-button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="role-header">
          <span className="role-emoji">
            <RoleIcon role={role} size={48} className="role-icon" />
          </span>
          <div className="role-name-status">
            <h2>{role}</h2>
            {isMayor && (
              <p className="mayor-indicator">🏛️ Starosta</p>
            )}
            <p className={`team-label ${roleData.team}`}>
              {roleData.teamLabel}
            </p>
            <p className={`status ${player.alive ? 'alive' : 'dead'}`}>
              {player.alive ? '✅ Živý' : '💀 Mrtvý'}
            </p>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>

        {expanded && (
          <div className="role-details">
            <div className="role-description">
              <p>{roleData.description}</p>
            </div>

            {isMayor && (
              <div className="role-mayor">
                <h4>🏛️ Starosta</h4>
                <p className="mayor-info">Jsi zvolený starosta - moderuješ hru a máš 2 hlasy</p>
              </div>
            )}

            {player.modifier && (
              <div className="role-modifier">
                <h4>⚠️ Modifikátor: {player.modifier}</h4>
                <p className="modifier-warning">Tvoje schopnost je ovlivněna!</p>
              </div>
            )}

            <div className="role-footer">
              <p className="action-label">Noční akce: <strong>{roleData.actionVerb}</strong></p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

export default RoleCard;
