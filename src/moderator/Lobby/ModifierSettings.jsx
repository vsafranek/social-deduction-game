import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoleIcon from '../../components/icons/RoleIcon';
import './ModifierSettings.css';

function ModifierSettings({ playersCount, modifierConfig, setModifierConfig, onStartGame, canStart, totalRolesForValidation }) {
  const iconRef = useRef(null);
  const tooltipRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    if (isTooltipVisible && iconRef.current && tooltipRef.current) {
      const updatePosition = () => {
        if (iconRef.current && tooltipRef.current) {
          const iconRect = iconRef.current.getBoundingClientRect();
          const tooltipRect = tooltipRef.current.getBoundingClientRect();
          setTooltipPosition({
            top: iconRect.bottom + 8,
            left: iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
          });
        }
      };
      
      // Počkáme na render a pak nastavíme pozici
      requestAnimationFrame(() => {
        updatePosition();
      });

      // Aktualizujeme pozici při scrollu nebo resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isTooltipVisible]);

  const handleIconMouseEnter = () => {
    setIsTooltipVisible(true);
  };

  const handleIconMouseLeave = () => {
    setIsTooltipVisible(false);
  };

  return (
    <div className="lobby-column modifiers-column">
      <div className="column-header">
        <div className="header-title-wrapper">
          <h2>🎲 Passive Modifiers</h2>
          <div className="info-icon-wrapper">
            <span 
              ref={iconRef}
              className="info-icon"
              onMouseEnter={handleIconMouseEnter}
              onMouseLeave={handleIconMouseLeave}
            >?</span>
            {isTooltipVisible && createPortal(
              <div 
                ref={tooltipRef}
                className="info-tooltip"
                style={{
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left}px`
                }}
              >
                <div className="info-tooltip-content">
                  <div className="info-tooltip-title">ℹ️ Modifier Information</div>
                  <div className="info-tooltip-body">
                    <p>Modifiers are passive effects that are randomly assigned to players at game start.</p>
                    <p>Chance determines the probability (in %) that a modifier will be assigned to a specific player.</p>
                    <p>Modifiers are applied automatically and affect gameplay, but players cannot see them.</p>
                    <p className="info-tooltip-warning">⚠️ Players cannot see their modifiers!</p>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div className="modifier-list">
        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Drunk" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Drunk</span>
              <div className="modifier-team-badges">
                <span className="team-badge good">Good</span>
                <span className="team-badge neutral">Neutral</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Stays home and receives fake action results</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.drunkChance || modifierConfig.opilýChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.drunkChance || modifierConfig.opilýChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ 
                ...prev, 
                drunkChance: parseInt(e.target.value),
                opilýChance: parseInt(e.target.value) // Pro kompatibilitu
              }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.drunkChance || modifierConfig.opilýChance || 0) / 100))} players
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Shady" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Shady</span>
              <div className="modifier-team-badges">
                <span className="team-badge good">Good</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Appears as evil during investigation, even if good</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.shadyChance || modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.shadyChance || modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ 
                ...prev, 
                shadyChance: parseInt(e.target.value),
                recluseChance: parseInt(e.target.value), // Pro kompatibilitu
                poustevníkChance: parseInt(e.target.value) // Pro kompatibilitu
              }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.shadyChance || modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0) / 100))} players
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Innocent" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Innocent</span>
              <div className="modifier-team-badges">
                <span className="team-badge evil">Evil</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Appears as good or neutral during investigation, even if evil</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.innocentChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.innocentChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, innocentChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.innocentChance || 0) / 100))} players
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Paranoid" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Paranoid</span>
              <div className="modifier-team-badges">
                <span className="team-badge good">Good</span>
                <span className="team-badge neutral">Neutral</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Sees fake visitors who were not actually there</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.paranoidChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.paranoidChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, paranoidChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.paranoidChance || 0) / 100))} players
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Insomniac" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Insomniac</span>
              <div className="modifier-team-badges">
                <span className="team-badge good">Good</span>
                <span className="team-badge neutral">Neutral</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Sees everyone who visits them</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.insomniacChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.insomniacChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, insomniacChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.insomniacChance || 0) / 100))} players
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Amnesiac" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <div className="modifier-name-badge-wrapper">
              <span className="modifier-name">Amnesiac</span>
              <div className="modifier-team-badges">
                <span className="team-badge good">Good</span>
                <span className="team-badge evil">Evil</span>
                <span className="team-badge neutral">Neutral</span>
              </div>
            </div>
          </div>
          <p className="modifier-desc">Does not know their role, but can perform actions normally</p>
          <div className="modifier-control">
            <label>Chance: <strong>{modifierConfig.amnesiacChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.amnesiacChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, amnesiacChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.amnesiacChance || 0) / 100))} players
            </div>
          </div>
        </div>
      </div>

      {onStartGame && (
        <div className="column-footer">
          <button 
            className="btn-start-game" 
            onClick={onStartGame}
            disabled={!canStart}
          >
            {!canStart
              ? (playersCount < 3 
                  ? `⏳ Minimum 3 players (${playersCount || 0}/3)`
                  : `⚠️ Roles don't match (${totalRolesForValidation || 0} roles / ${playersCount || 0} players)`)
              : '🚀 Start Game'
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default ModifierSettings;

