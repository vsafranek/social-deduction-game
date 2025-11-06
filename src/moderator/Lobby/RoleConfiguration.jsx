import React, { useState, useEffect, useCallback } from 'react';
import { gameApi } from '../../api/gameApi';
import RoleConfigModal from './RoleConfigModal';
import './RoleConfiguration.css';

function RoleConfiguration({
  gameId,
  availableRoles,
  roleCount,
  setRoleCountValue,
  randomPoolRoles,
  toggleRoleInPool,
  teamLimits,
  updateTeamLimit,
  initialTimers
}) {
  const [showModal, setShowModal] = useState(false);
  const [nightSeconds, setNightSeconds] = useState(initialTimers?.nightSeconds ?? 90);
  const [daySeconds, setDaySeconds] = useState(initialTimers?.daySeconds ?? 150);

  useEffect(() => {
    if (initialTimers?.nightSeconds) setNightSeconds(initialTimers.nightSeconds);
    if (initialTimers?.daySeconds) setDaySeconds(initialTimers.daySeconds);
  }, [initialTimers]);

  const clamp = (v) => Math.max(10, Math.min(1800, Number.isFinite(+v) ? +v : 10));

  // Debounced auto-save
  const debouncedSaveTimers = useCallback(
    debounce(async (night, day) => {
      try {
        await gameApi.updateTimers(gameId, {
          nightSeconds: clamp(night),
          daySeconds: clamp(day)
        });
      } catch (e) {
        console.error('Auto-save timers error:', e);
      }
    }, 800),
    [gameId]
  );

  useEffect(() => {
    debouncedSaveTimers(nightSeconds, daySeconds);
  }, [nightSeconds, daySeconds, debouncedSaveTimers]);

  // Fallback pro availableRoles, pokud není definován
  const roles = availableRoles || {};
  const roleKeys = Object.keys(roles);
  const teamOf = (r) => roles[r]?.team || 'good';

  const configuredByTeam = roleKeys.reduce((acc, r) => {
    const t = teamOf(r);
    acc[t] = (acc[t] || 0) + (roleCount[r] || 0);
    return acc;
  }, {});

  return (
    <div className="lobby-column roles-column">
      <div className="column-header">
        <h2>🎭 Game Configuration</h2>
      </div>

      <div className="roles-section">
        {/* ⏱️ Phase Timers */}
        <div className="team-limits-section">
          <h3>⏱️ Phase Timers</h3>
          <div className="timer-sliders">
            <div className="timer-slider-item">
              <label>
                <span>🌙 Night:</span>
                <strong>{nightSeconds}s</strong>
              </label>
              <input
                type="range"
                min="10"
                max="300"
                value={nightSeconds}
                onChange={(e) => setNightSeconds(parseInt(e.target.value))}
              />
            </div>
            <div className="timer-slider-item">
              <label>
                <span>☀️ Day:</span>
                <strong>{daySeconds}s</strong>
              </label>
              <input
                type="range"
                min="30"
                max="600"
                value={daySeconds}
                onChange={(e) => setDaySeconds(parseInt(e.target.value))}
              />
            </div>
          </div>
          <small className="auto-save-hint">✓ Auto-saved</small>
        </div>

        {/* ⚖️ Team Limits */}
        <div className="team-limits-section">
          <h3>⚖️ Team Limits</h3>
          <div className="team-limits">
            <div className="team-limit-item">
              <label><span className="team-icon good">🟢</span><span>Good roles:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Unlimited"
                value={teamLimits.good === null ? '' : teamLimits.good}
                onChange={(e) => updateTeamLimit('good', e.target.value)}
              />
              <small>({configuredByTeam.good || 0} configured)</small>
            </div>

            <div className="team-limit-item">
              <label><span className="team-icon evil">🔴</span><span>Evil roles:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Unlimited"
                value={teamLimits.evil === null ? '' : teamLimits.evil}
                onChange={(e) => updateTeamLimit('evil', e.target.value)}
              />
              <small>({configuredByTeam.evil || 0} configured)</small>
            </div>

            <div className="team-limit-item">
              <label><span className="team-icon neutral">⚪</span><span>Neutral:</span></label>
              <input
                className="team-limit-input"
                type="number" min="0" placeholder="Unlimited"
                value={teamLimits.neutral === null ? '' : teamLimits.neutral}
                onChange={(e) => updateTeamLimit('neutral', e.target.value)}
              />
              <small>({configuredByTeam.neutral || 0} configured)</small>
            </div>
          </div>
        </div>

        {/* Tlačítko pro otevření role config */}
        <button className="btn-open-role-config" onClick={() => setShowModal(true)}>
          ⚙️ Configure Roles
        </button>
      </div>

      {/* Modal jen s role gridem */}
      {showModal && (
        <RoleConfigModal
          availableRoles={roles} 
          roleCount={roleCount}
          setRoleCountValue={setRoleCountValue}
          randomPoolRoles={randomPoolRoles}
          toggleRoleInPool={toggleRoleInPool}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default RoleConfiguration;
