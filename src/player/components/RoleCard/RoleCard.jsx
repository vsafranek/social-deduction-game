// src/player/components/RoleCard/RoleCard.jsx
import React, { useState, useRef, useEffect } from 'react';
import RoleIcon from '../../../components/icons/RoleIcon';
import { getRoleInfo } from '../../../data/roleInfo';
import './RoleCard.css';

function RoleCard({ player, gameState, phase, onAvatarClick }) {
  const [expanded, setExpanded] = useState(false);
  const role = player.role || 'Citizen';
  const roleData = getRoleInfo(role);
  const isMayor = gameState?.game?.mayor && gameState.game.mayor.toString() === player._id.toString();
  
  const handleAvatarClick = (e) => {
    if (onAvatarClick && phase === 'lobby') {
      e.stopPropagation();
      onAvatarClick();
    }
  };

  // Get details version path of avatar
  const getDetailAvatarPath = (avatarPath) => {
    if (!avatarPath) return null;
    
    // Extract filename and extension
    // avatarPath is like "/avatars/meercat.jpg"
    const pathParts = avatarPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const nameWithoutExt = filename.replace(/\.[^/.]+$/i, '');
    const originalExt = filename.match(/\.[^/.]+$/i)?.[0] || '';
    
    // Construct detail path: /avatars/meercat_detail.jpg
    // Try with original extension case first
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  const hasAvatar = player.avatar && player.avatar.trim();
  const detailAvatarPath = hasAvatar ? getDetailAvatarPath(player.avatar) : null;
  
  // Reset error attempts when avatar changes
  useEffect(() => {
    // This will be handled by the key prop on img elements, which forces remount
  }, [player.avatar]);
  
  // Create error handler that tracks attempts using data attribute to prevent infinite loops
  const createAvatarErrorHandler = () => (e) => {
    const img = e.target;
    const currentSrc = img.src;
    
    // Get or initialize attempt count using data attribute
    const currentAttempts = parseInt(img.dataset.errorAttempts || '0', 10);
    const attempts = currentAttempts + 1;
    img.dataset.errorAttempts = attempts.toString();
    
    // Prevent infinite loops - max 3 attempts:
    // 1. detail original extension (attempt 1)
    // 2. detail alternate case extension (attempt 2)
    // 3. normal avatar (attempt 3) - if this fails, show fallback
    if (attempts >= 4) {
      // Max attempts exceeded, show fallback
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback && fallback.classList.contains('role-avatar-fallback')) {
        fallback.style.display = 'flex';
      }
      return;
    }
    
    if (currentSrc.includes('_detail')) {
      // We're trying a detail variant
      const pathParts = currentSrc.split('_detail');
      const basePath = pathParts[0];
      const ext = pathParts[1];
      
      // Try alternate case only on first attempt (attempt 1 -> attempt 2)
      if (attempts === 1 && ext === ext.toLowerCase() && ext !== ext.toUpperCase()) {
        // First attempt failed with lowercase, try uppercase
        img.src = `${basePath}_detail${ext.toUpperCase()}`;
      } else if (attempts === 1 && ext === ext.toUpperCase() && ext !== ext.toLowerCase()) {
        // First attempt failed with uppercase, try lowercase
        img.src = `${basePath}_detail${ext.toLowerCase()}`;
      } else {
        // All detail variants exhausted (attempt 2+), fallback to normal avatar
        img.src = player.avatar;
      }
    } else {
      // Normal avatar failed (attempt 3), hide broken image and show fallback immediately
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback && fallback.classList.contains('role-avatar-fallback')) {
        fallback.style.display = 'flex';
      }
    }
  };

  return (
    <div className={`role-card ${expanded ? 'expanded' : ''} ${roleData.team} ${!player.alive ? 'dead' : ''}`}>
      <button
        className="role-card-button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="role-header">
          {hasAvatar ? (
            phase === 'lobby' && onAvatarClick ? (
              <div 
                className="role-avatar-clickable"
                onClick={handleAvatarClick}
                title="Klikni pro změnu avatara"
              >
                <img
                  key={player.avatar}
                  src={detailAvatarPath || player.avatar}
                  alt="Avatar hráče"
                  className="role-player-avatar"
                  onError={createAvatarErrorHandler()}
                />
                <div 
                  className="role-avatar-fallback"
                  style={{ display: 'none' }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              // Avatar displayed but not clickable (not in lobby)
              <div className="role-avatar-display">
                <img
                  key={player.avatar}
                  src={detailAvatarPath || player.avatar}
                  alt="Avatar hráče"
                  className="role-player-avatar"
                  onError={createAvatarErrorHandler()}
                />
                <div 
                  className="role-avatar-fallback"
                  style={{ display: 'none' }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )
          ) : (
            // No avatar - show letter fallback
            phase === 'lobby' && onAvatarClick ? (
              <div 
                className="role-avatar-clickable"
                onClick={handleAvatarClick}
                title="Klikni pro změnu avatara"
              >
                <div className="role-avatar-fallback">
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="role-avatar-display">
                <div className="role-avatar-fallback">
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )
          )}
          <div className="role-name-status">
            <h2>{role}</h2>
            {isMayor && (
              <p className="mayor-indicator">🏛️ Starosta</p>
            )}
            <p className={`team-label ${roleData.team}`}>
              {roleData.teamLabel}
            </p>
            <p className={`status ${player.alive ? 'alive' : 'dead'}`}>
              {player.alive ? '✅ Živý' : '💀 Mrtvý'}
            </p>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>

        {expanded && (
          <div className="role-details">
            <div className="role-description">
              <p>{roleData.description}</p>
            </div>

            {isMayor && (
              <div className="role-mayor">
                <h4>🏛️ Starosta</h4>
                <p className="mayor-info">Jsi zvolený starosta - moderuješ hru a máš 2 hlasy</p>
              </div>
            )}

            {player.modifier && (
              <div className="role-modifier">
                <h4>⚠️ Modifikátor: {player.modifier}</h4>
                <p className="modifier-warning">Tvoje schopnost je ovlivněna!</p>
              </div>
            )}

            <div className="role-footer">
              <p className="action-label">Noční akce: <strong>{roleData.actionVerb}</strong></p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

export default RoleCard;
