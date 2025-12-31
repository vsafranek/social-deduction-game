// src/player/components/PlayersList/PlayersList.jsx
import React from 'react';
import './PlayersList.css';

function PlayersList({ 
  players, 
  onSelectPlayer,  // ✅ Primary prop name
  onSelect,        // ✅ Alias for compatibility
  selectedPlayer,  // ✅ Primary prop name
  selectedPlayerId, // ✅ Alias for compatibility
  selectionMode = 'single',
  showRole = false,
  emptyMessage = 'Žádní hráči k dispozici'
}) {
  // ✅ Support both prop names
  const handleSelect = onSelectPlayer || onSelect;
  const selected = selectedPlayer || selectedPlayerId;

  // Get details version path of avatar
  const getDetailAvatarPath = (avatarPath) => {
    if (!avatarPath) return null;

    // Extract filename and extension
    // avatarPath is like "/avatars/meercat.jpg"
    const pathParts = avatarPath.split("/");
    const filename = pathParts[pathParts.length - 1];
    const nameWithoutExt = filename.replace(/\.[^/.]+$/i, "");
    const originalExt = filename.match(/\.[^/.]+$/i)?.[0] || "";

    // Construct detail path: /avatars/meercat_detail.jpg
    return `/avatars/${nameWithoutExt}_detail${originalExt}`;
  };

  if (players.length === 0) {
    return (
      <div className="players-list-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const handlePlayerClick = (playerId) => {
    if (!handleSelect) {
      console.warn('⚠️ No onSelect or onSelectPlayer handler provided');
      return;
    }

    console.log('🎯 Player clicked:', playerId);
    
    if (selectionMode === 'single') {
      // Toggle selection
      handleSelect(playerId === selected ? null : playerId);
    } else {
      // Always select (no toggle)
      handleSelect(playerId);
    }
  };

  return (
    <div className="players-list">
      {players.map(player => (
        <button
          key={player._id}
          className={`player-list-item ${selected === player._id ? 'selected' : ''}`}
          onClick={() => handlePlayerClick(player._id)}
          type="button"
        >
          <div className="player-avatar">
            {player.avatar && player.avatar.trim() ? (
              <img 
                key={`${player._id}-${player.avatar}`}
                src={getDetailAvatarPath(player.avatar) || player.avatar} 
                alt={player.name}
                className="avatar-img"
                onError={(e) => {
                  const img = e.target;
                  const currentSrc = img.src;

                  // Track attempts using data attribute to prevent infinite loops
                  const currentAttempts = parseInt(
                    img.dataset.errorAttempts || "0",
                    10
                  );
                  const attempts = currentAttempts + 1;
                  img.dataset.errorAttempts = attempts.toString();

                  // Prevent infinite loops - max 3 attempts:
                  // 1. detail original extension (attempt 1)
                  // 2. detail alternate case extension (attempt 2)
                  // 3. normal avatar (attempt 3) - if this fails, show fallback
                  if (attempts >= 4) {
                    // Max attempts exceeded, show fallback
                    img.style.display = "none";
                    const fallback = img.nextSibling;
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                    return;
                  }

                  if (currentSrc.includes("_detail")) {
                    // We're trying a detail variant
                    const pathParts = currentSrc.split("_detail");
                    const basePath = pathParts[0];
                    const ext = pathParts[1];

                    // Try alternate case only on first attempt (attempt 1 -> attempt 2)
                    if (
                      attempts === 1 &&
                      ext === ext.toLowerCase() &&
                      ext !== ext.toUpperCase()
                    ) {
                      // First attempt failed with lowercase, try uppercase
                      img.src = `${basePath}_detail${ext.toUpperCase()}`;
                    } else if (
                      attempts === 1 &&
                      ext === ext.toUpperCase() &&
                      ext !== ext.toLowerCase()
                    ) {
                      // First attempt failed with uppercase, try lowercase
                      img.src = `${basePath}_detail${ext.toLowerCase()}`;
                    } else {
                      // All detail variants exhausted (attempt 2+), fallback to normal avatar
                      img.src = player.avatar;
                    }
                  } else {
                    // Normal avatar failed (attempt 3), hide broken image and show fallback immediately
                    img.style.display = "none";
                    const fallback = img.nextSibling;
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }
                }}
              />
            ) : null}
            <div 
              className="avatar-fallback"
              style={{ display: (player.avatar && player.avatar.trim()) ? 'none' : 'flex' }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="player-info">
            <span className="player-name">{player.name}</span>
            <span className="player-status">
              {player.alive ? 'Živý' : 'Mrtvý'}
              {showRole && player.role && ` - ${player.role}`}
            </span>
          </div>
          {selected === player._id && (
            <div className="player-check">✓</div>
          )}
        </button>
      ))}
    </div>
  );
}

export default PlayersList;
