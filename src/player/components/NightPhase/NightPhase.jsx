// src/player/components/NightPhase/NightPhase.jsx
import React, { useState, useEffect } from 'react';
import PlayersList from '../PlayersList/PlayersList';
import './NightPhase.css';

const NIGHT_ACTIONS = {
  'Doctor': { verb: 'Chraň', icon: '💉', color: 'green', description: 'Chraň jednoho hráče' },
  'Jailer': { verb: 'Uzamkni', icon: '👮', color: 'blue', description: 'Uzamkni jednoho hráče' },
  'Investigator': { verb: 'Vyšetři', icon: '🔍', color: 'blue', description: 'Vyšetři jednoho hráče' },
  'Lookout': { verb: 'Pozoruj', icon: '👁️', color: 'blue', description: 'Pozoruj jednoho hráče' },
  'Trapper': { verb: 'Nastav Past', icon: '🪤', color: 'green', description: 'Nastav past na svém domě' },
  'Tracker': { verb: 'Sleduj', icon: '👣', color: 'blue', description: 'Sleduj jednoho hráče' },
  'Killer': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
  'Cleaner': { verb: 'Vyčisti', icon: '🧹', color: 'red', description: 'Zabij a skryj roli' },
  'Framer': { verb: 'Zarámuj', icon: '🖼️', color: 'red', description: 'Zarámuj jednoho hráče' },
  'Infected': { verb: 'Nakazi', icon: '🦠', color: 'purple', description: 'Nakazi jednoho hráče' }
};

function NightPhase({ player, players, onAction }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [actionDone, setActionDone] = useState(false);

  // ✅ Reset stavu při změně hráče nebo fáze
  useEffect(() => {
    setSelectedTarget(null);
    setActionDone(false);
  }, [player._id]);

  // ✅ Zkontroluj, jestli už hráč má akci nastavenou
  useEffect(() => {
    if (player.nightAction?.targetId && player.nightAction?.action) {
      setActionDone(true);
    } else {
      setActionDone(false);
    }
  }, [player.nightAction]);

  const actionInfo = NIGHT_ACTIONS[player.role];
  
  if (!actionInfo) {
    return (
      <div className="night-phase inactive">
        <div className="night-info">
          <p>🌙 V noci nemáš speciální schopnost. Čekej na den.</p>
        </div>
      </div>
    );
  }

  const handleAction = async () => {
    if (!selectedTarget && player.role !== 'Trapper') return;

    const actionTypeMap = {
      'Doctor': 'protect',
      'Jailer': 'block',
      'Investigator': 'investigate',
      'Lookout': 'watch',
      'Trapper': 'trap',
      'Tracker': 'track',
      'Killer': 'kill',
      'Cleaner': 'clean_kill',
      'Framer': 'frame',
      'Infected': 'infect'
    };

    const actionType = actionTypeMap[player.role];
    await onAction(selectedTarget, actionType);
    setActionDone(true);
  };

  if (actionDone) {
    return (
      <div className="night-phase">
        <div className={`action-confirmed ${actionInfo.color}`}>
          <span>{actionInfo.icon}</span>
          <p>Tvá akce byla provedena</p>
          <small>{actionInfo.verb} - potvrzeno</small>
        </div>
      </div>
    );
  }

  // Pro Trapper - nemusí vybírat cíl
  if (player.role === 'Trapper') {
    return (
      <div className="night-phase">
        <div className="night-header">
          <h3>{actionInfo.icon} {actionInfo.verb}</h3>
          <p>{actionInfo.description}</p>
        </div>

        <div className="trap-info">
          <p>🪤 Nastav past na svůj dům</p>
          <p className="small">Návštěvníci budou odhaleni a jejich akce selže</p>
        </div>

        <button
          className={`action-button ${actionInfo.color}`}
          onClick={handleAction}
        >
          {actionInfo.icon} {actionInfo.verb}
        </button>
      </div>
    );
  }

  const selectablePlayers = players.filter(p => {
    if (!p.alive) return false;
    if (p._id === player._id) return false;
    return true;
  });

  return (
    <div className="night-phase">
      <div className="night-header">
        <h3>{actionInfo.icon} {actionInfo.verb}</h3>
        <p>{actionInfo.description}</p>
      </div>

      <PlayersList
        players={selectablePlayers}
        onSelectPlayer={setSelectedTarget}
        selectedPlayer={selectedTarget}
        selectionMode="single"
        emptyMessage="Nejsou k dispozici žádní hráči"
      />

      <button
        className={`action-button ${actionInfo.color}`}
        onClick={handleAction}
        disabled={!selectedTarget}
      >
        {actionInfo.icon} {actionInfo.verb}
      </button>
    </div>
  );
}

export default NightPhase;
