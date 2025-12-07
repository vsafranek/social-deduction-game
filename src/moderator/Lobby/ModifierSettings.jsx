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
          <h2>🎲 Pasivní Modifikátory</h2>
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
                  <div className="info-tooltip-title">ℹ️ Informace o modifikátorech</div>
                  <div className="info-tooltip-body">
                    <p>Modifikátory jsou pasivní efekty, které se náhodně přiřadí hráčům při startu hry.</p>
                    <p>Šance určuje pravděpodobnost (v %), že se modifikátor přiřadí konkrétnímu hráči.</p>
                    <p>Modifikátory se aplikují automaticky a ovlivňují hru, ale hráči je nevidí.</p>
                    <p className="info-tooltip-warning">⚠️ Hráči nevidí své modifikátory!</p>
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
            <span className="modifier-name">Drunk</span>
          </div>
          <p className="modifier-desc">Zůstane doma a dostane falešné výsledky akcí</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.drunkChance || modifierConfig.opilýChance || 0}%</strong></label>
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
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.drunkChance || modifierConfig.opilýChance || 0) / 100))} hráčů
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Shady" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <span className="modifier-name">Shady / Innocent</span>
          </div>
          <p className="modifier-desc">Shady (dobrý tým): vypadá jako zlý při vyšetřování. Innocent (zlý tým): vypadá jako dobrý/neutrální při vyšetřování.</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.shadyChance || modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0}%</strong></label>
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
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.shadyChance || modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0) / 100))} hráčů
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Paranoid" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <span className="modifier-name">Paranoid</span>
          </div>
          <p className="modifier-desc">Vidí falešné návštěvníky, kteří u něj nebyly</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.paranoidChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.paranoidChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, paranoidChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.paranoidChance || 0) / 100))} hráčů
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">
              <RoleIcon role="Insomniac" size={48} className="modifier-icon-svg" isModifier={true} />
            </span>
            <span className="modifier-name">Insomniac</span>
          </div>
          <p className="modifier-desc">Vidí všechny, kdo ho navštíví</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.insomniacChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.insomniacChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, insomniacChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.insomniacChance || 0) / 100))} hráčů
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
                  ? `⏳ Minimálně 3 hráči (${playersCount || 0}/3)`
                  : `⚠️ Role se nerovnají (${totalRolesForValidation || 0} rolí / ${playersCount || 0} hráčů)`)
              : '🚀 Start Game'
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default ModifierSettings;

