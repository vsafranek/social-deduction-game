import React from 'react';
import { gameApi } from '../../api/gameApi';
import './PlayersList.css';

function PlayersList({
  players,
  gameId,
  onRefresh
}) {
  const handleKick = async (playerId, playerName) => {
    if (!window.confirm(`Do you really want to kick player "${playerName}"?`)) {
      return;
    }

    try {
      await gameApi.kickPlayer(gameId, playerId);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error kicking player:', error);
      alert(error.message || 'Failed to kick player');
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
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  return (
    <div className="lobby-column players-column">
      <div className="column-header">
        <h2>👥 Players ({players.length})</h2>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <p>No players</p>
          <small>Waiting for connections...</small>
        </div>
      ) : (
        <div className="players-list">
          {players.map(p => {
            const hasAvatar = p.avatar && p.avatar.trim();
            const detailAvatarPath = hasAvatar ? getDetailAvatarPath(p.avatar) : null;
            return (
            <div key={p._id} className="player-item">
              {hasAvatar ? (
                <img 
                  src={detailAvatarPath || p.avatar} 
                  alt={p.name}
                  className="player-avatar-img"
                  onError={(e) => {
                    const img = e.target;
                    const currentSrc = img.src;
                    
                    // Track attempts using data attribute to prevent infinite loops
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
                      const fallback = img.nextSibling;
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
                      
                      // Try alternate case only on first attempt (attempt 1 -> attempt 2)
                      if (attempts === 1 && ext === ext.toLowerCase() && ext !== ext.toUpperCase()) {
                        // First attempt failed with lowercase, try uppercase
                        img.src = `${basePath}_detail${ext.toUpperCase()}`;
                      } else if (attempts === 1 && ext === ext.toUpperCase() && ext !== ext.toLowerCase()) {
                        // First attempt failed with uppercase, try lowercase
                        img.src = `${basePath}_detail${ext.toLowerCase()}`;
                      } else {
                        // All detail variants exhausted (attempt 2+), fallback to normal avatar
                        img.src = p.avatar;
                      }
                    } else {
                      // Normal avatar failed (attempt 3), hide broken image and show fallback immediately
                      img.style.display = 'none';
                      const fallback = img.nextSibling;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }
                  }}
                />
              ) : null}
              <div 
                className="player-avatar-fallback"
                style={{ 
                  display: hasAvatar ? 'none' : 'flex',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.1)',
                  fontSize: '20px',
                  flexShrink: 0
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="player-info">
                <span className="player-name">{p.name}</span>
              </div>
              <button
                className="btn-kick-player"
                onClick={() => handleKick(p._id, p.name)}
                title="Kick player"
              >
                ❌
              </button>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export default PlayersList;
