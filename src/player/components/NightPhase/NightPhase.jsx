// src/player/components/NightPhase/NightPhase.jsx
import React, { useState, useEffect } from 'react';
import NightActionModal from '../NightActionModal/NightActionModal';
import { getRoleInfo } from '../../../data/roleInfo';
import './NightPhase.css';

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

  const roleInfo = getRoleInfo(player.role);
  const actionInfo = roleInfo?.nightAction;
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

  // Get investigation history from roleData (persisted across nights)
  const investigationHistory = React.useMemo(() => {
    return player.roleData?.investigationHistory || {};
  }, [player.roleData?.investigationHistory]);

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
    
    onAction(targetId, mode);
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
            // Guardian can target alive players (to set guard on their house)
            if (player.role === 'Guardian') {
              return players.filter(p => p._id !== player._id && p.alive);
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
          visitedPlayers={player.role === 'Infected' ? (player.roleData?.visitedPlayers || []) : []}
          investigationHistory={investigationHistory}
        />
      )}
    </div>
  );
}

export default NightPhase;
