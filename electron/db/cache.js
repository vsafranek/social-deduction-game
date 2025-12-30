// electron/db/cache.js
// Simple in-memory cache with TTL and invalidation support

class CacheEntry {
  constructor(data, ttl) {
    this.data = data;
    this.expiresAt = Date.now() + ttl;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }
}

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.isExpired()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = 1000) {
    this.cache.set(key, new CacheEntry(value, ttl));
  }

  /**
   * Delete specific key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  deletePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific game
   * @param {string} gameId - Game ID to invalidate
   */
  invalidateGame(gameId) {
    // Invalidate all cache entries related to this game
    this.deletePattern(`^game:${gameId}:`);
    this.delete(`game:${gameId}`);
    this.delete(`gameState:${gameId}`);
    this.delete(`players:${gameId}`);
    this.delete(`logs:${gameId}`);
  }

  /**
   * Invalidate cache for a specific player
   * @param {string} playerId - Player ID to invalidate
   */
  invalidatePlayer(playerId) {
    this.delete(`player:${playerId}`);
  }

  /**
   * Start automatic cleanup of expired entries
   */
  startCleanup(intervalMs = 60000) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove all expired entries
   */
  cleanup() {
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let expired = 0;
    let active = 0;
    for (const entry of this.cache.values()) {
      if (entry.isExpired()) {
        expired++;
      } else {
        active++;
      }
    }
    return {
      total: this.cache.size,
      active,
      expired,
    };
  }
}

// Singleton instance
const cache = new SimpleCache();

// Special marker to distinguish "cached null value" from "key not in cache"
const NULL_MARKER = Symbol('NULL_MARKER');

// Helper functions for common cache operations
const cacheHelpers = {
  NULL_MARKER,
  
  /**
   * Cache key generators
   */
  keys: {
    game: (gameId) => `game:${gameId}`,
    gameState: (gameId) => `gameState:${gameId}`,
    players: (gameId) => `players:${gameId}`,
    player: (playerId) => `player:${playerId}`,
    logs: (gameId) => `logs:${gameId}`,
    gameByRoomCode: (roomCode) => `gameByRoomCode:${roomCode}`,
  },

  /**
   * Get cached game or fetch and cache
   */
  async getOrFetchGame(gameId, fetchFn, ttl = 1000) {
    const key = cacheHelpers.keys.game(gameId);
    const cached = cache.get(key);
    if (cached !== null) {
      // If cached is a special marker, return null; otherwise return cached value
      if (cached === cacheHelpers.NULL_MARKER) {
        return null;
      }
      return cached;
    }
    
    const data = await fetchFn();
    // Cache the result, even if it's null (use special marker to distinguish from "key not in cache")
    const valueToCache = data === null ? cacheHelpers.NULL_MARKER : data;
    cache.set(key, valueToCache, ttl);
    return data;
  },

  /**
   * Get cached players or fetch and cache
   */
  async getOrFetchPlayers(gameId, fetchFn, ttl = 1000) {
    const key = cacheHelpers.keys.players(gameId);
    const cached = cache.get(key);
    if (cached !== null) {
      // If cached is a special marker, return null; otherwise return cached value
      if (cached === cacheHelpers.NULL_MARKER) {
        return null;
      }
      return cached;
    }
    
    const data = await fetchFn();
    // Cache the result, even if it's null or empty array (use special marker for null)
    // Note: empty arrays are truthy, so they will be cached normally
    const valueToCache = data === null ? cacheHelpers.NULL_MARKER : data;
    cache.set(key, valueToCache, ttl);
    return data;
  },

  /**
   * Get cached game state or fetch and cache
   */
  async getOrFetchGameState(gameId, fetchFn, ttl = 1000) {
    const key = cacheHelpers.keys.gameState(gameId);
    const cached = cache.get(key);
    if (cached !== null) {
      // If cached is a special marker, return null; otherwise return cached value
      if (cached === cacheHelpers.NULL_MARKER) {
        return null;
      }
      return cached;
    }
    
    const data = await fetchFn();
    // Cache the result, even if it's null (use special marker to distinguish from "key not in cache")
    // Note: gameState is typically an object { game, players, logs }, but we handle null for consistency
    const valueToCache = data === null ? cacheHelpers.NULL_MARKER : data;
    cache.set(key, valueToCache, ttl);
    return data;
  },

  /**
   * Get cached player or fetch and cache
   */
  async getOrFetchPlayer(playerId, fetchFn, ttl = 1000) {
    const key = cacheHelpers.keys.player(playerId);
    const cached = cache.get(key);
    if (cached !== null) {
      // If cached is a special marker, return null; otherwise return cached value
      if (cached === cacheHelpers.NULL_MARKER) {
        return null;
      }
      return cached;
    }
    
    const data = await fetchFn();
    // Cache the result, even if it's null (use special marker to distinguish from "key not in cache")
    const valueToCache = data === null ? cacheHelpers.NULL_MARKER : data;
    cache.set(key, valueToCache, ttl);
    return data;
  },
};

module.exports = {
  cache,
  cacheHelpers,
};

