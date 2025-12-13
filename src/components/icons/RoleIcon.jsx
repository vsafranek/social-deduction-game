import React, { useState, useEffect } from 'react';

/**
 * Automaticky generuje cestu k ikoně role/modifikátoru
 * Pro ikonu role (ne pro avatar) použije "details" verzi, pokud existuje
 * @param {string} name - Název role nebo modifikátoru
 * @param {boolean} useDetails - Zda použít "details" verzi (pro ikonu role, ne avatar)
 * @returns {string} Cesta k ikoně
 */
function generateIconPath(name, useDetails = false) {
  if (!name) return null;
  // Převede název na lowercase a vytvoří cestu
  // Např. "Doctor" -> "/icons/roles/doctor.svg" nebo "/icons/roles/doctor_details.png"
  const iconName = name.toLowerCase().replace(/\s+/g, '');

  // Pokud máme použít "details" verzi, zkus nejdřív PNG s "_details", pak SVG
  if (useDetails) {
    // Zkus nejdřív PNG s "_details"
    return `/icons/roles/${iconName}_details.png`;
  }

  // Normální ikona - nejdřív SVG, pak PNG
  return `/icons/roles/${iconName}.svg`;
}

// Fallback emoji pro role bez SVG ikon
const EMOJI_FALLBACK = {
  'Doctor': '💉',
  'Jailer': '👮',
  'Investigator': '🔍',
  'Coroner': '🔬',
  'Lookout': '👁️',
  'Guardian': '🛡️',
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
  'Witch': '🧙‍♀️',
};

// Fallback emoji pro modifikátory bez SVG ikon
const MODIFIER_EMOJI_FALLBACK = {
  'Drunk': '🍺',
  'Shady': '🏚️',
  'Innocent': '😇',
  'Paranoid': '😱',
  'Insomniac': '😵',
  'Sweetheart': '💖',
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
export default function RoleIcon({ role, size = 24, className = '', alt, isModifier = false, useDetails = false }) {
  const [imageError, setImageError] = useState(false);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);

  // Automaticky generuj cestu k ikoně na základě názvu
  // Pro ikonu role použij "details" verzi, pokud existuje
  const paths = [];
  if (role) {
    if (useDetails && !isModifier) {
      // Zkus nejdřív "details" PNG, pak normální SVG
      paths.push(`/icons/roles/${role.toLowerCase().replace(/\s+/g, '')}_details.png`);
      paths.push(`/icons/roles/${role.toLowerCase().replace(/\s+/g, '')}.svg`);
    } else {
      // Normální ikona - SVG
      paths.push(`/icons/roles/${role.toLowerCase().replace(/\s+/g, '')}.svg`);
    }
  }

  const currentPath = paths[currentPathIndex] || null;

  // Získej emoji fallback
  const emoji = isModifier
    ? (MODIFIER_EMOJI_FALLBACK[role] || '❓')
    : (EMOJI_FALLBACK[role] || '❓');

  // Resetuj chybu při změně role
  useEffect(() => {
    setImageError(false);
    setCurrentPathIndex(0);
  }, [role, useDetails]);

  // Handle error - zkus další cestu v seznamu
  const handleError = () => {
    if (currentPathIndex < paths.length - 1) {
      // Zkus další cestu
      setCurrentPathIndex(prev => prev + 1);
      setImageError(false);
    } else {
      // Všechny cesty selhaly, použij emoji
      setImageError(true);
    }
  };

  // Pokud nemáme cestu nebo došlo k chybě načítání, použij emoji
  if (!currentPath || imageError) {
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

  // Použij ikonu - pokud neexistuje, onError handler zkusí další cestu nebo emoji
  return (
    <img
      key={`${currentPath}-${currentPathIndex}`} // Force re-render when path changes
      src={currentPath}
      alt={alt || role}
      width={size}
      height={size}
      className={`role-icon-svg ${className}`}
      style={{ display: 'inline-block', objectFit: 'contain' }}
      onError={handleError}
    />
  );
}
