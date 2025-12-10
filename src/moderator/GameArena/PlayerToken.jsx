// src/components/moderator/GameArena/PlayerToken.jsx
import React from 'react';
import './PlayerToken.css';

function PlayerToken({ player, phase, votes, style }) {
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
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  const hasAvatar = player.avatar && player.avatar.trim();
  const detailAvatarPath = hasAvatar ? getDetailAvatarPath(player.avatar) : null;

  return (
    <div
      className={`player-token ${!player.alive ? 'dead' : ''}`}
      style={style}
      title={player.name}
    >
      {!player.alive && <div className="death-shroud">💀</div>}

      <div className="player-avatar">
        <div className="avatar-ring"></div>
        {hasAvatar ? (
          <img 
            src={detailAvatarPath || player.avatar} 
            alt={player.name}
            className="avatar-content avatar-image"
            onError={(e) => {
              const img = e.target;
              const currentSrc = img.src;
              
              // Track attempts using data attribute to prevent infinite loops
              const currentAttempts = parseInt(img.dataset.errorAttempts || '0', 10);
              const attempts = currentAttempts + 1;
              img.dataset.errorAttempts = attempts.toString();
              
              // Prevent infinite loops - max 3 attempts
              if (attempts >= 4) {
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback) {
                  fallback.style.display = 'flex';
                }
                return;
              }
              
              if (currentSrc.includes('_detail')) {
                // We're trying a detail variant
                const pathParts = currentSrc.split('_detail');
                const basePath = pathParts[0];
                const ext = pathParts[1];
                
                // Try alternate case only on first attempt
                if (attempts === 1 && ext === ext.toLowerCase() && ext !== ext.toUpperCase()) {
                  img.src = `${basePath}_detail${ext.toUpperCase()}`;
                } else if (attempts === 1 && ext === ext.toUpperCase() && ext !== ext.toLowerCase()) {
                  img.src = `${basePath}_detail${ext.toLowerCase()}`;
                } else {
                  // All detail variants failed, use normal avatar
                  img.src = player.avatar;
                }
              } else {
                // Normal avatar also failed, show fallback
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback) {
                  fallback.style.display = 'flex';
                }
              }
            }}
          />
        ) : null}
        <div 
          className="avatar-content avatar-fallback"
          style={{ display: hasAvatar ? 'none' : 'flex' }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* badge s počtem hlasů během dne - vpravo nahoře nad avatarem */}
      {phase === 'day' && player.alive && votes > 0 && (
        <div className="vote-badge">🗳️ {votes}</div>
      )}

      {/* veřejné info bez meta */}
      <div className="player-public-info">
        <div className="token-name">{player.name}</div>
        {!player.alive && <div className="token-dead">Mrtvý</div>}
      </div>
    </div>
  );
}

export default PlayerToken;
