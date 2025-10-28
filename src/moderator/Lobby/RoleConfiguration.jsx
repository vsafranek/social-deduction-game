import React, { useEffect, useState } from 'react';
import './RoleConfiguration.css';

function RoleConfiguration({
  availableRoles,
  roleCount,
  setRoleCountValue,
  randomPoolRoles,
  toggleRoleInPool,
  teamLimits,
  updateTeamLimit,
  initialTimers 
}) {

    const [nightSeconds, setNightSeconds] = useState(initialTimers?.nightSeconds ?? 90);
  const [daySeconds, setDaySeconds] = useState(initialTimers?.daySeconds ?? 150);
  const [savingTimers, setSavingTimers] = useState(false);

 useEffect(() => {
    if (initialTimers?.nightSeconds) setNightSeconds(initialTimers.nightSeconds);
    if (initialTimers?.daySeconds) setDaySeconds(initialTimers.daySeconds);
  }, [initialTimers?.nightSeconds, initialTimers?.daySeconds]);

  const clamp = (v) => Math.max(10, Math.min(1800, Number.isFinite(+v) ? +v : 10));

    const saveTimers = async () => {
        try {
        setSavingTimers(true);
        await gameApi.updateTimers(gameId, {
            nightSeconds: clamp(nightSeconds),
            daySeconds: clamp(daySeconds)
        });
        } finally {
        setSavingTimers(false);
        }
    };

  const roleKeys = Object.keys(availableRoles);
  const teamOf = (r) => availableRoles[r]?.team || 'good';
  const emojiOf = (r) => availableRoles[r]?.emoji || '❓';

  const configuredSum = Object.values(roleCount).reduce((s, n) => s + (n || 0), 0);
  const configuredByTeam = roleKeys.reduce((acc, r) => {
    const t = teamOf(r);
    acc[t] = (acc[t] || 0) + (roleCount[r] || 0);
    return acc;
  }, {});



  return (
    <div className="lobby-column roles-column">
        <div className="team-limits-section">
        <h3>⏱️ Timery</h3>
        <div className="team-limits">
            <div className="team-limit-item">
            <label><span>Night (s):</span></label>
            <input
                className="team-limit-input"
                type="number" min="10" max="1800"
                value={nightSeconds}
                onChange={(e) => setNightSeconds(Math.max(10, Math.min(1800, parseInt(e.target.value || 0))))}
            />
            </div>
            <div className="team-limit-item">
            <label><span>Day (s):</span></label>
            <input
                className="team-limit-input"
                type="number" min="10" max="1800"
                value={daySeconds}
                onChange={(e) => setDaySeconds(Math.max(10, Math.min(1800, parseInt(e.target.value || 0))))}
            />
            </div>
            <button className="btn-save" onClick={saveTimers}>💾 Uložit Timery</button>
        </div>
        </div>



      <div className="column-header">
        <h2>🎭 Konfigurace Rolí</h2>
      </div>

      <div className="roles-section">
        {/* Team Limits */}
        <div className="team-limits-section">
          <h3>⚖️ Limity Týmů</h3>
          <div className="team-limits">
            <div className="team-limit-item">
              <label><span className="team-icon good">🟢</span><span>Dobré role:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Neomezeno"
                value={teamLimits.good ?? ''}
                onChange={(e) => updateTeamLimit('good', e.target.value)}
              />
              <small>({configuredByTeam.good || 0} nakonfig.)</small>
            </div>

            <div className="team-limit-item">
              <label><span className="team-icon evil">🔴</span><span>Zlé role:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Neomezeno"
                value={teamLimits.evil ?? ''}
                onChange={(e) => updateTeamLimit('evil', e.target.value)}
              />
              <small>({configuredByTeam.evil || 0} nakonfig.)</small>
            </div>

            <div className="team-limit-item">
              <label><span className="team-icon neutral">⚪</span><span>Neutrální:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Neomezeno"
                value={teamLimits.neutral ?? ''}
                onChange={(e) => updateTeamLimit('neutral', e.target.value)}
              />
              <small>({configuredByTeam.neutral || 0} nakonfig.)</small>
            </div>
          </div>
        </div>

        {/* Good roles */}
        <h3 className="team-header good">🟢 Dobré Role</h3>
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

        {/* Evil roles */}
        <h3 className="team-header evil">🔴 Zlé Role</h3>
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

        <div className="role-config-summary">
          <p>Celkem nakonfigurováno: <strong>{configuredSum} rolí</strong></p>
          <small>Klikni na roli pro aktivaci/deaktivaci | Občan se doplní automaticky</small>
        </div>
      </div>
    </div>
  );
}

export default RoleConfiguration;
