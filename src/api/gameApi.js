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
  
  // Get game state
  async getGameState(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}`);
    return res.json();
  },
  
  // Join game
  async joinGame(gameId, playerName, sessionId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, sessionId })
    });
    return res.json();
  },

   // Join game by room code
  async joinGameByCode(roomCode, playerName, sessionId) {
    console.log('🚪 gameApi.joinGameByCode called with room:', roomCode);
    try {
      const res = await fetch(`${API_BASE}/game/join-by-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, playerName, sessionId })
      });
      
      const data = await res.json();
      console.log('Join response:', data);
      return data;
    } catch (error) {
      console.error('❌ joinGameByCode error:', error);
      throw error;
    }
  },
  async tick(gameId) {
    const res = await fetch(`/api/game/${gameId}/tick`, { method: 'POST' });
    return res.json();
  },

  
  // Start game
  async startGame(gameId) {
    const res = await fetch(`${API_BASE}/game/${gameId}/start`, {
      method: 'POST'
    });
    return res.json();
  },

  async startGameWithConfig(gameId, finalRoleConfig, modifierConfig) {
        // finalRoleConfig: { [playerId]: 'Doktor' }
        // modifierConfig: { opilýChance: number, poustevníkChance: number }
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
    const res = await fetch(`/api/game/${gameId}/timers`, {
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
  }
};
