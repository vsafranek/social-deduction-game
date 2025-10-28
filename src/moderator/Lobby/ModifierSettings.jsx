import React from 'react';
import './ModifierSettings.css';

function ModifierSettings({ playersCount, modifierConfig, setModifierConfig }) {
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
            <span className="modifier-name">Opilý</span>
          </div>
          <p className="modifier-desc">50% šance že schopnost nefunguje nebo dá falešnou informaci</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.opilýChance}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.opilýChance}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, opilýChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round(playersCount * (modifierConfig.opilýChance / 100))} hráčů
            </div>
          </div>
        </div>

        <div className="modifier-card">
          <div className="modifier-header">
            <span className="modifier-icon">🏚️</span>
            <span className="modifier-name">Poustevník</span>
          </div>
          <p className="modifier-desc">Vypadá jako zlý při vyšetřování, i když je dobrý</p>
          <div className="modifier-control">
            <label>Šance: <strong>{modifierConfig.poustevníkChance}%</strong></label>
            <input
              type="range" min="0" max="100" step="5"
              value={modifierConfig.poustevníkChance}
              onChange={(e) => setModifierConfig(prev => ({ ...prev, poustevníkChance: parseInt(e.target.value) }))}
            />
            <div className="modifier-estimate">
              ≈ {Math.round(playersCount * (modifierConfig.poustevníkChance / 100))} hráčů
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModifierSettings;
