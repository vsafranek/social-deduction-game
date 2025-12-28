import React, { useState } from "react";
import { createPortal } from "react-dom";
import { gameApi } from "../../api/gameApi";
import ConfirmModal from "../components/ConfirmModal/ConfirmModal";
import "./PlayersList.css";

function PlayersList({ players, gameId, onRefresh }) {
  const [showKickModal, setShowKickModal] = useState(false);
  const [playerToKick, setPlayerToKick] = useState(null);

  const handleKickClick = (playerId, playerName) => {
    setPlayerToKick({ id: playerId, name: playerName });
    setShowKickModal(true);
  };

  const handleKickConfirm = async () => {
    if (!playerToKick || !gameId) {
      setShowKickModal(false);
      return;
    }

    try {
      await gameApi.kickPlayer(gameId, playerToKick.id);
      if (onRefresh) {
        onRefresh();
      }
      setShowKickModal(false);
      setPlayerToKick(null);
    } catch (error) {
      console.error("Error kicking player:", error);
      alert(error.message || "Nepodařilo se vykopnout hráče");
      setShowKickModal(false);
      setPlayerToKick(null);
    }
  };

  const handleKickCancel = () => {
    setShowKickModal(false);
    setPlayerToKick(null);
  };

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
          {players.map((p) => {
            const hasAvatar = p.avatar && p.avatar.trim();
            const detailAvatarPath = hasAvatar
              ? getDetailAvatarPath(p.avatar)
              : null;
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
                          img.src = p.avatar;
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
                  className="player-avatar-fallback"
                  style={{
                    display: hasAvatar ? "none" : "flex",
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255, 255, 255, 0.1)",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="player-info">
                  <span className="player-name">{p.name}</span>
                </div>
                <button
                  className="btn-kick-player"
                  onClick={() => handleKickClick(p._id, p.name)}
                  title="Vykopnout hráče"
                >
                  ❌
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Kicking Player - rendered via Portal to avoid overflow issues */}
      {showKickModal &&
        playerToKick &&
        createPortal(
          <ConfirmModal
            title="Kick Player?"
            message={`Kick "${playerToKick.name}" from the lobby?`}
            confirmText="Kick"
            cancelText="Cancel"
            onConfirm={handleKickConfirm}
            onCancel={handleKickCancel}
            isDanger={true}
          />,
          document.body
        )}
    </div>
  );
}

export default PlayersList;
