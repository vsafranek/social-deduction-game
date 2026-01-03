// src/api/gameApi.js

// Detect if running in Electron or web browser
const isElectron =
  typeof window !== "undefined" && window.electronAPI !== undefined;

// Determine API base URL
// Priority: 1. Environment variable (for production deployments like Vercel)
//           2. Electron localhost (for Electron app)
//           3. Same origin (for local development with Vite proxy)
let API_BASE;
if (import.meta.env.VITE_API_URL) {
  // Use environment variable if set (for production deployments like Vercel)
  // This should point to your external backend server where Express is running
  API_BASE = import.meta.env.VITE_API_URL;
} else if (isElectron) {
  // Electron app - use localhost (backend runs locally in Electron)
  API_BASE = "http://localhost:3001/api";
} else {
  // Web browser - use same origin (Vite proxy will forward to backend in dev)
  // In production (Vercel), VITE_API_URL should be set to your backend URL
  API_BASE = window.location.origin + "/api";
}

console.log("🔌 API_BASE:", API_BASE);
console.log("🔌 Environment:", {
  isElectron,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  origin: typeof window !== "undefined" ? window.location.origin : "N/A",
});

export const gameApi = {
  // ==================
  // GAME MANAGEMENT
  // ==================

  /**
   * Create new game
   */
  async createGame(ip, port) {
    const res = await fetch(`${API_BASE}/game/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, port }),
    });
    return res.json();
  },

  /**
   * Get current game state
   */
  getGameState(gameId) {
    return fetch(`${API_BASE}/game/${gameId}/state`).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    });
  },

  /**
   * Join game by room code (unified endpoint)
   */
  async joinGameByCode(roomCode, playerName, sessionId) {
    console.log("🚪 gameApi.joinGameByCode called with room:", roomCode);
    try {
      const res = await fetch(`${API_BASE}/game/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, name: playerName, sessionId }),
      });

      const data = await res.json();
      console.log("Join response:", data);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      return data;
    } catch (error) {
      console.error("❌ joinGameByCode error:", error);
      throw error;
    }
  },

  /**
   * Start game with role and modifier configuration
   */
  async startGameWithConfig(
    gameId,
    finalRoleConfig,
    modifierConfig,
    timers,
    roleConfiguration,
    roleMaxLimits,
    guaranteedRoles,
    teamLimits
  ) {
    const res = await fetch(`${API_BASE}/game/${gameId}/start-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: finalRoleConfig,
        modifiers: modifierConfig,
        timers,
        roleConfiguration,
        roleMaxLimits,
        guaranteedRoles,
        teamLimits,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to start game");
    }

    return res.json();
  },

  /**
   * Reset game to lobby
   */
  async resetToLobby(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/reset-to-lobby`, {
      method: "POST",
    });
    return res.json();
  },

  /**
   * End lobby - kick all players and delete game
   */
  async endLobby(gameId) {
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/end-lobby`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      return data;
    } catch (error) {
      console.error("❌ endLobby error:", error);
      throw error;
    }
  },

  /**
   * Delete entire game from database (including all players and logs)
   */
  async deleteGame(gameId) {
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      return data;
    } catch (error) {
      console.error("❌ deleteGame error:", error);
      throw error;
    }
  },

  // ==================
  // NIGHT PHASE
  // ==================

  /**
   * Set night action (NEW - with dual-action support and Witch control)
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {string} targetId - Target player ID
   * @param {string|null} actionMode - Action mode for dual roles (kill, clean_role, frame, etc.)
   * @param {string|null} puppetId - Puppet player ID for Witch control
   */
  async setNightAction(
    gameId,
    playerId,
    targetId,
    actionMode = null,
    puppetId = null
  ) {
    const body = { playerId, targetId };

    // Add actionMode if provided (for dual-action roles)
    if (actionMode) {
      body.actionMode = actionMode;
    }

    // Add puppetId if provided (for Witch control)
    if (puppetId) {
      body.puppetId = puppetId;
    }

    const res = await fetch(`${API_BASE}/game/${gameId}/set-night-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to set night action");
    }

    return res.json();
  },

  /**
   * End night phase (moderator action)
   */
  async endNight(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-night`, {
      method: "POST",
    });
    return res.json();
  },

  // ==================
  // DAY PHASE
  // ==================

  /**
   * Vote to eliminate a player
   */
  async vote(gameId, playerId, targetId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, targetId }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to vote");
    }

    return res.json();
  },

  /**
   * End day phase (moderator action)
   */
  async endDay(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-day`, {
      method: "POST",
    });
    return res.json();
  },

  /**
   * Transition from voting_reveal phase to night
   */
  async votingRevealToNight(gameId) {
    const res = await fetch(
      `${API_BASE}/game/${gameId}/voting-reveal-to-night`,
      {
        method: "POST",
      }
    );
    return res.json();
  },

  /**
   * End current phase (auto-detect day/night)
   */
  async endPhase(gameId) {
    console.log(`🔄 [gameApi] Calling endPhase for gameId: ${gameId}`);
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/end-phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(
          `❌ [gameApi] endPhase failed: ${res.status} ${res.statusText}`,
          errorText
        );
        throw new Error(`endPhase failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      console.log(`✅ [gameApi] endPhase response:`, data);
      return data;
    } catch (error) {
      console.error(`❌ [gameApi] endPhase error:`, error);
      throw error;
    }
  },

  /**
   * Kick/remove a player from the game (moderator action - lobby only)
   */
  async kickPlayer(gameId, playerId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/player/${playerId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to kick player");
    }

    return res.json();
  },

  /**
   * Update player avatar (lobby only)
   */
  async updatePlayerAvatar(gameId, playerId, avatar) {
    const res = await fetch(
      `${API_BASE}/game/${gameId}/player/${playerId}/avatar`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar }),
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update avatar");
    }

    return res.json();
  },

  /**
   * Get list of available avatars
   * @param {string} gameId - Optional gameId to filter out already-used avatars
   */
  async getAvailableAvatars(gameId = null) {
    const url = new URL(`${API_BASE}/game/avatars/available`);
    if (gameId) {
      url.searchParams.set("gameId", gameId);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to get available avatars");
    }

    return res.json();
  },

  /**
   * Subscribe to real-time game state updates via Server-Sent Events
   * @param {string} gameId - Game ID
   * @param {function} onUpdate - Callback function called when game state updates
   * @param {function} onError - Optional callback function called when connection errors occur
   * @returns {function} - Unsubscribe function
   */
  subscribeToGameState(gameId, onUpdate, onError) {
    const eventSource = new EventSource(`${API_BASE}/game/${gameId}/stream`);
    let hasReceivedInitialData = false;
    let errorTimeout = null;
    let connectionLostTimeout = null;
    let consecutiveErrors = 0;
    let hasNotifiedConsecutiveErrors = false; // Flag to prevent multiple onError calls
    const MAX_CONSECUTIVE_ERRORS = 3;
    const CONNECTION_LOST_TIMEOUT = 10000; // 10 seconds

    eventSource.onmessage = (event) => {
      try {
        // Skip keepalive messages
        if (event.data.trim() === ": keepalive") {
          return;
        }

        hasReceivedInitialData = true;
        consecutiveErrors = 0; // Reset error count on successful message
        hasNotifiedConsecutiveErrors = false; // Reset notification flag on successful message

        if (errorTimeout) {
          clearTimeout(errorTimeout);
          errorTimeout = null;
        }
        if (connectionLostTimeout) {
          clearTimeout(connectionLostTimeout);
          connectionLostTimeout = null;
        }

        const gameState = JSON.parse(event.data);
        console.log("📥 [gameApi] Received SSE message:", {
          phase: gameState?.game?.phase,
          players: gameState?.players?.length,
          playerAvatars: gameState?.players?.map((p) => ({
            name: p.name,
            avatar: p.avatar || "MISSING",
          })),
        });
        console.log("📥 [gameApi] Calling onUpdate callback...");
        if (onUpdate) {
          onUpdate(gameState);
          console.log("📥 [gameApi] onUpdate callback called");
        } else {
          console.warn("⚠️ [gameApi] onUpdate callback is not defined!");
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
        if (onError) {
          onError(new Error(`Failed to parse SSE message: ${err.message}`));
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      consecutiveErrors++;

      // If connection is closed and we never received initial data, it's likely a 404 or other error
      if (
        eventSource.readyState === EventSource.CLOSED &&
        !hasReceivedInitialData
      ) {
        // Wait a bit to see if it's just a temporary connection issue
        if (!errorTimeout) {
          errorTimeout = setTimeout(() => {
            if (!hasReceivedInitialData) {
              console.error("SSE connection failed - game may not exist");
              if (onError) {
                onError(new Error("Game not found or connection failed"));
              }
            }
          }, 2000); // Wait 2 seconds before reporting error
        }
      } else if (
        eventSource.readyState === EventSource.CLOSED &&
        hasReceivedInitialData
      ) {
        // Connection was closed after receiving data - might be reconnecting
        console.warn("SSE connection closed, attempting to reconnect...");

        // If connection stays closed for too long, notify the error handler
        if (!connectionLostTimeout) {
          connectionLostTimeout = setTimeout(() => {
            if (eventSource.readyState === EventSource.CLOSED) {
              console.error("SSE connection lost and failed to reconnect");
              if (onError) {
                onError(new Error("Connection lost and failed to reconnect"));
              }
            }
          }, CONNECTION_LOST_TIMEOUT);
        }
      } else if (
        eventSource.readyState === EventSource.CONNECTING &&
        hasReceivedInitialData
      ) {
        // Connection is reconnecting after receiving data
        // If we have too many consecutive errors, notify the error handler (only once)
        if (
          consecutiveErrors >= MAX_CONSECUTIVE_ERRORS &&
          !hasNotifiedConsecutiveErrors
        ) {
          console.error("SSE connection has too many consecutive errors");
          hasNotifiedConsecutiveErrors = true; // Prevent multiple notifications
          if (onError) {
            onError(new Error("Connection unstable - too many errors"));
          }
        }
      }
    };

    // Return unsubscribe function
    return () => {
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
      if (connectionLostTimeout) {
        clearTimeout(connectionLostTimeout);
      }
      eventSource.close();
    };
  },
};

// Export as default too for convenience
export default gameApi;
