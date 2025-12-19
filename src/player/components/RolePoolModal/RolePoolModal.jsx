// src/player/components/RolePoolModal/RolePoolModal.jsx
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ROLE_INFO, getTeamLabel } from '../../../data/roleInfo';
import './RolePoolModal.css';

function RolePoolModal({ gameState, onClose }) {
  // Extract active roles from roleConfiguration
  const activeRoles = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RolePoolModal.jsx:10',message:'Extracting active roles',data:{hasRoleConfig:!!gameState?.game?.roleConfiguration,roleConfigType:typeof gameState?.game?.roleConfiguration,roleConfigKeys:gameState?.game?.roleConfiguration ? Object.keys(gameState.game.roleConfiguration) : []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    if (!gameState?.game?.roleConfiguration) {
      return [];
    }

    const roleConfig = gameState.game.roleConfiguration;
    const roles = [];

    // Convert Map to array if needed, or handle as object
    const configObj = roleConfig instanceof Map 
      ? Object.fromEntries(roleConfig) 
      : roleConfig;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34425453-c27a-41d3-9177-04e276b36c3a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RolePoolModal.jsx:22',message:'Processing role config',data:{configObjEntries:Object.entries(configObj).length,configObj},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    // Filter roles with count > 0
    Object.entries(configObj).forEach(([roleName, count]) => {
      if (count > 0 && ROLE_INFO[roleName]) {
        const roleInfo = ROLE_INFO[roleName];
        roles.push({
          name: roleName,
          count: count,
          emoji: roleInfo.emoji,
          description: roleInfo.description,
          team: roleInfo.team,
          teamLabel: roleInfo.teamLabel || getTeamLabel(roleInfo.team)
        });
      }
    });

    // Sort by team (good, evil, neutral) then by name
    roles.sort((a, b) => {
      const teamOrder = { good: 0, evil: 1, neutral: 2 };
      const teamDiff = (teamOrder[a.team] || 3) - (teamOrder[b.team] || 3);
      if (teamDiff !== 0) return teamDiff;
      return a.name.localeCompare(b.name);
    });

    return roles;
  }, [gameState]);

  // Check which teams have at least one guaranteed player (player with a role from that team)
  const teamsWithGuaranteedPlayers = useMemo(() => {
    const teams = new Set();
    const players = gameState?.players || [];
    
    players.forEach(player => {
      if (player.role) {
        const roleInfo = ROLE_INFO[player.role];
        if (roleInfo && roleInfo.team) {
          teams.add(roleInfo.team);
        }
      }
    });
    
    return teams;
  }, [gameState?.players]);

  // Group roles by team, but only include teams that have at least one guaranteed player
  const rolesByTeam = useMemo(() => {
    const grouped = {
      good: [],
      evil: [],
      neutral: []
    };

    activeRoles.forEach(role => {
      // Only add roles from teams that have at least one guaranteed player
      if (grouped[role.team] && teamsWithGuaranteedPlayers.has(role.team)) {
        grouped[role.team].push(role);
      }
    });

    return grouped;
  }, [activeRoles, teamsWithGuaranteedPlayers]);

  const getTeamHeaderClass = (team) => {
    switch (team) {
      case 'good':
        return 'team-header-good';
      case 'evil':
        return 'team-header-evil';
      case 'neutral':
        return 'team-header-neutral';
      default:
        return '';
    }
  };

  const getTeamHeaderEmoji = (team) => {
    switch (team) {
      case 'good':
        return '🟢';
      case 'evil':
        return '🔴';
      case 'neutral':
        return '⚪';
      default:
        return '';
    }
  };

  return createPortal(
    <div className="role-pool-modal-overlay" onClick={onClose}>
      <div className="role-pool-modal" onClick={(e) => e.stopPropagation()}>
        <div className="role-pool-modal-header">
          <h2>Role Pool</h2>
          <button className="role-pool-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="role-pool-modal-content">
          {activeRoles.length === 0 ? (
            <p className="role-pool-empty">No roles configured in the pool.</p>
          ) : (
            <>
              {rolesByTeam.good.length > 0 && (
                <div className="role-pool-team-section">
                  <h3 className={`role-pool-team-header ${getTeamHeaderClass('good')}`}>
                    {getTeamHeaderEmoji('good')} {getTeamLabel('good')}
                  </h3>
                  <div className="role-pool-role-list">
                    {rolesByTeam.good.map((role) => (
                      <div key={role.name} className="role-pool-role-item">
                        <div className="role-pool-role-header">
                          <span className="role-pool-role-emoji">{role.emoji}</span>
                          <span className="role-pool-role-name">{role.name}</span>
                          {role.count > 1 && (
                            <span className="role-pool-role-count">×{role.count}</span>
                          )}
                        </div>
                        <p className="role-pool-role-description">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rolesByTeam.evil.length > 0 && (
                <div className="role-pool-team-section">
                  <h3 className={`role-pool-team-header ${getTeamHeaderClass('evil')}`}>
                    {getTeamHeaderEmoji('evil')} {getTeamLabel('evil')}
                  </h3>
                  <div className="role-pool-role-list">
                    {rolesByTeam.evil.map((role) => (
                      <div key={role.name} className="role-pool-role-item">
                        <div className="role-pool-role-header">
                          <span className="role-pool-role-emoji">{role.emoji}</span>
                          <span className="role-pool-role-name">{role.name}</span>
                          {role.count > 1 && (
                            <span className="role-pool-role-count">×{role.count}</span>
                          )}
                        </div>
                        <p className="role-pool-role-description">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rolesByTeam.neutral.length > 0 && (
                <div className="role-pool-team-section">
                  <h3 className={`role-pool-team-header ${getTeamHeaderClass('neutral')}`}>
                    {getTeamHeaderEmoji('neutral')} {getTeamLabel('neutral')}
                  </h3>
                  <div className="role-pool-role-list">
                    {rolesByTeam.neutral.map((role) => (
                      <div key={role.name} className="role-pool-role-item">
                        <div className="role-pool-role-header">
                          <span className="role-pool-role-emoji">{role.emoji}</span>
                          <span className="role-pool-role-name">{role.name}</span>
                          {role.count > 1 && (
                            <span className="role-pool-role-count">×{role.count}</span>
                          )}
                        </div>
                        <p className="role-pool-role-description">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="role-pool-modal-footer">
          <button className="role-pool-modal-close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default RolePoolModal;

