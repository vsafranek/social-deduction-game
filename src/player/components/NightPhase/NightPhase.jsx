// src/player/components/NightPhase/NightPhase.jsx
import React, { useState, useEffect } from 'react';
import NightActionModal from '../NightActionModal/NightActionModal';
import { getRoleInfo } from '../../../data/roleInfo';
import './NightPhase.css';

function NightPhase({ player, players, onAction }) {
  // Determine default mode based on role
  const getDefaultMode = (role) => {
    const roleInfo = getRoleInfo(role);
    const actionInfo = roleInfo?.nightAction;
    if (actionInfo?.dual && actionInfo?.actions) {
      // For Poisoner, default to 'poison' (unlimited use)
      if (role === 'Poisoner') {
        return 'poison';
      }
      // For other dual roles, default to 'kill' if available, otherwise first action
      if (actionInfo.actions['kill']) {
        return 'kill';
      }
      return Object.keys(actionInfo.actions)[0];
    }
    return 'kill';
  };

  const [selectedMode, setSelectedMode] = useState(() => getDefaultMode(player.role));
  const [actionDone, setActionDone] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  // Reset stavu při změně hráče nebo fáze
  useEffect(() => {
    console.log('🔄 NightPhase reset for player:', player.name);
    setActionDone(false);
    setSelectedMode(getDefaultMode(player.role));
    setShowActionModal(false);
  }, [player._id, player.role]);

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
  const isPoisoner = player.role === 'Poisoner';
  
  // Pro dual role - pokud není usesRemaining nastaveno, použij maxUses z role definice
  let usesRemaining = 0;
  if (isDualRole) {
    if (player.roleData?.usesRemaining != null) {
      usesRemaining = player.roleData.usesRemaining;
    } else {
      // Pokud není inicializováno, použij maxUses z role definice
      // Pro Poisoner: maxUses = 1 (only for strong_poison)
      // Pro ostatní dual role: defaultně 3
      usesRemaining = isPoisoner ? 1 : 3;
    }
  }

  // Get investigation history from roleData (persisted across nights)
  const investigationHistory = React.useMemo(() => {
    return player.roleData?.investigationHistory || {};
  }, [player.roleData?.investigationHistory]);

  // Pro dual role - get current action info
  const currentActionInfo = isDualRole 
    ? actionInfo?.actions?.[selectedMode]
    : actionInfo;

  // Handler pro otevření modalu
  const handleOpenModal = () => {
    setShowActionModal(true);
  };

  // Handler pro potvrzení akce z modalu
  const handleActionFromModal = (targetData, mode) => {
    console.log('✅ Submitting action from modal:', { 
      targetData, 
      mode, 
      role: player.role 
    });
    
    onAction(targetData, mode);
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

  // Kontrola, zda currentActionInfo existuje
  if (!currentActionInfo) {
    console.error('❌ currentActionInfo is undefined for role:', player.role, 'selectedMode:', selectedMode);
    return (
      <div className="night-phase inactive">
        <div className="night-header">
          <h3>🌙 Noc</h3>
          <p>Chybí informace o akci</p>
        </div>
        <div className="night-info">
          <p>🌙 Nemůže se zobrazit noční akce. Kontaktuj moderátora.</p>
        </div>
      </div>
    );
  }

  // Pokud už hráč potvrdil akci
  if (actionDone) {
    return (
      <div className={`action-confirmed ${currentActionInfo.color || ''}`}>
        <span>{currentActionInfo.icon || '🌙'}</span>
        <p>Tvá akce byla provedena</p>
        <small>{currentActionInfo.verb || 'Akce'} - potvrzeno</small>
      </div>
    );
  }



  return (
    <div className="night-phase">
      <div className="night-header">
        <h3>🌙 Noc - {currentActionInfo.icon || '🌙'} {currentActionInfo.verb || 'Akce'}</h3>
        <p>{currentActionInfo.description || 'Noční akce'}</p>
        
        {/* Uses counter for dual roles */}
        {isDualRole && !isPoisoner && selectedMode !== 'kill' && (
          <div className="uses-remaining">
            ⚡ Speciální akce: {usesRemaining}x
          </div>
        )}
        {isDualRole && !isPoisoner && selectedMode === 'kill' && (
          <div className="uses-remaining" style={{ opacity: 0.6 }}>
            ⚡ Sekundární akce: {usesRemaining}x
          </div>
        )}
        {/* For Poisoner: show counter only for strong_poison */}
        {isDualRole && isPoisoner && selectedMode === 'strong_poison' && (
          <div className="uses-remaining">
            ⚡ Silný jed: {usesRemaining}x
          </div>
        )}
      </div>

      {/* Dual Action Selector */}
      {isDualRole && (
        <div className="action-mode-selector">
          {Object.entries(actionInfo.actions).map(([mode, info]) => {
            // For Poisoner: disable only strong_poison when usesRemaining <= 0
            // For other dual roles: disable all actions except 'kill' when usesRemaining <= 0
            const isDisabled = isPoisoner
              ? mode === 'strong_poison' && usesRemaining <= 0
              : mode !== 'kill' && usesRemaining <= 0;
            
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
            // Witch can target alive players (both puppet and target must be alive)
            if (player.role === 'Witch') {
              return players.filter(p => p._id !== player._id && p.alive);
            }
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
          requiresTwoTargets={actionInfo?.requiresTwoTargets || false}
        />
      )}
    </div>
  );
}

export default NightPhase;
