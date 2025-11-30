// src/api/gameApi.js

const API_BASE = window.location.origin + '/api';

export const gameApi = {
  // ==================
  // GAME MANAGEMENT
  // ==================

  /**
   * Create new game
   */
  async createGame(ip, port) {
    const res = await fetch(`${API_BASE}/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    return res.json();
  },

  /**
   * Get current game state
   */
  getGameState(gameId) {
    return fetch(`${API_BASE}/game/${gameId}/state`).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    });
  },

  /**
   * Join game by room code (unified endpoint)
   */
  async joinGameByCode(roomCode, playerName, sessionId) {
    console.log('🚪 gameApi.joinGameByCode called with room:', roomCode);
    try {
      const res = await fetch(`${API_BASE}/game/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, name: playerName, sessionId })
      });

      const data = await res.json();
      console.log('Join response:', data);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      return data;
    } catch (error) {
      console.error('❌ joinGameByCode error:', error);
      throw error;
    }
  },

  /**
   * Start game with role and modifier configuration
   */
  async startGameWithConfig(gameId, finalRoleConfig, modifierConfig) {
    const res = await fetch(`${API_BASE}/game/${gameId}/start-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: finalRoleConfig,
        modifiers: modifierConfig
      })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to start game');
    }
    
    return res.json();
  },

  /**
   * Update game timers
   */
  async updateTimers(gameId, { nightSeconds, daySeconds }) {
    const res = await fetch(`${API_BASE}/game/${gameId}/timers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nightSeconds, daySeconds })
    });
    return res.json();
  },

  /**
   * Reset game to lobby
   */
  async resetToLobby(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/reset-to-lobby`, {
      method: 'POST'
    });
    return res.json();
  },

  /**
   * Tick game (for timer progression)
   */
  async tick(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/tick`, { 
      method: 'POST' 
    });
    return res.json();
  },

  // ==================
  // PLAYER QUERIES
  // ==================

  /**
   * Get player role by sessionId
   */
  async getPlayerRole(gameId, sessionId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/player/${sessionId}/role`);
    return res.json();
  },

  /**
   * Get player role by playerId
   */
  async getPlayerRoleByPlayerId(gameId, playerId) {
    console.log('📖 Fetching role for player:', playerId);
    const res = await fetch(`${API_BASE}/game/${gameId}/player/${playerId}/role-by-id`);
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return res.json();
  },

  /**
   * Get player by sessionId
   */
  async getPlayerBySessionId(gameId, sessionId) {
    console.log('🔍 Fetching player by sessionId:', sessionId);
    const res = await fetch(`${API_BASE}/game/${gameId}/player-by-session/${sessionId}`);
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return res.json();
  },

  // ==================
  // NIGHT PHASE
  // ==================

  /**
   * Set night action (NEW - with dual-action support)
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {string} targetId - Target player ID
   * @param {string|null} actionMode - Action mode for dual roles (kill, clean_role, frame, etc.)
   */
  async setNightAction(gameId, playerId, targetId, actionMode = null) {
    const body = { playerId, targetId };
    
    // Add actionMode if provided (for dual-action roles)
    if (actionMode) {
      body.actionMode = actionMode;
    }

    const res = await fetch(`${API_BASE}/game/${gameId}/set-night-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to set night action');
    }
    
    return res.json();
  },

  /**
   * Night action (LEGACY - backward compatible)
   * Use setNightAction instead for new code
   */
  async nightAction(gameId, playerId, targetId, action) {
    const res = await fetch(`${API_BASE}/game/${gameId}/night-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetId, action })
    });
    return res.json();
  },

  /**
   * End night phase (moderator action)
   */
  async endNight(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-night`, {
      method: 'POST'
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetId })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to vote');
    }
    
    return res.json();
  },

  /**
   * End day phase (moderator action)
   */
  async endDay(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-day`, {
      method: 'POST'
    });
    return res.json();
  },

  /**
   * End current phase (auto-detect day/night)
   */
  async endPhase(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },

  /**
   * Kick/remove a player from the game (moderator action - lobby only)
   */
  async kickPlayer(gameId, playerId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/player/${playerId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to kick player');
    }
    
    return res.json();
  }
};

// Export as default too for convenience
export default gameApi;
