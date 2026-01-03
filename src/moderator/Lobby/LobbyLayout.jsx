import React, { useEffect, useMemo, useState, useRef } from "react";
import PlayersList from "./PlayersList";
import RoleConfiguration from "./RoleConfiguration";
import ModifierSettings from "./ModifierSettings";
import { ROLE_INFO } from "../../data/roleInfo";
import "./LobbyLayout.css";

const DEFAULT_NIGHT_SECONDS = 30;
const DEFAULT_DAY_SECONDS = 30;

function LobbyLayout({ gameState, onStartGame, onRefresh }) {
  const safeTimers = gameState?.game?.timers || {};
  const [timers, setTimers] = useState({
    nightSeconds: safeTimers.nightSeconds ?? DEFAULT_NIGHT_SECONDS,
    daySeconds: safeTimers.daySeconds ?? DEFAULT_DAY_SECONDS,
  });
  const [timersDirty, setTimersDirty] = useState(false);

  const nightFromState = safeTimers.nightSeconds ?? DEFAULT_NIGHT_SECONDS;
  const dayFromState = safeTimers.daySeconds ?? DEFAULT_DAY_SECONDS;

  // Anglické názvy rolí (musí odpovídat backend Role.js)
  // Define availableRoles before useEffect that uses it
  const availableRoles = useMemo(() => {
    const roles = {};
    Object.keys(ROLE_INFO).forEach((roleName) => {
      roles[roleName] = {
        team: ROLE_INFO[roleName].team,
        emoji: ROLE_INFO[roleName].emoji,
      };
    });
    return roles;
  }, []);

  useEffect(() => {
    if (!timersDirty) {
      setTimers({
        nightSeconds: nightFromState,
        daySeconds: dayFromState,
      });
    }
  }, [nightFromState, dayFromState, timersDirty]);

  // Track previous phase to detect transitions to lobby
  const previousPhaseRef = useRef(null);
  const settingsLoadedRef = useRef(false);

  // Load preserved settings from gameState when returning to lobby
  // Only load once when transitioning to lobby, not on every gameState update
  useEffect(() => {
    const currentPhase = gameState?.game?.phase;
    const previousPhase = previousPhaseRef.current;

    // Only load settings when transitioning from non-lobby to lobby phase
    // or on initial mount if already in lobby
    const isTransitioningToLobby =
      currentPhase === "lobby" &&
      (previousPhase !== "lobby" || previousPhase === null);

    if (isTransitioningToLobby && !settingsLoadedRef.current) {
      // Load roleConfiguration
      const savedRoleConfig = gameState.game.roleConfiguration;
      if (savedRoleConfig && typeof savedRoleConfig === "object") {
        const newRoleCount = {};
        const newRandomPoolRoles = {};

        // Initialize all roles with defaults first, then override with saved values
        Object.keys(availableRoles).forEach((role) => {
          // Default: all roles have count 1, except Citizen which is 0
          const defaultCount = role === "Citizen" ? 0 : 1;
          // Override with saved value if present
          newRoleCount[role] =
            savedRoleConfig[role] !== undefined
              ? savedRoleConfig[role] || 0
              : defaultCount;
          // randomPoolRoles is true if count > 0
          newRandomPoolRoles[role] = newRoleCount[role] > 0;
        });

        setRoleCount(newRoleCount);
        setRandomPoolRoles(newRandomPoolRoles);
      }

      // Load roleMaxLimits
      const savedRoleMaxLimits = gameState.game.roleMaxLimits;
      if (savedRoleMaxLimits && typeof savedRoleMaxLimits === "object") {
        const newRoleMaxLimits = {};
        Object.keys(availableRoles).forEach((role) => {
          if (savedRoleMaxLimits[role] !== undefined) {
            newRoleMaxLimits[role] = savedRoleMaxLimits[role];
          } else {
            newRoleMaxLimits[role] = null; // null = unlimited
          }
        });
        setRoleMaxLimits(newRoleMaxLimits);
      }

      // Load guaranteedRoles
      const savedGuaranteedRoles = gameState.game.guaranteedRoles;
      if (Array.isArray(savedGuaranteedRoles)) {
        setGuaranteedRoles(savedGuaranteedRoles);
      }

      // Load teamLimits
      const savedTeamLimits = gameState.game.teamLimits;
      if (savedTeamLimits && typeof savedTeamLimits === "object") {
        setTeamLimits({
          good: savedTeamLimits.good ?? 2,
          evil: savedTeamLimits.evil ?? 1,
          neutral: savedTeamLimits.neutral ?? 0,
        });
      }

      // Load modifierConfiguration
      const savedModifierConfig = gameState.game.modifierConfiguration;
      if (savedModifierConfig && typeof savedModifierConfig === "object") {
        // Convert percentage chances (0-1) to integer percentages (0-100) if needed
        // Use explicit null/undefined check to preserve 0 values
        const normalizeChance = (value, defaultValue) => {
          if (value == null) return defaultValue; // null or undefined
          return value <= 1 ? value * 100 : value;
        };

        const normalizedConfig = {
          drunkChance: normalizeChance(savedModifierConfig.drunkChance, 20),
          shadyChance: normalizeChance(savedModifierConfig.shadyChance, 15),
          innocentChance: normalizeChance(
            savedModifierConfig.innocentChance,
            15
          ),
          paranoidChance: normalizeChance(
            savedModifierConfig.paranoidChance,
            10
          ),
          insomniacChance: normalizeChance(
            savedModifierConfig.insomniacChance,
            10
          ),
          sweetheartChance: normalizeChance(
            savedModifierConfig.sweetheartChance,
            10
          ),
          amnesiacChance: normalizeChance(
            savedModifierConfig.amnesiacChance,
            0
          ),
        };
        setModifierConfig(normalizedConfig);
      }

      settingsLoadedRef.current = true;
    }

    // Reset settingsLoadedRef when leaving lobby
    if (currentPhase !== "lobby" && previousPhase === "lobby") {
      settingsLoadedRef.current = false;
    }

    // Update previous phase
    previousPhaseRef.current = currentPhase;
  }, [gameState?.game?.phase, availableRoles]);

  // Výchozí počty rolí (kolikrát se role objeví v random poolu)
  // Všechny role jsou defaultně aktivní, takže všechny mají count alespoň 1
  const [roleCount, setRoleCount] = useState(() => {
    const initialCounts = {};
    Object.keys(availableRoles).forEach((role) => {
      initialCounts[role] = 1; // Všechny aktivní role mají defaultně count 1
    });
    initialCounts["Citizen"] = 0; // Citizen je fallback, ne aktivní role
    return initialCounts;
  });

  // Maximální limity pro každou roli (kolikrát se může objevit celkem)
  const [roleMaxLimits, setRoleMaxLimits] = useState(
    Object.fromEntries(Object.keys(availableRoles).map((r) => [r, null])) // null = unlimited
  );

  // Limity týmů (0 = žádné random role z tohoto týmu, číslo > 0 = pevný limit)
  const [teamLimits, setTeamLimits] = useState({
    good: 2,
    evil: 1,
    neutral: 0,
  });

  // Aktivace v random poolu
  const [randomPoolRoles, setRandomPoolRoles] = useState(
    Object.fromEntries(Object.keys(availableRoles).map((r) => [r, true]))
  );

  // Garantované role (konkrétní role, které se zaručeně objeví)
  const [guaranteedRoles, setGuaranteedRoles] = useState([]);

  // Pasivní modifikátory (anglické klíče pro backend)
  const [modifierConfig, setModifierConfig] = useState({
    drunkChance: 20, // backend bere drunkChance i opilýChance
    shadyChance: 15,
    innocentChance: 15,
    paranoidChance: 10,
    insomniacChance: 10,
    sweetheartChance: 10,
    amnesiacChance: 0,
  });

  // Handlery
  const toggleRoleInPool = (role) => {
    setRandomPoolRoles((prev) => {
      const newValue = !prev[role];
      // Pokud deaktivujeme roli, nastavíme count na 0
      if (!newValue) {
        setRoleCount((prevCount) => ({ ...prevCount, [role]: 0 }));
      } else {
        // Pokud aktivujeme roli a count je 0, nastavíme na 1
        // Použijeme funkční updater, abychom získali aktuální hodnotu
        setRoleCount((prevCount) => {
          if (prevCount[role] === 0) {
            return { ...prevCount, [role]: 1 };
          }
          return prevCount;
        });
      }
      return { ...prev, [role]: newValue };
    });
  };

  const setRoleCountValue = (role, value) => {
    const numValue = Math.max(0, parseInt(value || 0));
    setRoleCount((prev) => {
      const newCount = { ...prev, [role]: numValue };
      // Pokud nastavíme count na 0, deaktivujeme roli (pokud není guaranteed)
      if (
        numValue === 0 &&
        randomPoolRoles[role] &&
        !guaranteedRoles.includes(role)
      ) {
        setRandomPoolRoles((prevPool) => ({ ...prevPool, [role]: false }));
      }
      // Pokud nastavíme count > 0, aktivujeme roli
      if (numValue > 0 && !randomPoolRoles[role]) {
        setRandomPoolRoles((prevPool) => ({ ...prevPool, [role]: true }));
      }
      return newCount;
    });
  };

  const setRoleMaxLimit = (role, value) => {
    const num = value === "" ? null : Math.max(0, parseInt(value || 0));
    setRoleMaxLimits((prev) => ({ ...prev, [role]: num }));
  };

  const addGuaranteedRole = (role) => {
    setGuaranteedRoles((prev) => [...prev, role]);
  };

  const removeGuaranteedRole = (role) => {
    setGuaranteedRoles((prev) => {
      const index = prev.findIndex((r) => r === role);
      if (index !== -1) {
        const newGuaranteed = [...prev];
        newGuaranteed.splice(index, 1);
        return newGuaranteed;
      }
      return prev;
    });
  };

  const updateTeamLimit = (team, value) => {
    // Parsuj jako číslo (minimum 0)
    const num = Math.max(0, parseInt(value || 0));
    setTeamLimits((prev) => ({ ...prev, [team]: num }));
  };

  const buildFinalRoleDistribution = () => {
    const players = gameState.players;
    const finalRoles = {};
    const roleCounts = {};

    // 1) Přidej garantované role
    const guaranteedToAssign = [...guaranteedRoles];
    const playersForGuaranteed = [...players].slice(
      0,
      guaranteedToAssign.length
    );

    // Přiřaď garantované role
    for (
      let i = 0;
      i < guaranteedToAssign.length && i < playersForGuaranteed.length;
      i++
    ) {
      const role = guaranteedToAssign[i];
      const player = playersForGuaranteed[i];
      finalRoles[player._id] = role;
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }

    // 2) Postav role pool dle roleCount + randomPoolRoles (respektuj maxLimits)
    const pool = [];
    Object.entries(roleCount).forEach(([role, count]) => {
      if (randomPoolRoles[role]) {
        const currentCount = roleCounts[role] || 0;
        const maxLimit = roleMaxLimits[role];
        const availableSlots =
          maxLimit === null ? count : Math.max(0, maxLimit - currentCount);

        for (let i = 0; i < Math.min(count, availableSlots); i++) {
          pool.push(role);
        }
      }
    });

    // 3) Spočítej už využité týmy
    const countByTeam = { good: 0, evil: 0, neutral: 0 };
    Object.values(finalRoles).forEach((role) => {
      const team = availableRoles[role]?.team || "good";
      countByTeam[team]++;
    });

    // 4) Rozdej zbytku hráčů role z poolu s respektem limitů
    const remainingUnassigned = players.filter((p) => !finalRoles[p._id]);
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    for (const p of remainingUnassigned) {
      let chosen = null;
      for (let i = 0; i < shuffledPool.length; i++) {
        const candidate = shuffledPool[i];
        const team = availableRoles[candidate]?.team || "good";
        const teamLimit = teamLimits[team];
        const roleLimit = roleMaxLimits[candidate];
        const currentRoleCount = roleCounts[candidate] || 0;

        // Zkontroluj limity
        // teamLimit === 0 znamená žádné role z tohoto týmu, teamLimit > 0 znamená pevný limit
        const withinTeamLimit = teamLimit > 0 && countByTeam[team] < teamLimit;
        const withinRoleLimit =
          roleLimit === null || currentRoleCount < roleLimit;

        if (withinTeamLimit && withinRoleLimit) {
          chosen = candidate;
          shuffledPool.splice(i, 1);
          countByTeam[team]++;
          roleCounts[candidate] = (roleCounts[candidate] || 0) + 1;
          break;
        }
      }
      finalRoles[p._id] = chosen || "Citizen"; // fallback
      if (!chosen) {
        countByTeam.good++;
        roleCounts["Citizen"] = (roleCounts["Citizen"] || 0) + 1;
      }
    }

    // Build roleConfiguration map (roleName -> count) for display in role pool modal
    // Show ALL configured roles in the pool, regardless of team limits
    // Team limits only affect actual assignment, not what's visible in the pool
    const roleConfiguration = {};
    Object.entries(roleCount).forEach(([role, count]) => {
      if (randomPoolRoles[role] && count > 0) {
        // Include all roles that are in the pool, regardless of team limits
        roleConfiguration[role] = count;
      }
    });
    // Add guaranteed roles (they're always in the pool)
    guaranteedRoles.forEach((role) => {
      roleConfiguration[role] = (roleConfiguration[role] || 0) + 1;
    });

    return { finalRoles, modifierConfig, roleConfiguration };
  };

  const onClickStartGame = async () => {
    const built = buildFinalRoleDistribution();
    const success = await onStartGame(
      built.finalRoles,
      built.modifierConfig,
      timers,
      built.roleConfiguration,
      roleMaxLimits,
      guaranteedRoles,
      teamLimits
    );
    if (success) {
      setTimersDirty(false);
    }
  };

  const handleTimersChange = (nextTimers) => {
    setTimers(nextTimers);
    setTimersDirty(true);
  };

  // Výpočet celkového počtu rolí pro validaci
  // Total = součet teamLimits (good + evil + neutral) + garantované role
  const totalRolesForValidation = useMemo(() => {
    return (
      (teamLimits.good || 0) +
      (teamLimits.evil || 0) +
      (teamLimits.neutral || 0) +
      guaranteedRoles.length
    );
  }, [teamLimits, guaranteedRoles.length]);

  return (
    <div className="lobby-layout">
      <PlayersList
        players={gameState.players}
        gameId={gameState.game._id}
        onRefresh={onRefresh}
      />

      <RoleConfiguration
        timers={timers}
        onTimersChange={handleTimersChange}
        timersDirty={timersDirty}
        availableRoles={availableRoles}
        roleCount={roleCount}
        setRoleCountValue={setRoleCountValue}
        roleMaxLimits={roleMaxLimits}
        setRoleMaxLimit={setRoleMaxLimit}
        randomPoolRoles={randomPoolRoles}
        toggleRoleInPool={toggleRoleInPool}
        guaranteedRoles={guaranteedRoles}
        addGuaranteedRole={addGuaranteedRole}
        removeGuaranteedRole={removeGuaranteedRole}
        teamLimits={teamLimits}
        updateTeamLimit={updateTeamLimit}
        playersCount={gameState.players.length}
      />

      <ModifierSettings
        playersCount={gameState.players.length}
        modifierConfig={modifierConfig}
        setModifierConfig={setModifierConfig}
        onStartGame={onClickStartGame}
        canStart={(() => {
          const playersCount = gameState.players.length;
          return playersCount >= 3 && totalRolesForValidation === playersCount;
        })()}
        totalRolesForValidation={totalRolesForValidation}
      />
    </div>
  );
}

export default LobbyLayout;
