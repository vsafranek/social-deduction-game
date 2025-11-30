import React, { useState } from 'react';
import RoleIcon from '../../components/icons/RoleIcon';
import './RoleConfigModal.css';

function RoleConfigModal({
  availableRoles,
  roleCount,
  setRoleCountValue,
  roleMaxLimits,
  setRoleMaxLimit,
  randomPoolRoles,
  toggleRoleInPool,
  onClose
}) {
  // Fallback pro případ undefined
  const roles = availableRoles || {};
  const roleKeys = Object.keys(roles);
  const teamOf = (r) => roles[r]?.team || 'good';
  const emojiOf = (r) => roles[r]?.emoji || '❓';

  // Vypočítej pool pro jednotlivé týmy - zohledni roleMaxLimits (kolikrát je možné roli picknout)
  const configuredSumByTeam = roleKeys.reduce((acc, role) => {
    if (randomPoolRoles[role]) {
      const team = teamOf(role);
      const maxLimit = roleMaxLimits[role];
      // Pokud má role nastavený max limit, použij ho, jinak použij roleCount
      const poolValue = (maxLimit !== null && maxLimit !== undefined) 
        ? maxLimit 
        : (roleCount[role] || 0);
      acc[team] = (acc[team] || 0) + poolValue;
    }
    return acc;
  }, { good: 0, evil: 0, neutral: 0 });

  return (
    <div className="role-config-modal-overlay" onClick={onClose}>
      <div className="role-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Role Configuration</h2>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Good Roles */}
          <div className="modal-section">
            <h3 className="team-header good">🟢 Good Roles <small>(Pool: {configuredSumByTeam.good || 0})</small></h3>
            <div className="role-config-grid">
              {roleKeys.filter(r => teamOf(r) === 'good').map(role => (
                <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                  <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                    <span className="role-emoji">
                      <RoleIcon role={role} size={40} className="role-icon" />
                    </span>
                    <span className="role-name">{role}</span>
                    <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                  </div>
                  <div className="role-config-controls">
                    <div className="role-config-max-limit">
                      <button
                        className="counter-btn minus"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const current = roleMaxLimits[role];
                          if (current === null) {
                            setRoleMaxLimit(role, 1);
                          } else if (current > 1) {
                            setRoleMaxLimit(role, current - 1);
                          } else if (current === 1 && !randomPoolRoles[role]) {
                            setRoleMaxLimit(role, 0);
                          }
                        }}
                        disabled={roleMaxLimits[role] === null || (roleMaxLimits[role] || 0) === 0 || (randomPoolRoles[role] && (roleMaxLimits[role] || 0) <= 1)}
                      >−</button>
                      <button
                        className="counter-btn plus"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const current = roleMaxLimits[role];
                          if (current === null) {
                            // Pokud je role aktivní, začni na 2 (protože aktivní role má implicitně limit 1)
                            setRoleMaxLimit(role, randomPoolRoles[role] ? 2 : 1);
                          } else {
                            setRoleMaxLimit(role, current + 1);
                          }
                        }}
                      >+</button>
                    </div>
                  </div>
                  {(roleMaxLimits[role] || 0) > 1 && (
                    <span className="role-count-badge">{roleMaxLimits[role]}x</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evil Roles */}
          <div className="modal-section">
            <h3 className="team-header evil">🔴 Evil Roles <small>(Pool: {configuredSumByTeam.evil || 0})</small></h3>
            <div className="role-config-grid">
              {roleKeys.filter(r => teamOf(r) === 'evil').map(role => (
                <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                  <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                    <span className="role-emoji">
                      <RoleIcon role={role} size={40} className="role-icon" />
                    </span>
                    <span className="role-name">{role}</span>
                    <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                  </div>
                  <div className="role-config-controls">
                    <div className="role-config-max-limit">
                      <button
                        className="counter-btn minus"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const current = roleMaxLimits[role];
                          if (current === null) {
                            setRoleMaxLimit(role, 1);
                          } else if (current > 1) {
                            setRoleMaxLimit(role, current - 1);
                          } else if (current === 1 && !randomPoolRoles[role]) {
                            setRoleMaxLimit(role, 0);
                          }
                        }}
                        disabled={roleMaxLimits[role] === null || (roleMaxLimits[role] || 0) === 0 || (randomPoolRoles[role] && (roleMaxLimits[role] || 0) <= 1)}
                      >−</button>
                      <button
                        className="counter-btn plus"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const current = roleMaxLimits[role];
                          if (current === null) {
                            // Pokud je role aktivní, začni na 2 (protože aktivní role má implicitně limit 1)
                            setRoleMaxLimit(role, randomPoolRoles[role] ? 2 : 1);
                          } else {
                            setRoleMaxLimit(role, current + 1);
                          }
                        }}
                      >+</button>
                    </div>
                  </div>
                  {(roleMaxLimits[role] || 0) > 1 && (
                    <span className="role-count-badge">{roleMaxLimits[role]}x</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Neutral Roles */}
          {roleKeys.filter(r => teamOf(r) === 'neutral').length > 0 && (
            <div className="modal-section">
              <h3 className="team-header neutral">⚪ Neutral Roles <small>(Pool: {configuredSumByTeam.neutral || 0})</small></h3>
              <div className="role-config-grid">
                {roleKeys.filter(r => teamOf(r) === 'neutral').map(role => (
                  <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                    <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                      <span className="role-emoji">
                        <RoleIcon role={role} size={40} className="role-icon" />
                      </span>
                      <span className="role-name">{role}</span>
                      <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                    </div>
                    <div className="role-config-controls">
                      <div className="role-config-max-limit">
                        <button
                          className="counter-btn minus"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const current = roleMaxLimits[role];
                            if (current === null) {
                              setRoleMaxLimit(role, 1);
                            } else if (current > 1) {
                              setRoleMaxLimit(role, current - 1);
                            } else if (current === 1 && !randomPoolRoles[role]) {
                              setRoleMaxLimit(role, 0);
                            }
                          }}
                          disabled={roleMaxLimits[role] === null || (roleMaxLimits[role] || 0) === 0 || (randomPoolRoles[role] && (roleMaxLimits[role] || 0) <= 1)}
                        >−</button>
                        <button
                          className="counter-btn plus"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const current = roleMaxLimits[role];
                            if (current === null) {
                              // Pokud je role aktivní, začni na 2 (protože aktivní role má implicitně limit 1)
                              setRoleMaxLimit(role, randomPoolRoles[role] ? 2 : 1);
                            } else {
                              setRoleMaxLimit(role, current + 1);
                            }
                          }}
                        >+</button>
                      </div>
                    </div>
                    {(roleMaxLimits[role] || 0) > 1 && (
                      <span className="role-count-badge">{roleMaxLimits[role]}x</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="role-config-summary">
            <p>
              Pool by team: 
              <strong> 🟢 {configuredSumByTeam.good || 0}</strong> | 
              <strong> 🔴 {configuredSumByTeam.evil || 0}</strong> | 
              <strong> ⚪ {configuredSumByTeam.neutral || 0}</strong>
            </p>
            <small>Click role to enable/disable | Max limit = max total in game</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleConfigModal;
