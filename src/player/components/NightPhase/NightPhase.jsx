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
  'Hunter': { verb: 'Zastřel', icon: '🏹', color: 'red', description: 'Zastřel jednoho hráče' },
  
  // Evil roles - základní akce
  'Killer': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
  
  // Dual actions
  'Cleaner': {
    dual: true,
    actions: {
      'kill': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
      'clean_role': { verb: 'Vyčisti', icon: '🧹', color: 'purple', description: 'Vyčisti roli mrtvého' }
    }
  },
  'Framer': {
    dual: true,
    actions: {
      'kill': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
      'frame': { verb: 'Zarámuj', icon: '🖼️', color: 'purple', description: 'Zarámuj hráče jako zlého' }
    }
  },
  'Consigliere': {
    dual: true,
    actions: {
      'kill': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
      'consig_investigate': { verb: 'Vyšetři', icon: '🕵️', color: 'blue', description: 'Zjisti přesnou roli' }
    }
  },
  
  'Infected': { verb: 'Nakazi', icon: '🦠', color: 'purple', description: 'Nakazi jednoho hráče' }
};

function NightPhase({ player, players, onAction }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedMode, setSelectedMode] = useState('kill');
  const [actionDone, setActionDone] = useState(false);

  // Reset stavu při změně hráče nebo fáze
  useEffect(() => {
    console.log('🔄 NightPhase reset for player:', player.name);
    setSelectedTarget(null);
    setActionDone(false);
    setSelectedMode('kill');
  }, [player._id]);

  // Zkontroluj, jestli už hráč má akci nastavenou
  useEffect(() => {
    if (player.nightAction?.targetId && player.nightAction?.action) {
      console.log('✅ Night action already done:', player.nightAction);
      setActionDone(true);
    } else {
      setActionDone(false);
    }
  }, [player.nightAction]);

  const actionInfo = NIGHT_ACTIONS[player.role];
  const isDualRole = actionInfo?.dual;
  const usesRemaining = player.roleData?.usesRemaining || 0;

  // Pro dual role - get current action info
  const currentActionInfo = isDualRole 
    ? actionInfo.actions[selectedMode]
    : actionInfo;

  // ✅ Handler pro výběr cíle s debugging
  const handleSelectTarget = (targetId) => {
    console.log('🎯 Target selected:', targetId);
    setSelectedTarget(targetId);
  };

  if (!actionInfo) {
    return (
      <div className="night-phase inactive">
        <div className="night-header">
          <h3>🌙 Noc</h3>
          <p>Nemáš noční akci</p>
        </div>
        <div className="night-info">
          <p>🌙 V noci nemáš speciální schopnost. Čekej na den.</p>
        </div>
      </div>
    );
  }

  // Pokud už hráč potvrdil akci
  if (actionDone) {
    return (
      <div className={`action-confirmed ${currentActionInfo.color}`}>
        <span>{currentActionInfo.icon}</span>
        <p>Tvá akce byla provedena</p>
        <small>{currentActionInfo.verb} - potvrzeno</small>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!selectedTarget) {
      console.warn('⚠️ No target selected');
      return;
    }

    console.log('✅ Submitting action:', { 
      selectedTarget, 
      selectedMode, 
      role: player.role 
    });

    // Pro Trapper - cíl je vlastní ID
    const targetId = player.role === 'Trapper' ? player._id : selectedTarget;
    
    onAction(targetId, selectedMode);
    setActionDone(true);
  };

  // Trapper má speciální UI
  if (player.role === 'Trapper') {
    return (
      <div className="night-phase">
        <div className="night-header">
          <h3>🌙 Noc - {actionInfo.icon} {actionInfo.verb}</h3>
          <p>{actionInfo.description}</p>
        </div>
        
        <div className="trap-info">
          <p>🪤 Nastav past na svůj dům</p>
          <p className="small">Návštěvníci budou odhaleni a jejich akce selže</p>
        </div>

        <button 
          className={`action-button ${actionInfo.color}`}
          onClick={handleSubmit}
        >
          {actionInfo.icon} {actionInfo.verb}
        </button>
      </div>
    );
  }

  return (
    <div className="night-phase">
      <div className="night-header">
        <h3>🌙 Noc - {currentActionInfo.icon} {currentActionInfo.verb}</h3>
        <p>{currentActionInfo.description}</p>
        
        {/* Uses counter for dual roles */}
        {isDualRole && selectedMode !== 'kill' && (
          <div className="uses-remaining">
            ⚡ Speciální akce: {usesRemaining}x
          </div>
        )}
      </div>

      {/* Dual Action Selector */}
      {isDualRole && (
        <div className="action-mode-selector">
          {Object.entries(actionInfo.actions).map(([mode, info]) => {
            const isDisabled = mode !== 'kill' && usesRemaining <= 0;
            
            return (
              <button
                key={mode}
                className={`mode-btn ${selectedMode === mode ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (!isDisabled) {
                    console.log('🔀 Mode changed to:', mode);
                    setSelectedMode(mode);
                  }
                }}
                disabled={isDisabled}
              >
                {info.icon} {info.verb}
              </button>
            );
          })}
        </div>
      )}

      {/* Target Selection */}
      <div className="target-selection-wrapper">
        <PlayersList
          players={players.filter(p => p._id !== player._id && p.alive)}
          selectedPlayerId={selectedTarget}
          onSelect={handleSelectTarget}
          showRole={false}
        />
      </div>

      {/* Submit Button */}
      <button 
        className={`action-button ${currentActionInfo.color} ${!selectedTarget ? 'disabled' : ''}`}
        onClick={handleSubmit}
        disabled={!selectedTarget}
      >
        {currentActionInfo.icon} {currentActionInfo.verb} 
        {selectedTarget && ` (${players.find(p => p._id === selectedTarget)?.name})`}
      </button>
    </div>
  );
}

export default NightPhase;
