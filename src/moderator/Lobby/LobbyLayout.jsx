import React, { useMemo, useState } from 'react';
import PlayersList from './PlayersList';
import RoleConfiguration from './RoleConfiguration';
import ModifierSettings from './ModifierSettings';
import { ROLE_INFO } from '../../data/roleInfo';
import './LobbyLayout.css';

function LobbyLayout({ gameState, onStartGame, onRefresh }) {
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

  // Výchozí počty rolí (kolikrát se role objeví v random poolu)
  // Všechny role jsou defaultně aktivní, takže všechny mají count alespoň 1
  const [roleCount, setRoleCount] = useState(() => {
    const initialCounts = {};
    Object.keys(availableRoles).forEach(role => {
      initialCounts[role] = 1; // Všechny aktivní role mají defaultně count 1
    });
    initialCounts['Citizen'] = 0; // Citizen je fallback, ne aktivní role
    return initialCounts;
  });

  // Maximální limity pro každou roli (kolikrát se může objevit celkem)
  const [roleMaxLimits, setRoleMaxLimits] = useState(
    Object.fromEntries(Object.keys(availableRoles).map(r => [r, null])) // null = unlimited
  );

  // Limity týmů (defaultně 0)
  const [teamLimits, setTeamLimits] = useState({
    good: 0,
    evil: 0,
    neutral: 0
  });

  // Aktivace v random poolu
  const [randomPoolRoles, setRandomPoolRoles] = useState(
    Object.fromEntries(Object.keys(availableRoles).map(r => [r, true]))
  );

  // Garantované role (konkrétní role, které se zaručeně objeví)
  const [guaranteedRoles, setGuaranteedRoles] = useState([]);

  // Pasivní modifikátory (anglické klíče pro backend)
  const [modifierConfig, setModifierConfig] = useState({
    drunkChance: 20,      // backend bere drunkChance i opilýChance
    shadyChance: 15,
    paranoidChance: 10,
    insomniacChance: 10
  });

  // Handlery
  const toggleRoleInPool = (role) => {
    setRandomPoolRoles(prev => {
      const newValue = !prev[role];
      // Pokud deaktivujeme roli, nastavíme count na 0
      if (!newValue) {
        setRoleCount(prevCount => ({ ...prevCount, [role]: 0 }));
      } else {
        // Pokud aktivujeme roli a count je 0, nastavíme na 1
        // Použijeme funkční updater, abychom získali aktuální hodnotu
        setRoleCount(prevCount => {
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
    setRoleCount(prev => {
      const newCount = { ...prev, [role]: numValue };
      // Pokud nastavíme count na 0, deaktivujeme roli (pokud není guaranteed)
      if (numValue === 0 && randomPoolRoles[role] && !guaranteedRoles.includes(role)) {
        setRandomPoolRoles(prevPool => ({ ...prevPool, [role]: false }));
      }
      // Pokud nastavíme count > 0, aktivujeme roli
      if (numValue > 0 && !randomPoolRoles[role]) {
        setRandomPoolRoles(prevPool => ({ ...prevPool, [role]: true }));
      }
      return newCount;
    });
  };

  const setRoleMaxLimit = (role, value) => {
    const num = value === '' ? null : Math.max(0, parseInt(value || 0));
    setRoleMaxLimits(prev => ({ ...prev, [role]: num }));
  };

  const addGuaranteedRole = (role) => {
    setGuaranteedRoles(prev => [...prev, role]);
  };

  const removeGuaranteedRole = (role) => {
    setGuaranteedRoles(prev => {
      const index = prev.findIndex(r => r === role);
      if (index !== -1) {
        const newGuaranteed = [...prev];
        newGuaranteed.splice(index, 1);
        return newGuaranteed;
      }
      return prev;
    });
  };

  const updateTeamLimit = (team, value) => {
    const num = Math.max(0, parseInt(value || 0));
    setTeamLimits(prev => ({ ...prev, [team]: num }));
  };

  const buildFinalRoleDistribution = () => {
    const players = gameState.players;
    const finalRoles = {};
    const roleCounts = {};

    // 1) Přidej garantované role
    const guaranteedToAssign = [...guaranteedRoles];
    const playersForGuaranteed = [...players].slice(0, guaranteedToAssign.length);
    
    // Přiřaď garantované role
    for (let i = 0; i < guaranteedToAssign.length && i < playersForGuaranteed.length; i++) {
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
        const availableSlots = maxLimit === null ? count : Math.max(0, maxLimit - currentCount);
        
        for (let i = 0; i < Math.min(count, availableSlots); i++) {
          pool.push(role);
        }
      }
    });

    // 3) Spočítej už využité týmy
    const countByTeam = { good: 0, evil: 0, neutral: 0 };
    Object.values(finalRoles).forEach(role => {
      const team = availableRoles[role]?.team || 'good';
      countByTeam[team]++;
    });

    // 4) Rozdej zbytku hráčů role z poolu s respektem limitů
    const remainingUnassigned = players.filter(p => !finalRoles[p._id]);
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    for (const p of remainingUnassigned) {
      let chosen = null;
      for (let i = 0; i < shuffledPool.length; i++) {
        const candidate = shuffledPool[i];
        const team = availableRoles[candidate]?.team || 'good';
        const teamLimit = teamLimits[team];
        const roleLimit = roleMaxLimits[candidate];
        const currentRoleCount = roleCounts[candidate] || 0;
        
        // Zkontroluj limity
        // teamLimit === null znamená neomezeno, teamLimit === 0 znamená žádné role z tohoto týmu
        const withinTeamLimit = (teamLimit === null) || (teamLimit > 0 && countByTeam[team] < teamLimit);
        const withinRoleLimit = roleLimit === null || currentRoleCount < roleLimit;
        
        if (withinTeamLimit && withinRoleLimit) {
          chosen = candidate;
          shuffledPool.splice(i, 1);
          countByTeam[team]++;
          roleCounts[candidate] = (roleCounts[candidate] || 0) + 1;
          break;
        }
      }
      finalRoles[p._id] = chosen || 'Citizen'; // fallback
      if (!chosen) {
        countByTeam.good++;
        roleCounts['Citizen'] = (roleCounts['Citizen'] || 0) + 1;
      }
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
        gameId={gameState.game._id}
        onRefresh={onRefresh}
      />

      <RoleConfiguration
        gameId={gameState.game._id}
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
        initialTimers={gameState.game.timers}
        playersCount={gameState.players.length}
      />

      <ModifierSettings
        playersCount={gameState.players.length}
        modifierConfig={modifierConfig}
        setModifierConfig={setModifierConfig}
        onStartGame={onClickStartGame}
        canStart={(() => {
          // Celkový počet rolí = součet teamLimits (good + evil + neutral) + garantované role
          // Každý hráč musí dostat roli - buď náhodnou z poolu nebo garantovanou
          const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0) + guaranteedRoles.length;
          const playersCount = gameState.players.length;
          
          return playersCount >= 3 && totalRolesForValidation === playersCount;
        })()}
        totalRolesForValidation={(() => {
          return (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0) + guaranteedRoles.length;
        })()}
      />
    </div>
  );
}

export default LobbyLayout;
