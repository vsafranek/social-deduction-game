import React from 'react';
import './RoleConfigModal.css';

function RoleConfigModal({
  availableRoles,
  roleCount,
  setRoleCountValue,
  randomPoolRoles,
  toggleRoleInPool,
  onClose
}) {
  // Fallback pro případ undefined
  const roles = availableRoles || {};
  const roleKeys = Object.keys(roles);
  const teamOf = (r) => roles[r]?.team || 'good';
  const emojiOf = (r) => roles[r]?.emoji || '❓';

  const configuredSum = Object.values(roleCount || {}).reduce((s, n) => s + (n || 0), 0);

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
            <h3 className="team-header good">🟢 Good Roles</h3>
            <div className="role-config-grid">
              {roleKeys.filter(r => teamOf(r) === 'good').map(role => (
                <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                  <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                    <span className="role-emoji">{emojiOf(role)}</span>
                    <span className="role-name">{role}</span>
                    <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                  </div>
                  <div className="role-config-counter">
                    <button
                      className="counter-btn minus"
                      onClick={() => setRoleCountValue(role, Math.max(0, (roleCount[role] || 0) - 1))}
                      disabled={(roleCount[role] || 0) === 0}
                    >−</button>
                    <input
                      className="count-input"
                      type="number" min="0"
                      value={roleCount[role] || 0}
                      onChange={(e) => setRoleCountValue(role, e.target.value)}
                    />
                    <button
                      className="counter-btn plus"
                      onClick={() => setRoleCountValue(role, (roleCount[role] || 0) + 1)}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evil Roles */}
          <div className="modal-section">
            <h3 className="team-header evil">🔴 Evil Roles</h3>
            <div className="role-config-grid">
              {roleKeys.filter(r => teamOf(r) === 'evil').map(role => (
                <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                  <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                    <span className="role-emoji">{emojiOf(role)}</span>
                    <span className="role-name">{role}</span>
                    <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                  </div>
                  <div className="role-config-counter">
                    <button
                      className="counter-btn minus"
                      onClick={() => setRoleCountValue(role, Math.max(0, (roleCount[role] || 0) - 1))}
                      disabled={(roleCount[role] || 0) === 0}
                    >−</button>
                    <input
                      className="count-input"
                      type="number" min="0"
                      value={roleCount[role] || 0}
                      onChange={(e) => setRoleCountValue(role, e.target.value)}
                    />
                    <button
                      className="counter-btn plus"
                      onClick={() => setRoleCountValue(role, (roleCount[role] || 0) + 1)}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neutral Roles */}
          {roleKeys.filter(r => teamOf(r) === 'neutral').length > 0 && (
            <div className="modal-section">
              <h3 className="team-header neutral">⚪ Neutral Roles</h3>
              <div className="role-config-grid">
                {roleKeys.filter(r => teamOf(r) === 'neutral').map(role => (
                  <div key={role} className={`role-config-card ${randomPoolRoles[role] ? 'active' : 'inactive'}`}>
                    <div className="role-config-header" onClick={() => toggleRoleInPool(role)}>
                      <span className="role-emoji">{emojiOf(role)}</span>
                      <span className="role-name">{role}</span>
                      <span className="role-toggle">{randomPoolRoles[role] ? '✓' : '✕'}</span>
                    </div>
                    <div className="role-config-counter">
                      <button
                        className="counter-btn minus"
                        onClick={() => setRoleCountValue(role, Math.max(0, (roleCount[role] || 0) - 1))}
                        disabled={(roleCount[role] || 0) === 0}
                      >−</button>
                      <input
                        className="count-input"
                        type="number" min="0"
                        value={roleCount[role] || 0}
                        onChange={(e) => setRoleCountValue(role, e.target.value)}
                      />
                      <button
                        className="counter-btn plus"
                        onClick={() => setRoleCountValue(role, (roleCount[role] || 0) + 1)}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="role-config-summary">
            <p>Total configured: <strong>{configuredSum} roles</strong></p>
            <small>Click role to enable/disable | Citizen auto-fills</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleConfigModal;
