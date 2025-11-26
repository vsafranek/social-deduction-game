// src/player/components/NightPhase/NightPhase.jsx
import React, { useState, useEffect } from 'react';
import NightActionModal from '../NightActionModal/NightActionModal';
import './NightPhase.css';

const NIGHT_ACTIONS = {
  'Doctor': { verb: 'Chraň', icon: '💉', color: 'green', description: 'Chraň jednoho hráče' },
  'Jailer': { verb: 'Uzamkni', icon: '👮', color: 'blue', description: 'Uzamkni jednoho hráče' },
  'Investigator': { verb: 'Vyšetři', icon: '🔍', color: 'blue', description: 'Vyšetři jednoho živého hráče' },
  'Coroner': { verb: 'Proveď pitvu', icon: '🔬', color: 'blue', description: 'Proveď pitvu na mrtvém hráči - zjistíš přesnou roli' },
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
      'clean_role': { verb: 'Označ', icon: '🧹', color: 'purple', description: 'Označ hráče - živý ukáže Investigator falešný výsledek, mrtvý bude mít skrytou roli' }
    }
  },
  'Accuser': {
    dual: true,
    actions: {
      'kill': { verb: 'Zabiš', icon: '🔪', color: 'red', description: 'Zabiš jednoho hráče' },
      'frame': { verb: 'Obviň', icon: '👉', color: 'purple', description: 'Obviň hráče - bude vypadat jako zločinec při vyšetřování' }
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
  const [selectedMode, setSelectedMode] = useState('kill');
  const [actionDone, setActionDone] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  // Reset stavu při změně hráče nebo fáze
  useEffect(() => {
    console.log('🔄 NightPhase reset for player:', player.name);
    setActionDone(false);
    setSelectedMode('kill');
    setShowActionModal(false);
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
  
  // Pro dual role - pokud není usesRemaining nastaveno, použij maxUses z role definice
  let usesRemaining = 0;
  if (isDualRole) {
    if (player.roleData?.usesRemaining != null) {
      usesRemaining = player.roleData.usesRemaining;
    } else {
      // Pokud není inicializováno, použij maxUses z role definice (defaultně 3)
      // Toto by se mělo inicializovat při start-config, ale pro jistotu použijeme fallback
      usesRemaining = 3; // Default maxUses pro dual roles
    }
  }

  // Pro dual role - get current action info
  const currentActionInfo = isDualRole 
    ? actionInfo.actions[selectedMode]
    : actionInfo;

  // Handler pro otevření modalu
  const handleOpenModal = () => {
    setShowActionModal(true);
  };

  // Handler pro potvrzení akce z modalu
  const handleActionFromModal = (targetId, mode) => {
    console.log('✅ Submitting action from modal:', { 
      targetId, 
      mode, 
      role: player.role 
    });

    // Pro Trapper - cíl je vlastní ID
    const finalTargetId = player.role === 'Trapper' ? player._id : targetId;
    
    onAction(finalTargetId, mode);
    setActionDone(true);
    setShowActionModal(false);
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
          onClick={() => {
            // Trapper targets themselves
            onAction(player._id, 'trap');
            setActionDone(true);
          }}
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
        {isDualRole && selectedMode === 'kill' && (
          <div className="uses-remaining" style={{ opacity: 0.6 }}>
            ⚡ Sekundární akce: {usesRemaining}x
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

      {/* Action Button - opens modal */}
      <button 
        className={`action-button ${currentActionInfo.color}`}
        onClick={handleOpenModal}
      >
        {currentActionInfo.icon} {currentActionInfo.verb}
      </button>

      {/* Night Action Modal */}
      {showActionModal && (
        <NightActionModal
          players={(() => {
            // Coroner can always target dead players
            if (player.role === 'Coroner') {
              return players.filter(p => p._id !== player._id && !p.alive);
            }
            // Cleaner with clean_role action can target both alive and dead players
            if (player.role === 'Cleaner' && selectedMode === 'clean_role') {
              return players.filter(p => p._id !== player._id); // Both alive and dead
            }
            // All other roles/actions target alive players
            return players.filter(p => p._id !== player._id && p.alive);
          })()}
          onAction={handleActionFromModal}
          onClose={() => setShowActionModal(false)}
          actionInfo={actionInfo}
          selectedMode={selectedMode}
          isDualRole={isDualRole}
          usesRemaining={usesRemaining}
        />
      )}
    </div>
  );
}

export default NightPhase;
