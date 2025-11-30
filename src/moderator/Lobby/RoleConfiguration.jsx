import React, { useState, useEffect, useCallback } from 'react';
import { gameApi } from '../../api/gameApi';
import RoleConfigModal from './RoleConfigModal';
import RoleIcon from '../../components/icons/RoleIcon';
import { canAddRandomRole, canAddGuaranteedRole } from './roleLimitUtils';
import './RoleConfiguration.css';

function RoleConfiguration({
  gameId,
  availableRoles,
  roleCount,
  setRoleCountValue,
  roleMaxLimits,
  setRoleMaxLimit,
  randomPoolRoles,
  toggleRoleInPool,
  guaranteedRoles,
  addGuaranteedRole,
  removeGuaranteedRole,
  teamLimits,
  updateTeamLimit,
  initialTimers,
  playersCount
}) {
  const [showModal, setShowModal] = useState(false);
  const [showGuaranteedModal, setShowGuaranteedModal] = useState({ team: null, show: false });
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

  // Počet různých typů aktivních rolí podle týmu (pro zobrazení "Active types")
  const configuredByTeam = roleKeys.reduce((acc, r) => {
    const t = teamOf(r);
    // Počítáme pouze aktivní role (v randomPoolRoles)
    if (randomPoolRoles[r]) {
      acc[t] = (acc[t] || 0) + 1;
    }
    return acc;
  }, {});

  // Spočítej garantované role podle týmu
  const guaranteedByTeam = guaranteedRoles.reduce((acc, role) => {
    const team = teamOf(role);
    acc[team] = (acc[team] || 0) + 1;
    return acc;
  }, { good: 0, evil: 0, neutral: 0 });

  // Spočítej skutečný počet rozdaných rolí podle týmu (roleCount pro aktivní role + guaranteed)
  const distributedRolesByTeam = roleKeys.reduce((acc, r) => {
    const t = teamOf(r);
    // Počítáme pouze aktivní role (v randomPoolRoles) s count > 0
    if (randomPoolRoles[r] && roleCount[r] > 0) {
      acc[t] = (acc[t] || 0) + (roleCount[r] || 0);
    }
    return acc;
  }, { good: 0, evil: 0, neutral: 0 });

  // Spočítej pool size pro jednotlivé týmy - zohledni roleMaxLimits (kolikrát je možné roli picknout)
  // Stejná logika jako configuredSumByTeam v RoleConfigModal
  const teamPoolSizeByTeam = roleKeys.reduce((acc, r) => {
    if (randomPoolRoles[r]) {
      const team = teamOf(r);
      const maxLimit = roleMaxLimits[r];
      // Pokud má role nastavený max limit, použij ho, jinak použij roleCount
      const poolValue = (maxLimit !== null && maxLimit !== undefined) 
        ? maxLimit 
        : (roleCount[r] || 0);
      acc[team] = (acc[team] || 0) + poolValue;
    }
    return acc;
  }, { good: 0, evil: 0, neutral: 0 });

  // Přidej garantované role
  const actualRolesByTeam = {
    good: (distributedRolesByTeam.good || 0) + (guaranteedByTeam.good || 0),
    evil: (distributedRolesByTeam.evil || 0) + (guaranteedByTeam.evil || 0),
    neutral: (distributedRolesByTeam.neutral || 0) + (guaranteedByTeam.neutral || 0)
  };

  // Celkový počet rolí (pro validaci - musí se rovnat počtu hráčů)
  // Total roles = sum of all team limits (good + evil + neutral) + guaranteed roles
  const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0) + guaranteedRoles.length;
  const rolesMatchPlayers = totalRolesForValidation === (playersCount || 0);

  // Handler pro zavření modalu
  const handleCloseGuaranteedModal = useCallback(() => {
    setShowGuaranteedModal({ team: null, show: false });
  }, []);

  // Handler pro otevření modalu
  const handleOpenGuaranteedModal = useCallback((team) => {
    setShowGuaranteedModal({ team, show: true });
  }, []);

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
          <h3>
            ⚖️ Team Limits
            <span className={`roles-count-info ${rolesMatchPlayers ? 'success' : 'warning'}`}>
              ({totalRolesForValidation} / {playersCount || 0} players)
            </span>
          </h3>
          <div className="team-limits">
            <div className="team-limit-item">
              <label>
                <span className="team-icon good">🟢</span>
                <span>Good roles:</span>
              </label>
              <button
                className="btn-guaranteed-roles"
                onClick={() => handleOpenGuaranteedModal('good')}
                title="Configure team roles"
              >
                ⚙️ Configure
              </button>
              <div className="team-limit-summary">
                <span className="team-total-display">
                  Total: <strong>{(teamLimits.good || 0) + (guaranteedByTeam.good || 0)}</strong>
                </span>
                <small>
                  ({(teamLimits.good || 0)}+{guaranteedByTeam.good || 0})
                </small>
              </div>
            </div>

            <div className="team-limit-item">
              <label>
                <span className="team-icon evil">🔴</span>
                <span>Evil roles:</span>
              </label>
              <button
                className="btn-guaranteed-roles"
                onClick={() => handleOpenGuaranteedModal('evil')}
                title="Configure team roles"
              >
                ⚙️ Configure
              </button>
              <div className="team-limit-summary">
                <span className="team-total-display">
                  Total: <strong>{(teamLimits.evil || 0) + (guaranteedByTeam.evil || 0)}</strong>
                </span>
                <small>
                  ({(teamLimits.evil || 0)}+{guaranteedByTeam.evil || 0})
                </small>
              </div>
            </div>

            <div className="team-limit-item">
              <label>
                <span className="team-icon neutral">⚪</span>
                <span>Neutral:</span>
              </label>
              <button
                className="btn-guaranteed-roles"
                onClick={() => handleOpenGuaranteedModal('neutral')}
                title="Configure team roles"
              >
                ⚙️ Configure
              </button>
              <div className="team-limit-summary">
                <span className="team-total-display">
                  Total: <strong>{(teamLimits.neutral || 0) + (guaranteedByTeam.neutral || 0)}</strong>
                </span>
                <small>
                  ({(teamLimits.neutral || 0)}+{guaranteedByTeam.neutral || 0})
                </small>
              </div>
            </div>
          </div>


          {/* Guaranteed Roles Modal */}
          {showGuaranteedModal.show && showGuaranteedModal.team && (() => {
            const currentTeam = showGuaranteedModal.team;
            const teamGuaranteedCount = guaranteedByTeam[currentTeam] || 0;
            // Random Roles = počet náhodných rolí pro tým
            const teamLimit = teamLimits[currentTeam] || 0;
            const teamTotalCount = teamGuaranteedCount + teamLimit;
            return (
              <div className="guaranteed-modal-overlay" onClick={handleCloseGuaranteedModal}>
                <div className="guaranteed-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="guaranteed-modal-header">
                    <h3>⚙️ Configure {currentTeam.charAt(0).toUpperCase() + currentTeam.slice(1)} Team</h3>
                    <button className="btn-close-modal" onClick={handleCloseGuaranteedModal}>✕</button>
                  </div>
                  <div className="guaranteed-modal-body">
                    {/* Team Limit Control */}
                    <div className="team-limit-control-modal">
                      <label>
                        <span className="team-icon-modal" style={{ 
                          color: currentTeam === 'good' ? '#4caf50' : currentTeam === 'evil' ? '#e74c3c' : '#9e9e9e' 
                        }}>
                          {currentTeam === 'good' ? '🟢' : currentTeam === 'evil' ? '🔴' : '⚪'}
                        </span>
                        <span>Random Roles:</span>
                      </label>
                      <div className="team-limit-controls-modal">
                        <button
                          className="counter-btn minus"
                          onClick={() => {
                            const currentLimit = teamLimits[currentTeam] || 0;
                            if (currentLimit > 0) {
                              updateTeamLimit(currentTeam, currentLimit - 1);
                            }
                          }}
                          disabled={(teamLimits[currentTeam] || 0) === 0}
                        >−</button>
                        <span className="team-limit-value-modal">
                          {teamLimits[currentTeam] || 0}
                        </span>
                        <button
                          className="counter-btn plus"
                          onClick={() => {
                            const currentLimit = teamLimits[currentTeam] || 0;
                            const result = canAddRandomRole({
                              currentTeamRandomCount: currentLimit,
                              teamGuaranteedCount,
                              teamPoolSize: teamPoolSizeByTeam[currentTeam] || 0
                            });
                            if (result.canAdd) {
                              updateTeamLimit(currentTeam, currentLimit + 1);
                            }
                          }}
                          disabled={(() => {
                            const currentLimit = teamLimits[currentTeam] || 0;
                            const result = canAddRandomRole({
                              currentTeamRandomCount: currentLimit,
                              teamGuaranteedCount,
                              teamPoolSize: teamPoolSizeByTeam[currentTeam] || 0
                            });
                            return !result.canAdd;
                          })()}
                        >+</button>
                      </div>
                    </div>

                    {/* Guaranteed Roles Section */}
                    <div className="guaranteed-section-modal">
                      <h4>🎯 Guaranteed Roles</h4>
                      {roleKeys.filter(r => teamOf(r) === currentTeam && randomPoolRoles[r]).map(role => {
                        const guaranteedCount = guaranteedRoles.filter(r => r === role).length;
                        const maxLimit = roleMaxLimits[role];
                        // poolCount = roleMaxLimits[role] (pokud je nastaven), jinak roleCount[role]
                        const poolCount = (maxLimit !== null && maxLimit !== undefined) 
                          ? maxLimit 
                          : (randomPoolRoles[role] ? (roleCount[role] || 0) : 0);
                        const totalCount = guaranteedCount + poolCount;
                        // Kontrola limitu pomocí utility funkce
                        // teamPoolSize = pool size pro tým (stejná logika jako configuredSumByTeam)
                        const teamPoolSize = teamPoolSizeByTeam[currentTeam] || 0;
                        const teamRandomCountForCheck = teamLimits[currentTeam] || 0;
                        const checkResult = canAddGuaranteedRole({
                          guaranteedCount,
                          poolCount,
                          teamGuaranteedCount,
                          teamRandomCount: teamRandomCountForCheck,
                          teamPoolSize
                        });
                        
                        const canAddMore = checkResult.canAdd;
                        // Pro zobrazení limitu: pokud maxLimit není nastaven, použij poolCount
                        const isUnlimited = maxLimit === null || maxLimit === undefined; // null = unlimited
                        const displayLimit = isUnlimited ? poolCount : maxLimit;
                        const maxLimitText = isUnlimited ? '∞' : displayLimit;
                        
                        return (
                          <div key={role} className="guaranteed-role-item-modal">
                            <span className="guaranteed-role-name-modal">
                              <RoleIcon role={role} size={28} className="role-icon-inline" />
                              {role}
                              <small style={{ marginLeft: '8px', opacity: 0.7 }}>(max: {maxLimitText})</small>
                            </span>
                            <div className="guaranteed-role-controls-modal">
                              <button
                                className="counter-btn minus"
                                onClick={() => removeGuaranteedRole(role)}
                                disabled={guaranteedCount === 0}
                              >−</button>
                              <span className="guaranteed-count-modal">{guaranteedCount}</span>
                              <button
                                className="counter-btn plus"
                                onClick={() => {
                                  // Zkontroluj max limit před přidáním (celkový počet = guaranteed + pool)
                                  if (canAddMore) {
                                    addGuaranteedRole(role);
                                  }
                                }}
                                disabled={!canAddMore}
                              >+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary */}
                    <div className="team-summary-modal">
                      <div className="summary-row">
                        <span>Guaranteed:</span>
                        <strong>{teamGuaranteedCount}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Random:</span>
                        <strong>{teamLimits[currentTeam] || 0}</strong>
                      </div>
                      <div className="summary-row total">
                        <span>Total:</span>
                        <strong>{teamLimit + teamGuaranteedCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
          roleMaxLimits={roleMaxLimits}
          setRoleMaxLimit={setRoleMaxLimit}
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
