const API_BASE = window.location.origin + '/api';

export const gameApi = {
  // Create game
  async createGame(ip, port) {
    const res = await fetch(`${API_BASE}/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    return res.json();
  },

  getGameState(gameId) {
    return fetch(`${API_BASE}/game/${gameId}/state`).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    });
  },

  // Join game by room code (unified endpoint)
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

  async tick(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/tick`, { method: 'POST' });
    return res.json();
  },

  async startGameWithConfig(gameId, finalRoleConfig, modifierConfig) {
    const res = await fetch(`${API_BASE}/game/${gameId}/start-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: finalRoleConfig,
        modifiers: modifierConfig
      })
    });
    return res.json();
  },

  async updateTimers(gameId, { nightSeconds, daySeconds }) {
    const res = await fetch(`${API_BASE}/game/${gameId}/timers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nightSeconds, daySeconds })
    });
    return res.json();
  },

  // Get player role
  async getPlayerRole(gameId, sessionId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/player/${sessionId}/role`);
    return res.json();
  },

  // Night action
  async nightAction(gameId, playerId, targetId, action) {
    const res = await fetch(`${API_BASE}/game/${gameId}/night-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetId, action })
    });
    return res.json();
  },

  // End night
  async endNight(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-night`, {
      method: 'POST'
    });
    return res.json();
  },

  // Vote
  async vote(gameId, playerId, targetId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetId })
    });
    return res.json();
  },

  // End day
  async endDay(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/end-day`, {
      method: 'POST'
    });
    return res.json();
  },
  async resetToLobby(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/reset-to-lobby`, {
      method: 'POST'
    });
    return res.json();
},
async endPhase(gameId) {
  const res = await fetch(`${API_BASE}/game/${gameId}/end-phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
},

//  Get player role by playerId 
async getPlayerRoleByPlayerId(gameId, playerId) {
  console.log('📖 Fetching role for player:', playerId);
  const res = await fetch(`${API_BASE}/game/${gameId}/player/${playerId}/role-by-id`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return res.json();
},

// Get player by sessionId
async getPlayerBySessionId(gameId, sessionId) {
  console.log('🔍 Fetching player by sessionId:', sessionId);
  const res = await fetch(`${API_BASE}/game/${gameId}/player-by-session/${sessionId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return res.json();
}
};

