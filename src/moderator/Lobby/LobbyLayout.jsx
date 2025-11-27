import React, { useMemo, useState } from 'react';
import PlayersList from './PlayersList';
import RoleConfiguration from './RoleConfiguration';
import ModifierSettings from './ModifierSettings';
import { ROLE_INFO } from '../../data/roleInfo';
import './LobbyLayout.css';

function LobbyLayout({ gameState, onStartGame }) {
  // Anglické názvy rolí (musí odpovídat backend Role.js)
  const availableRoles = useMemo(() => {
    const roles = {};
    Object.keys(ROLE_INFO).forEach(roleName => {
      roles[roleName] = {
        team: ROLE_INFO[roleName].team,
        emoji: ROLE_INFO[roleName].emoji
      };
    });
    return roles;
  }, []);

  // Výchozí počty rolí
  const [roleCount, setRoleCount] = useState({
    'Doctor': 1,
    'Jailer': 1,
    'Investigator': 1,
    'Coroner': 0,
    'Lookout': 1,
    'Trapper': 0,
    'Tracker': 1,
    'Hunter': 0,
    'Citizen': 0, // auto-fill fallback
    'Killer': 2,
    'Cleaner': 0,
    'Accuser': 0,
    'Consigliere': 0,
    'SerialKiller': 0,
    'Infected': 0
  });

  // Limity týmů
  const [teamLimits, setTeamLimits] = useState({
    good: null, // unlimited
    evil: 2,
    neutral: 0
  });

  // Aktivace v random poolu
  const [randomPoolRoles, setRandomPoolRoles] = useState(
    Object.fromEntries(Object.keys(availableRoles).map(r => [r, true]))
  );

  // Manuální přiřazení
  const [assignedRoles, setAssignedRoles] = useState({});

  // Pasivní modifikátory (anglické klíče pro backend)
  const [modifierConfig, setModifierConfig] = useState({
    drunkChance: 20,      // backend bere drunkChance i opilýChance
    shadyChance: 15,
    paranoidChance: 10,
    insomniacChance: 10
  });

  // Handlery
  const handleAssignRole = (playerId, role) => {
    setAssignedRoles(prev => ({ ...prev, [playerId]: role }));
  };

  const handleUnassignRole = (playerId) => {
    setAssignedRoles(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const toggleRoleInPool = (role) => {
    setRandomPoolRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const setRoleCountValue = (role, value) => {
    setRoleCount(prev => ({ ...prev, [role]: Math.max(0, parseInt(value || 0)) }));
  };

  const updateTeamLimit = (team, value) => {
    const num = value === '' ? null : Math.max(0, parseInt(value || 0));
    setTeamLimits(prev => ({ ...prev, [team]: num }));
  };

  const buildFinalRoleDistribution = () => {
    const players = gameState.players;
    const finalRoles = {};
    const manualIds = Object.keys(assignedRoles);

    // 1) Manuální přiřazení
    for (const pid of manualIds) {
      finalRoles[pid] = assignedRoles[pid];
    }

    // 2) Postav role pool dle roleCount + randomPoolRoles
    const pool = [];
    Object.entries(roleCount).forEach(([role, count]) => {
      if (randomPoolRoles[role]) {
        for (let i = 0; i < count; i++) pool.push(role);
      }
    });

    // 3) Spočítej už využité týmy
    const countByTeam = { good: 0, evil: 0, neutral: 0 };
    Object.values(finalRoles).forEach(role => {
      const team = availableRoles[role]?.team || 'good';
      countByTeam[team]++;
    });

    // 4) Rozdej zbytku hráčů role z poolu s respektem limitů
    const unassigned = players.filter(p => !finalRoles[p._id]);
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    for (const p of unassigned) {
      let chosen = null;
      for (let i = 0; i < shuffledPool.length; i++) {
        const candidate = shuffledPool[i];
        const team = availableRoles[candidate]?.team || 'good';
        const limit = teamLimits[team];
        if (limit === null || countByTeam[team] < limit) {
          chosen = candidate;
          shuffledPool.splice(i, 1);
          countByTeam[team]++;
          break;
        }
      }
      finalRoles[p._id] = chosen || 'Citizen'; // fallback
      if (!chosen) countByTeam.good++;
    }

    return { finalRoles, modifierConfig };
  };

  const onClickStartGame = () => {
    const built = buildFinalRoleDistribution();
    onStartGame(built.finalRoles, built.modifierConfig);
  };

  return (
    <div className="lobby-layout">
      <PlayersList
        players={gameState.players}
        availableRoles={availableRoles}
        assignedRoles={assignedRoles}
        onAssignRole={handleAssignRole}
        onUnassignRole={handleUnassignRole}
      />

      <RoleConfiguration
        gameId={gameState.game._id}
        availableRoles={availableRoles}
        roleCount={roleCount}
        setRoleCountValue={setRoleCountValue}
        randomPoolRoles={randomPoolRoles}
        toggleRoleInPool={toggleRoleInPool}
        teamLimits={teamLimits}
        updateTeamLimit={updateTeamLimit}
        initialTimers={gameState.game.timers}
      />

      <ModifierSettings
        playersCount={gameState.players.length}
        modifierConfig={modifierConfig}
        setModifierConfig={setModifierConfig}
        onStartGame={onClickStartGame}
        canStart={gameState.players.length >= 3}
      />
    </div>
  );
}

export default LobbyLayout;
