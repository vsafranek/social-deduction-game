import React, { useEffect, useState } from "react";
import { gameApi } from "../api/gameApi";
import RoleIcon from "./icons/RoleIcon";
import "./ModeratorView.css";

function ModeratorView() {
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConnectionBox, setShowConnectionBox] = useState(false);

  // Manual role assignment
  const [assignedRoles, setAssignedRoles] = useState({}); // {playerId: 'Doktor'}

  // Available roles with team info
  const [availableRoles] = useState({
    // Good roles
    Doktor: { team: "good", emoji: "💉" },
    Policie: { team: "good", emoji: "👮" },
    Vyšetřovatel: { team: "good", emoji: "🔍" },
    Pozorovatel: { team: "good", emoji: "👁️" },
    Pastičkář: { team: "good", emoji: "🪤" },
    Stopař: { team: "good", emoji: "👣" },
    Občan: { team: "good", emoji: "👤" },
    // Evil roles
    Vrah: { team: "evil", emoji: "🔪" },
    Uklízeč: { team: "evil", emoji: "🧹" },
    Falšovač: { team: "evil", emoji: "🖼️" },
    // Neutral roles (placeholder for future)
    // 'Přeživší': { team: 'neutral', emoji: '🛡️' },
  });

  // Role count configuration (kolikrát se každá role objeví)
  const [roleCount, setRoleCount] = useState({
    Doktor: 1,
    Policie: 1,
    Vyšetřovatel: 1,
    Pozorovatel: 1,
    Pastičkář: 0,
    Stopař: 1,
    Občan: 0, // Občan se doplní automaticky
    Vrah: 2,
    Uklízeč: 0,
    Falšovač: 0,
  });

  // Team limits (kolik dobrých/zlých/neutrálních)
  const [teamLimits, setTeamLimits] = useState({
    good: null, // null = unlimited, number = fixed count
    evil: 2,
    neutral: 0,
  });

  // Random pool enabled/disabled
  const [randomPoolRoles, setRandomPoolRoles] = useState({
    Doktor: true,
    Policie: true,
    Vyšetřovatel: true,
    Pozorovatel: true,
    Pastičkář: true,
    Stopař: true,
    Občan: true,
    Vrah: true,
    Uklízeč: true,
    Falšovač: true,
  });

  // Modifier configuration
  const [modifierConfig, setModifierConfig] = useState({
    opilýChance: 20,
    shadyChance: 15,
  });

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (gameId) {
      fetchGameState();
      const interval = setInterval(fetchGameState, 2000);
      return () => clearInterval(interval);
    }
  }, [gameId]);

  const initializeGame = async () => {
    try {
      const healthResponse = await fetch("/api/health");
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      const health = await healthResponse.json();
      const { ip, port } = health;

      const result = await gameApi.createGame(ip, port);
      if (result.error) {
        throw new Error(result.error);
      }

      setGameId(result.gameId);
      setConnectionInfo({
        ip,
        port,
        roomCode: result.roomCode,
        url: `http://${ip}:${port}?room=${result.roomCode}`,
      });
      setLoading(false);
    } catch (error) {
      console.error("❌ Chyba při vytváření hry:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchGameState = async () => {
    if (!gameId) return;

    try {
      const data = await gameApi.getGameState(gameId);
      setGameState(data);
    } catch (error) {
      console.error("❌ Chyba při načítání stavu:", error);
    }
  };

  // Manual assignment
  const assignRoleToPlayer = (playerId, role) => {
    setAssignedRoles((prev) => ({
      ...prev,
      [playerId]: role,
    }));
  };

  const unassignRole = (playerId) => {
    setAssignedRoles((prev) => {
      const newAssigned = { ...prev };
      delete newAssigned[playerId];
      return newAssigned;
    });
  };

  // Role count management
  const updateRoleCount = (role, delta) => {
    setRoleCount((prev) => ({
      ...prev,
      [role]: Math.max(0, (prev[role] || 0) + delta),
    }));
  };

  const setRoleCountValue = (role, value) => {
    setRoleCount((prev) => ({
      ...prev,
      [role]: Math.max(0, parseInt(value) || 0),
    }));
  };

  // Team limit management
  const updateTeamLimit = (team, value) => {
    const numValue = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setTeamLimits((prev) => ({
      ...prev,
      [team]: numValue,
    }));
  };

  // Random pool toggle
  const toggleRoleInPool = (role) => {
    setRandomPoolRoles((prev) => ({
      ...prev,
      [role]: !prev[role],
    }));
  };

  // Calculate statistics
  const getConfiguredRoleCount = () => {
    return Object.values(roleCount).reduce((sum, count) => sum + count, 0);
  };

  const getConfiguredTeamCounts = () => {
    const counts = { good: 0, evil: 0, neutral: 0 };
    Object.entries(roleCount).forEach(([role, count]) => {
      const team = availableRoles[role]?.team;
      if (team) {
        counts[team] += count;
      }
    });
    return counts;
  };

  const getManuallyAssignedCount = () => {
    return Object.keys(assignedRoles).length;
  };

  const getUnassignedPlayerCount = () => {
    if (!gameState) return 0;
    return gameState.players.length - getManuallyAssignedCount();
  };

  // getRoleEmoji je zachován pro kompatibilitu v select option (emoji se tam zobrazí lépe)
  const getRoleEmoji = (role) => {
    return availableRoles[role]?.emoji || "❓";
  };

  const getRoleTeam = (role) => {
    return availableRoles[role]?.team || "good";
  };

  // Build final role distribution
  const buildFinalRoleDistribution = () => {
    if (!gameState) return [];

    const finalRoles = [];
    const unassignedPlayers = gameState.players.filter(
      (p) => !assignedRoles[p._id]
    );

    // 1. Add manually assigned roles
    Object.entries(assignedRoles).forEach(([playerId, role]) => {
      finalRoles.push({ playerId, role, source: "manual" });
    });

    // 2. Build pool from roleCount configuration
    const rolePool = [];
    Object.entries(roleCount).forEach(([role, count]) => {
      if (randomPoolRoles[role]) {
        for (let i = 0; i < count; i++) {
          rolePool.push(role);
        }
      }
    });

    // 3. Respect team limits
    const teamCounts = { good: 0, evil: 0, neutral: 0 };

    // Count manually assigned teams
    Object.values(assignedRoles).forEach((role) => {
      const team = getRoleTeam(role);
      teamCounts[team]++;
    });

    // Shuffle role pool
    const shuffledPool = [...rolePool].sort(() => Math.random() - 0.5);

    // Assign to unassigned players with team limit checks
    for (const player of unassignedPlayers) {
      let assignedRole = null;

      // Try to find a role that doesn't exceed team limits
      for (let i = 0; i < shuffledPool.length; i++) {
        const role = shuffledPool[i];
        const team = getRoleTeam(role);
        const limit = teamLimits[team];

        // Check if we can assign this role (team limit)
        if (limit === null || teamCounts[team] < limit) {
          assignedRole = role;
          shuffledPool.splice(i, 1);
          teamCounts[team]++;
          break;
        }
      }

      // Fallback to Občan if no role found
      if (!assignedRole) {
        assignedRole = "Občan";
        teamCounts.good++;
      }

      finalRoles.push({
        playerId: player._id,
        role: assignedRole,
        source: "random",
      });
    }

    return finalRoles;
  };

  const startGame = async () => {
    try {
      const distribution = buildFinalRoleDistribution();
      const finalRoleConfig = {};

      distribution.forEach(({ playerId, role }) => {
        finalRoleConfig[playerId] = role;
      });

      // Send to backend
      await gameApi.startGameWithConfig(
        gameId,
        finalRoleConfig,
        modifierConfig
      );
      await fetchGameState();
    } catch (error) {
      console.error("Chyba při startu hry:", error);
      alert(error.message || "Nepodařilo se spustit hru");
    }
  };

  const endNight = async () => {
    try {
      await gameApi.endNight(gameId);
      await fetchGameState();
    } catch (error) {
      console.error("Chyba při ukončení noci:", error);
    }
  };

  const endDay = async () => {
    try {
      await fetchGameState();
    } catch (error) {
      console.error("Chyba při ukončení dne:", error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Zkopírováno!");
    });
  };

  if (error) {
    return (
      <div className="loading-screen">
        <h2>❌ Chyba</h2>
        <p>{error}</p>
        <button onClick={initializeGame}>Zkusit znovu</button>
      </div>
    );
  }

  if (loading || !connectionInfo) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <h2>Připravuji hru...</h2>
        <p>Vytvářím novou hru...</p>
      </div>
    );
  }

  const isDevelopment = process.env.NODE_ENV === "development";
  const configuredTeamCounts = getConfiguredTeamCounts();

  return (
    <div className="moderator-view">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <h1>🎮 Moderátor</h1>
          {gameState && (
            <div className="game-status">
              <span className={`phase-badge ${gameState.game.phase}`}>
                {gameState.game.phase === "lobby" && "🏠 LOBBY"}
                {gameState.game.phase === "night" && "🌙 NOC"}
                {gameState.game.phase === "day" && "☀️ DEN"}
                {gameState.game.phase === "end" && "🏁 KONEC"}
              </span>
              {gameState.game.phase !== "lobby" && (
                <span className="round-badge">Kolo {gameState.game.round}</span>
              )}
            </div>
          )}
        </div>

        <div className="top-bar-right">
          <button
            className="btn-connection"
            onClick={() => setShowConnectionBox(!showConnectionBox)}
          >
            📱 Připojení
          </button>
        </div>
      </div>

      {/* Connection Dropdown */}
      {showConnectionBox && (
        <div className="connection-dropdown">
          <div className="connection-content">
            <h3>📱 Připojení hráčů</h3>

            <div
              className="url-display"
              onClick={() => copyToClipboard(connectionInfo.url)}
            >
              {connectionInfo.url}
            </div>
            <small className="copy-hint">👆 Klikni pro zkopírování</small>

            <div className="connection-info">
              <div className="info-row">
                <span className="info-label">Room Kód:</span>
                <span className="info-value">{connectionInfo.roomCode}</span>
              </div>
              <div className="info-row">
                <span className="info-label">IP:</span>
                <span className="info-value">{connectionInfo.ip}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Port:</span>
                <span className="info-value">{connectionInfo.port}</span>
              </div>
            </div>

            {isDevelopment && (
              <div className="dev-tools">
                <h4>🔧 Dev Tools</h4>
                <div className="dev-buttons">
                  <button
                    onClick={() =>
                      window.open(
                        `${connectionInfo.url}&newSession=1`,
                        "_blank"
                      )
                    }
                  >
                    Test 1
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `${connectionInfo.url}&newSession=1`,
                        "_blank"
                      )
                    }
                  >
                    Test 2
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `${connectionInfo.url}&newSession=1`,
                        "_blank"
                      )
                    }
                  >
                    Test 3
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState && (
        <>
          {/* LOBBY LAYOUT */}
          {gameState.game.phase === "lobby" && (
            <div className="lobby-layout">
              {/* LEFT: Players List */}
              <div className="lobby-column players-column">
                <div className="column-header">
                  <h2>👥 Hráči ({gameState.players.length})</h2>
                </div>

                {gameState.players.length === 0 ? (
                  <div className="empty-state">
                    <p>Žádní hráči</p>
                    <small>Čekám na připojení...</small>
                  </div>
                ) : (
                  <div className="players-list">
                    {gameState.players.map((player) => (
                      <div key={player._id} className="player-item">
                        {player.avatar ? (
                          <img
                            src={player.avatar}
                            alt={player.name}
                            className="player-avatar-img"
                            onError={(e) => {
                              e.target.style.display = "none";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="player-avatar-fallback"
                          style={{
                            display: player.avatar ? "none" : "flex",
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255, 255, 255, 0.1)",
                            fontSize: "20px",
                          }}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="player-info">
                          <span className="player-name">{player.name}</span>
                          {assignedRoles[player._id] && (
                            <span
                              className={`assigned-role ${getRoleTeam(
                                assignedRoles[player._id]
                              )}`}
                            >
                              <RoleIcon
                                role={assignedRoles[player._id]}
                                size={28}
                                className="role-icon-inline"
                                useDetails={true}
                              />{" "}
                              {assignedRoles[player._id]}
                            </span>
                          )}
                        </div>

                        {assignedRoles[player._id] ? (
                          <button
                            className="btn-unassign"
                            onClick={() => unassignRole(player._id)}
                          >
                            ✕
                          </button>
                        ) : (
                          <select
                            className="role-select"
                            onChange={(e) =>
                              assignRoleToPlayer(player._id, e.target.value)
                            }
                            value=""
                          >
                            <option value="">Automaticky</option>
                            {Object.keys(availableRoles).map((role) => (
                              <option key={role} value={role}>
                                {getRoleEmoji(role)} {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="column-footer">
                  <div className="stats-summary">
                    <div className="stat-item">
                      <span>Manuálně:</span>
                      <strong>{getManuallyAssignedCount()}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Automaticky:</span>
                      <strong>{getUnassignedPlayerCount()}</strong>
                    </div>
                  </div>
                  <button
                    className="btn-start-game"
                    onClick={startGame}
                    disabled={gameState.players.length < 3}
                  >
                    {gameState.players.length < 3
                      ? `⏳ Minimálně 3 hráči (${gameState.players.length}/3)`
                      : "▶️ Spustit Hru"}
                  </button>
                </div>
              </div>

              {/* CENTER: Role Configuration */}
              <div className="lobby-column roles-column">
                <div className="column-header">
                  <h2>🎭 Konfigurace Rolí</h2>
                </div>

                <div className="roles-section">
                  {/* Team Limits */}
                  <div className="team-limits-section">
                    <h3>⚖️ Limity Týmů</h3>
                    <div className="team-limits">
                      <div className="team-limit-item">
                        <label>
                          <span className="team-icon good">🟢</span>
                          <span>The Order:</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Neomezeno"
                          value={
                            teamLimits.good === null ? "" : teamLimits.good
                          }
                          onChange={(e) =>
                            updateTeamLimit("good", e.target.value)
                          }
                          className="team-limit-input"
                        />
                        <small>
                          ({configuredTeamCounts.good} nakonfigurováno)
                        </small>
                      </div>

                      <div className="team-limit-item">
                        <label>
                          <span className="team-icon evil">🔴</span>
                          <span>The Shadows:</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Neomezeno"
                          value={
                            teamLimits.evil === null ? "" : teamLimits.evil
                          }
                          onChange={(e) =>
                            updateTeamLimit("evil", e.target.value)
                          }
                          className="team-limit-input"
                        />
                        <small>
                          ({configuredTeamCounts.evil} nakonfigurováno)
                        </small>
                      </div>

                      <div className="team-limit-item">
                        <label>
                          <span className="team-icon neutral">⚪</span>
                          <span>Neutrální:</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Neomezeno"
                          value={
                            teamLimits.neutral === null
                              ? ""
                              : teamLimits.neutral
                          }
                          onChange={(e) =>
                            updateTeamLimit("neutral", e.target.value)
                          }
                          className="team-limit-input"
                        />
                        <small>
                          ({configuredTeamCounts.neutral} nakonfigurováno)
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Good Roles */}
                  <h3 className="team-header good">🟢 The Order</h3>
                  <div className="role-config-grid">
                    {Object.keys(availableRoles)
                      .filter((role) => getRoleTeam(role) === "good")
                      .map((role) => (
                        <div
                          key={role}
                          className={`role-config-card ${
                            randomPoolRoles[role] ? "active" : "inactive"
                          }`}
                        >
                          <div
                            className="role-config-header"
                            onClick={() => toggleRoleInPool(role)}
                          >
                            <span className="role-emoji">
                              <RoleIcon
                                role={role}
                                size={40}
                                className="role-icon"
                                useDetails={true}
                              />
                            </span>
                            <span className="role-name">{role}</span>
                            <span className="role-toggle">
                              {randomPoolRoles[role] ? "✓" : "✕"}
                            </span>
                          </div>
                          <div className="role-config-counter">
                            <button
                              onClick={() => updateRoleCount(role, -1)}
                              disabled={roleCount[role] === 0}
                              className="counter-btn minus"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={roleCount[role]}
                              onChange={(e) =>
                                setRoleCountValue(role, e.target.value)
                              }
                              className="count-input"
                            />
                            <button
                              onClick={() => updateRoleCount(role, 1)}
                              className="counter-btn plus"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Evil Roles */}
                  <h3 className="team-header evil">🔴 The Shadows</h3>
                  <div className="role-config-grid">
                    {Object.keys(availableRoles)
                      .filter((role) => getRoleTeam(role) === "evil")
                      .map((role) => (
                        <div
                          key={role}
                          className={`role-config-card ${
                            randomPoolRoles[role] ? "active" : "inactive"
                          }`}
                        >
                          <div
                            className="role-config-header"
                            onClick={() => toggleRoleInPool(role)}
                          >
                            <span className="role-emoji">
                              <RoleIcon
                                role={role}
                                size={40}
                                className="role-icon"
                                useDetails={true}
                              />
                            </span>
                            <span className="role-name">{role}</span>
                            <span className="role-toggle">
                              {randomPoolRoles[role] ? "✓" : "✕"}
                            </span>
                          </div>
                          <div className="role-config-counter">
                            <button
                              onClick={() => updateRoleCount(role, -1)}
                              disabled={roleCount[role] === 0}
                              className="counter-btn minus"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={roleCount[role]}
                              onChange={(e) =>
                                setRoleCountValue(role, e.target.value)
                              }
                              className="count-input"
                            />
                            <button
                              onClick={() => updateRoleCount(role, 1)}
                              className="counter-btn plus"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="role-config-summary">
                  <p>
                    Celkem nakonfigurováno:{" "}
                    <strong>{getConfiguredRoleCount()} rolí</strong>
                  </p>
                  <small>
                    Klikni na roli pro aktivaci/deaktivaci | Občan se doplní
                    automaticky
                  </small>
                </div>
              </div>

              {/* RIGHT: Modifiers */}
              <div className="lobby-column modifiers-column">
                <div className="column-header">
                  <h2>🎲 Pasivní Modifikátory</h2>
                </div>

                <div className="modifiers-info">
                  <p className="warning-text">
                    ⚠️ Hráči nevidí své modifikátory!
                  </p>
                </div>

                <div className="modifier-list">
                  <div className="modifier-card">
                    <div className="modifier-header">
                      <span className="modifier-icon">
                        <RoleIcon
                          role="Drunk"
                          size={48}
                          className="modifier-icon-svg"
                          isModifier={true}
                        />
                      </span>
                      <span className="modifier-name">Opilý</span>
                    </div>
                    <p className="modifier-desc">
                      50% šance že schopnost nefunguje nebo dá falešnou
                      informaci
                    </p>
                    <div className="modifier-control">
                      <label>
                        Šance: <strong>{modifierConfig.opilýChance}%</strong>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={modifierConfig.opilýChance}
                        onChange={(e) =>
                          setModifierConfig((prev) => ({
                            ...prev,
                            opilýChance: parseInt(e.target.value),
                          }))
                        }
                      />
                      <div className="modifier-estimate">
                        ≈{" "}
                        {Math.round(
                          gameState.players.length *
                            (modifierConfig.opilýChance / 100)
                        )}{" "}
                        hráčů
                      </div>
                    </div>
                  </div>

                  <div className="modifier-card">
                    <div className="modifier-header">
                      <span className="modifier-icon">
                        <RoleIcon
                          role="Shady"
                          size={48}
                          className="modifier-icon-svg"
                          isModifier={true}
                        />
                      </span>
                      <span className="modifier-name">Shady</span>
                    </div>
                    <p className="modifier-desc">
                      Vypadá jako zlý při vyšetřování, i když je dobrý
                    </p>
                    <div className="modifier-control">
                      <label>
                        Šance:{" "}
                        <strong>
                          {modifierConfig.shadyChance ||
                            modifierConfig.recluseChance ||
                            modifierConfig.poustevníkChance ||
                            0}
                          %
                        </strong>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={
                          modifierConfig.shadyChance ||
                          modifierConfig.recluseChance ||
                          modifierConfig.poustevníkChance ||
                          0
                        }
                        onChange={(e) =>
                          setModifierConfig((prev) => ({
                            ...prev,
                            shadyChance: parseInt(e.target.value),
                            recluseChance: parseInt(e.target.value), // Pro kompatibilitu
                            poustevníkChance: parseInt(e.target.value), // Pro kompatibilitu
                          }))
                        }
                      />
                      <div className="modifier-estimate">
                        ≈{" "}
                        {Math.round(
                          gameState.players.length *
                            ((modifierConfig.shadyChance ||
                              modifierConfig.recluseChance ||
                              modifierConfig.poustevníkChance ||
                              0) /
                              100)
                        )}{" "}
                        hráčů
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GAME LAYOUT remains the same... */}
        </>
      )}
    </div>
  );
}

export default ModeratorView;
