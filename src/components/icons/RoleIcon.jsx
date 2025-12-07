import React, { useState, useEffect } from 'react';

/**
 * Automaticky generuje cestu k SVG ikoně na základě názvu role/modifikátoru
 * @param {string} name - Název role nebo modifikátoru
 * @returns {string} Cesta k SVG ikoně
 */
function generateIconPath(name) {
  if (!name) return null;
  // Převede název na lowercase a vytvoří cestu
  // Např. "Doctor" -> "/icons/doctor.svg", "SerialKiller" -> "/icons/serialkiller.svg"
  const iconName = name.toLowerCase().replace(/\s+/g, '');
  return `/icons/${iconName}.svg`;
}

// Fallback emoji pro role bez SVG ikon
const EMOJI_FALLBACK = {
  'Doctor': '💉',
  'Jailer': '👮',
  'Investigator': '🔍',
  'Coroner': '🔬',
  'Lookout': '👁️',
  'Trapper': '🪤',
  'Tracker': '👣',
  'Hunter': '🏹',
  'Citizen': '👤',
  'Killer': '🔪',
  'Cleaner': '🧹',
  'Accuser': '👉',
  'Consigliere': '🕵️',
  'SerialKiller': '🛡️',
  'Infected': '🦠',
  'Jester': '🎭',
};

// Fallback emoji pro modifikátory bez SVG ikon
const MODIFIER_EMOJI_FALLBACK = {
  'Drunk': '🍺',
  'Shady': '🏚️',
  'Innocent': '😇',
  'Paranoid': '😱',
  'Insomniac': '😵',
};

/**
 * Komponenta pro zobrazení ikony role nebo modifikátoru
 * Automaticky načítá SVG ikonu na základě názvu, pokud neexistuje, použije emoji fallback
 * @param {string} role - Název role nebo modifikátoru
 * @param {number} size - Velikost ikony v px (default: 24)
 * @param {string} className - CSS třída
 * @param {string} alt - Alt text pro obrázek
 * @param {boolean} isModifier - Zda se jedná o modifikátor (default: false)
 */
export default function RoleIcon({ role, size = 24, className = '', alt, isModifier = false }) {
  const [imageError, setImageError] = useState(false);
  
  // Automaticky generuj cestu k SVG ikoně na základě názvu
  const svgPath = role ? generateIconPath(role) : null;
  
  // Získej emoji fallback
  const emoji = isModifier
    ? (MODIFIER_EMOJI_FALLBACK[role] || '❓')
    : (EMOJI_FALLBACK[role] || '❓');

  // Resetuj chybu při změně role
  useEffect(() => {
    setImageError(false);
  }, [role]);

  // Pokud nemáme SVG nebo došlo k chybě načítání, použij emoji
  if (!svgPath || imageError) {
    return (
      <span 
        className={`role-icon-emoji ${className}`}
        style={{ fontSize: `${size}px`, display: 'inline-block', lineHeight: 1 }}
        aria-label={alt || role}
      >
        {emoji}
      </span>
    );
  }

  // Použij SVG ikonu - pokud neexistuje, onError handler automaticky přepne na emoji
  return (
    <img
      src={svgPath}
      alt={alt || role}
      width={size}
      height={size}
      className={`role-icon-svg ${className}`}
      style={{ display: 'inline-block', objectFit: 'contain' }}
      onError={() => setImageError(true)}
    />
  );
}
