// src/player/components/NightActionModal/NightActionModal.jsx
import React, { useState } from 'react';
import RoleIcon from '../../../components/icons/RoleIcon';
import { ROLE_INFO } from '../../../data/roleInfo';
import './NightActionModal.css';

function NightActionModal({ 
  players, 
  onAction, 
  onClose, 
  actionInfo, 
  selectedMode,
  isDualRole,
  usesRemaining,
  visitedPlayers = [],
  investigationHistory = {},
  requiresTwoTargets = false
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedPuppet, setSelectedPuppet] = useState(null); // Pro Čarodějnici - první výběr (loutka)
  const [step, setStep] = useState('puppet'); // 'puppet' nebo 'target'
  
  // Pro Infected roli - zkontroluj, zda je hráč už navštíven
  const isPlayerVisited = (playerId) => {
    if (!visitedPlayers || visitedPlayers.length === 0) return false;
    
    // Normalizuj playerId na string
    const normalizedPlayerId = playerId?.toString();
    if (!normalizedPlayerId) return false;
    
    // Zkontroluj, zda je hráč v seznamu navštívených
    return visitedPlayers.some(visitedId => {
      // visitedId může být ObjectId objekt nebo string
      const normalizedVisitedId = visitedId?.toString?.() || visitedId?.toString() || String(visitedId);
      return normalizedVisitedId === normalizedPlayerId;
    });
  };

  const handlePlayerSelect = (playerId) => {
    if (requiresTwoTargets) {
      if (step === 'puppet') {
        setSelectedPuppet(playerId);
        setSelectedPlayer(null);
        setStep('target');
      } else {
        setSelectedPlayer(playerId);
      }
    } else {
      setSelectedPlayer(playerId);
    }
  };

  const handleBack = () => {
    if (requiresTwoTargets && step === 'target') {
      setStep('puppet');
      setSelectedPuppet(null);
      setSelectedPlayer(null);
    }
  };

  const handleConfirm = () => {
    if (requiresTwoTargets) {
      if (selectedPuppet && selectedPlayer) {
        // Předáme oba ID - puppetId a targetId
        onAction({ puppetId: selectedPuppet, targetId: selectedPlayer }, selectedMode);
        onClose();
      }
    } else {
      if (selectedPlayer) {
        onAction(selectedPlayer, selectedMode);
        onClose();
      }
    }
  };

  const currentActionInfo = isDualRole && actionInfo?.actions
    ? actionInfo.actions[selectedMode]
    : actionInfo;

  return (
    <div className="night-action-modal-overlay" onClick={onClose}>
      <div className="night-action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="night-action-modal-header">
          <h2>{currentActionInfo?.icon} {currentActionInfo?.verb}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="night-action-modal-content">
          <p className="action-instruction">
            {requiresTwoTargets && step === 'puppet' 
              ? 'Nejprve vyber hráče, kterého ovládneš' 
              : requiresTwoTargets && step === 'target'
              ? `Vyber cíl, na kterého ${selectedPuppet ? players.find(p => p._id === selectedPuppet)?.name || 'loutka' : 'loutka'} použije svou schopnost`
              : currentActionInfo?.description}
          </p>

          {isDualRole && selectedMode !== 'kill' && (
            <div className="uses-remaining-modal">
              ⚡ Speciální akce: {usesRemaining}x
            </div>
          )}

          {requiresTwoTargets && step === 'target' && (
            <button className="back-button" onClick={handleBack}>
              ← Zpět na výběr loutky
            </button>
          )}

          {players.length === 0 && (
            <div className="no-players-message">
              <p>💀 {currentActionInfo?.verb === 'Proveď pitvu' ? 'Žádní mrtví hráči k vyšetření' : 'Žádní hráči k výběru'}</p>
            </div>
          )}

          <div className="players-action-list">
            {players
              .filter(player => {
                // Pro druhý krok (target), vyloučíme vybraného puppeta
                if (requiresTwoTargets && step === 'target' && player._id === selectedPuppet) {
                  return false;
                }
                return true;
              })
              .map(player => {
              const visited = isPlayerVisited(player._id);
              // Normalize player._id to string for lookup
              const playerId = player._id?.toString?.() || player._id?.toString() || String(player._id);
              const investigation = investigationHistory[playerId];
              const isPuppet = requiresTwoTargets && selectedPuppet === player._id;
              const isSelected = selectedPlayer === player._id || isPuppet;
              
              return (
                <button
                  key={player._id}
                  className={`player-action-item ${isSelected ? 'selected' : ''} ${visited ? 'visited' : ''} ${investigation ? 'investigated' : ''}`}
                  onClick={() => handlePlayerSelect(player._id)}
                  disabled={isPuppet}
                >
                  <div className="player-action-avatar">
                    {player.avatar ? (
                      <img 
                        src={player.avatar} 
                        alt={player.name}
                        className="action-avatar-img"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className="action-avatar-fallback"
                      style={{ display: player.avatar ? 'none' : 'flex' }}
                    >
                      {player.alive ? '✅' : '💀'}
                    </div>
                  </div>
                  <div className="player-action-info">
                    <span className="player-action-name">{player.name}</span>
                    {!player.alive && (
                      <span className="dead-badge">💀 Mrtvý</span>
                    )}
                    {visited && (
                      <span className="visited-badge">🦠 Navštíveno</span>
                    )}
                    {investigation && (
                      <div className="investigation-badge">
                        {investigation.type === 'investigate' && '🔍'}
                        {investigation.type === 'consig' && '🕵️'}
                        {investigation.type === 'autopsy' && '🔬'}
                        <span className="investigation-roles-inline">
                          {investigation.roles && investigation.roles.split('/').map((role, idx) => {
                            const roleTeam = ROLE_INFO[role.trim()]?.team || 'neutral';
                            return (
                              <span key={idx} className={`role-icon-inline team-${roleTeam}`}>
                                <RoleIcon role={role.trim()} size={16} useDetails={true} />
                              </span>
                            );
                          })}
                        </span>
                        <span className="investigation-text">{investigation.roles}</span>
                      </div>
                    )}
                    {isPuppet && (
                      <span className="selected-badge">Loutka</span>
                    )}
                    {selectedPlayer === player._id && !isPuppet && (
                      <span className="selected-badge">Vybráno</span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="check-icon">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="night-action-modal-footer">
          <button 
            className="cancel-action-button" 
            onClick={onClose}
          >
            Zrušit
          </button>
          <button 
            className={`confirm-action-button ${currentActionInfo?.color || 'blue'}`}
            onClick={handleConfirm}
            disabled={requiresTwoTargets ? (!selectedPuppet || !selectedPlayer) : !selectedPlayer}
          >
            {requiresTwoTargets && step === 'puppet' ? 'Pokračovat →' : 'Potvrdit akci'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NightActionModal;


