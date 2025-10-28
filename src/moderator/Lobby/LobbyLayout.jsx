import React, { useMemo, useState } from 'react';
import PlayersList from './PlayersList';
import RoleConfiguration from './RoleConfiguration';
import ModifierSettings from './ModifierSettings';
import './LobbyLayout.css';

function LobbyLayout({ gameState, onStartGame }) {
  // Stav pro manuální přiřazení
  const [assignedRoles, setAssignedRoles] = useState({}); // {playerId: role}
  const [nightSeconds, setNightSeconds] = useState(90);
  const [daySeconds, setDaySeconds] = useState(150);

    const saveTimers = async () => {
    await gameApi.updateTimers(gameState.game._id, { nightSeconds, daySeconds });
    // volitelně zobraz toast
    };


  // Základní seznam rolí s týmem a emoji
  const availableRoles = useMemo(() => ({
    'Doktor': { team: 'good', emoji: '💉' },
    'Policie': { team: 'good', emoji: '👮' },
    'Vyšetřovatel': { team: 'good', emoji: '🔍' },
    'Pozorovatel': { team: 'good', emoji: '👁️' },
    'Pastičkář': { team: 'good', emoji: '🪤' },
    'Stopař': { team: 'good', emoji: '👣' },
    'Občan': { team: 'good', emoji: '👤' },
    'Vrah': { team: 'evil', emoji: '🔪' },
    'Uklízeč': { team: 'evil', emoji: '🧹' },
    'Falšovač': { team: 'evil', emoji: '🖼️' }
  }), []);

  // Počty rolí (kolikrát se daná role objeví)
  const [roleCount, setRoleCount] = useState({
    'Doktor': 1,
    'Policie': 1,
    'Vyšetřovatel': 1,
    'Pozorovatel': 1,
    'Pastičkář': 0,
    'Stopař': 1,
    'Občan': 0,     // Občan se doplňuje automaticky
    'Vrah': 2,
    'Uklízeč': 0,
    'Falšovač': 0
  });

  // Limity týmů
  const [teamLimits, setTeamLimits] = useState({
    good: null,
    evil: 2,
    neutral: 0
  });

  // Aktivace v random poolu
  const [randomPoolRoles, setRandomPoolRoles] = useState(
    Object.fromEntries(Object.keys(availableRoles).map(r => [r, true]))
  );

  // Pasivní modifikátory
  const [modifierConfig, setModifierConfig] = useState({
    opilýChance: 20,
    poustevníkChance: 15
  });

  // Handlery pro podkomponenty
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

      finalRoles[p._id] = chosen || 'Občan';
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
        onStartGame={onClickStartGame}
      />

      <RoleConfiguration
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
      />
    </div>
  );
}

export default LobbyLayout;
