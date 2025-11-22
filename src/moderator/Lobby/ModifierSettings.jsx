import React from 'react';
import './ModifierSettings.css';

function ModifierSettings({ playersCount, modifierConfig, setModifierConfig, onStartGame, canStart }) {
  return (
    <div className="lobby-column modifiers-column">
      <div className="column-header">
        <h2>🎲 Pasivní Modifikátory</h2>
      </div>

      <div className="modifiers-info">
        <p className="warning-text">⚠️ Hráči nevidí své modifikátory!</p>
      </div>

      <div className="modifier-list">
        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">🍺</span>
            <span className="modifier-name">Drunk (Opilý)</span>
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
            <span className="modifier-icon">🏚️</span>
            <span className="modifier-name">Recluse (Poustevník)</span>
          </div>
          <p className="modifier-desc">Při vyšetřování vypadá jako zlý, i když je dobrý</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0}
              onChange={(e) => setModifierConfig(prev => ({ 
                ...prev, 
                recluseChance: parseInt(e.target.value),
                poustevníkChance: parseInt(e.target.value) // Pro kompatibilitu
              }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round((playersCount || 0) * ((modifierConfig.recluseChance || modifierConfig.poustevníkChance || 0) / 100))} hráčů
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">😱</span>
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
            <span className="modifier-icon">😵</span>
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
              ? `⏳ Minimálně 3 hráči (${playersCount || 0}/3)`
              : '🚀 Start Game'
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default ModifierSettings;

