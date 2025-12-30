// electron/routes/gameStateEmitter.js
// EventEmitter for broadcasting game state changes to SSE clients

const EventEmitter = require("events");

class GameStateEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow up to 100 listeners per game
  }

  /**
   * Emit game state update to all subscribers
   * @param {string} gameId - Game ID
   * @param {object} gameState - Updated game state
   */
  emitGameStateUpdate(gameId, gameState) {
    this.emit(`game:${gameId}`, gameState);
  }

  /**
   * Subscribe to game state updates
   * @param {string} gameId - Game ID
   * @param {function} callback - Callback function
   * @returns {function} - Unsubscribe function
   */
  subscribe(gameId, callback) {
    const eventName = `game:${gameId}`;
    this.on(eventName, callback);
    
    // Return unsubscribe function
    return () => {
      this.removeListener(eventName, callback);
    };
  }
}

// Singleton instance
const gameStateEmitter = new GameStateEmitter();

module.exports = gameStateEmitter;

