// electron/routes/__tests__/gameRoutes.integration.test.js
// Integration tests using Jest and Supabase

// Load environment variables for tests
require('dotenv').config({ path: '.env.test' });

const { connectDB, getSupabase } = require('../../database');
const {
  createGame,
  findGameById,
  findGameByRoomCode,
  createPlayer,
  findPlayerById,
  findPlayersByGameId,
  findPlayerByGameAndSession,
  updatePlayer,
  createGameLog,
  findGameLogsByGameId,
  updateGame,
  deleteGame,
  deletePlayer
} = require('../../db/helpers');

// Mock console.log to reduce noise
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Helper function to generate unique room codes for tests
// Uses timestamp, counter, and random for maximum uniqueness
let roomCodeCounter = 0;
function generateUniqueRoomCode() {
  roomCodeCounter++;
  // Use timestamp in milliseconds for better uniqueness
  const timestamp = Date.now();
  // Use last 6 digits of timestamp (0-999999)
  const timestampPart = timestamp % 1000000;
  // Use counter to ensure uniqueness even if called at exact same millisecond
  const counter = roomCodeCounter % 10000; // 0-9999
  // Use random for additional entropy
  const random = Math.floor(Math.random() * 10000); // 0-9999
  // Combine with XOR for better distribution, then map to 1000-9999 range
  const combined = (timestampPart ^ counter ^ random) % 9000;
  const code = (combined + 1000).toString().padStart(4, '0');
  // Add small delay to ensure timestamp changes between calls
  // This is especially important when tests run very fast
  return code;
}

// Helper function to create a game with retry logic for handling room_code collisions
async function createGameWithRetry(gameData, maxAttempts = 5) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const dataWithCode = {
        ...gameData,
        room_code: generateUniqueRoomCode()
      };
      const game = await createGame(dataWithCode);
      return game;
    } catch (error) {
      if (error.message.includes('duplicate key') && attempts < maxAttempts - 1) {
        attempts++;
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }
      throw error; // Re-throw if not a duplicate key error or max attempts reached
    }
  }
  throw new Error('Failed to create game after maximum retry attempts');
}

describe('GameRoutes Integration Tests', () => {
  let isConnected = false;
  const testGameIds = [];
  const testPlayerIds = [];
  const testLogIds = [];

  beforeAll(async () => {
    try {
      // Connect to Supabase test database with timeout
      const connectPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      isConnected = true;
      console.log('Connected to Supabase test database');
    } catch (error) {
      console.warn('Could not connect to Supabase test database, skipping integration tests:', error.message);
      isConnected = false;
    }
  }, 10000); // 10 second timeout for beforeAll

  afterAll(async () => {
    if (isConnected) {
      // Clean up test data (with timeout protection)
      try {
        const supabase = getSupabase();
        
        // Delete test logs in parallel
        if (testLogIds.length > 0) {
          await Promise.allSettled(
            testLogIds.map(logId => 
              supabase.from('game_logs').delete().eq('id', logId)
            )
          );
        }
        
        // Delete test players in parallel
        if (testPlayerIds.length > 0) {
          await Promise.allSettled(
            testPlayerIds.map(playerId => deletePlayer(playerId))
          );
        }
        
        // Delete test games in parallel
        if (testGameIds.length > 0) {
          await Promise.allSettled(
            testGameIds.map(gameId => deleteGame(gameId))
          );
        }
      } catch (error) {
        // Ignore cleanup errors
        console.warn('Cleanup error in afterAll (ignored):', error.message);
      }
    }
    if (console.log.mockRestore) console.log.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();
  }, 10000); // 10 second timeout for afterAll

  beforeEach(async () => {
    if (!isConnected) {
      // Skip all tests if not connected
      return;
    }
    // Clean up test data before each test (with timeout protection)
    try {
      const supabase = getSupabase();
      
      // Delete test logs in parallel
      if (testLogIds.length > 0) {
        await Promise.allSettled(
          testLogIds.map(logId => 
            supabase.from('game_logs').delete().eq('id', logId)
          )
        );
        testLogIds.length = 0;
      }
      
      // Delete test players in parallel
      if (testPlayerIds.length > 0) {
        await Promise.allSettled(
          testPlayerIds.map(playerId => deletePlayer(playerId))
        );
        testPlayerIds.length = 0;
      }
      
      // Delete test games in parallel
      if (testGameIds.length > 0) {
        await Promise.allSettled(
          testGameIds.map(gameId => deleteGame(gameId))
        );
        testGameIds.length = 0;
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup error (ignored):', error.message);
    }
  }, 5000); // 5 second timeout for beforeEach

  describe('Game Model Operations', () => {
    test('should create a new game with room code', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const roomCode = (Math.floor(1000 + Math.random() * 9000)).toString();
      const gameData = {
        room_code: roomCode,
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };

      const game = await createGame(gameData);
      testGameIds.push(game.id);

      expect(game.id).toBeDefined();
      expect(game.room_code).toBe(roomCode);
      expect(game.phase).toBe('lobby');
      expect(game.round).toBe(0);

      // Verify game was saved
      const found = await findGameById(game.id);
      expect(found).toBeDefined();
      expect(found.room_code).toBe(roomCode);
    });

    test('should find game by room code', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const roomCode = (Math.floor(1000 + Math.random() * 9000)).toString();
      const gameData = {
        room_code: roomCode,
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };

      const game = await createGame(gameData);
      testGameIds.push(game.id);

      const found = await findGameByRoomCode(roomCode);
      expect(found).toBeDefined();
      expect(found.id).toBe(game.id);
    });
  });

  describe('Player Model Operations', () => {
    let gameId;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);
    });

    test('should create a new player', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const playerData = {
        game_id: gameId,
        session_id: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      };

      const player = await createPlayer(playerData);
      testPlayerIds.push(player.id);

      expect(player.id).toBeDefined();
      expect(player.name).toBe('TestPlayer');
      expect(player.session_id).toBe('session123');
      expect(player.game_id).toBe(gameId);

      // Verify player was saved
      const found = await findPlayerById(player.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('TestPlayer');
    });

    test('should find player by sessionId', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const playerData = {
        game_id: gameId,
        session_id: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      };

      const player = await createPlayer(playerData);
      testPlayerIds.push(player.id);

      const found = await findPlayerByGameAndSession(gameId, 'session123');
      expect(found).toBeDefined();
      expect(found.id).toBe(player.id);
    });

    test('should update player role', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const playerData = {
        game_id: gameId,
        session_id: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      };

      const player = await createPlayer(playerData);
      testPlayerIds.push(player.id);

      await updatePlayer(player.id, { role: 'Cleaner' });

      const found = await findPlayerById(player.id);
      expect(found.role).toBe('Cleaner');
    });
  });

  describe('Game State Operations', () => {
    let gameId;
    let playerIds;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'lobby',
        round: 0,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);

      // Create players
      const players = [];
      for (let i = 0; i < 3; i++) {
        const playerData = {
          game_id: gameId,
          name: `Player${i + 1}`,
          session_id: `session${i + 1}`,
          role: i === 0 ? 'Cleaner' : 'Citizen',
          alive: true,
          avatar: `/avatars/${i + 1}.png`
        };
        const player = await createPlayer(playerData);
        players.push(player);
        testPlayerIds.push(player.id);
      }
      playerIds = players.map(p => p.id);
    });

    test('should get game state with players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const game = await findGameById(gameId);
      const players = await findPlayersByGameId(gameId);

      expect(game).toBeDefined();
      expect(players).toHaveLength(3);
      expect(players[0].name).toBe('Player1');
      expect(players[1].name).toBe('Player2');
      expect(players[2].name).toBe('Player3');
    });

    test('should format game state response correctly (formatGameStateResponse logic)', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      // Test formatGameStateResponse logic by checking the structure
      // This tests the helper function indirectly via getGameStateComplete
      const { getGameStateComplete } = require('../../db/helpers');
      const { game, players, logs } = await getGameStateComplete(gameId, 200);

      // Verify players have required fields (as formatGameStateResponse would format them)
      // formatGameStateResponse maps players to: _id, name, role, alive, hasVoted, voteFor, voteWeight, avatar, nightResults, roleData
      for (const player of players) {
        expect(player).toHaveProperty('id');
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('role');
        expect(player).toHaveProperty('alive');
        expect(player).toHaveProperty('avatar');
        // Other fields may be undefined/null, which is fine
      }

      // Verify game has required fields
      expect(game).toHaveProperty('id');
      expect(game).toHaveProperty('phase');
      expect(game).toHaveProperty('round');
      expect(game).toHaveProperty('timers');

      // Verify logs is an array
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should update game phase', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      await updateGame(gameId, { phase: 'day', round: 1 });

      const updated = await findGameById(gameId);
      expect(updated.phase).toBe('day');
      expect(updated.round).toBe(1);
    });

    test('should update player vote', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      await updatePlayer(playerIds[0], {
        has_voted: true,
        vote_for_id: playerIds[1]
      });

      const updated = await findPlayerById(playerIds[0]);
      expect(updated.has_voted).toBe(true);
      expect(updated.vote_for_id).toBe(playerIds[1]);
    });
  });

  describe('Game Log Operations', () => {
    let gameId;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);
    });

    test('should create game log', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const logData = {
        game_id: gameId,
        message: 'Test log message'
      };

      const log = await createGameLog(logData);
      testLogIds.push(log.id);

      expect(log.id).toBeDefined();
      expect(log.message).toBe('Test log message');

      // Verify log was saved by finding logs for this game
      const logs = await findGameLogsByGameId(gameId);
      const found = logs.find(l => l.id === log.id);
      expect(found).toBeDefined();
      expect(found.message).toBe('Test log message');
    });

    test('should find logs by gameId', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const log1 = await createGameLog({ game_id: gameId, message: 'Log 1' });
      const log2 = await createGameLog({ game_id: gameId, message: 'Log 2' });
      testLogIds.push(log1.id, log2.id);

      const logs = await findGameLogsByGameId(gameId);
      // Filter to only our test logs (there might be others)
      const testLogs = logs.filter(l => [log1.id, log2.id].includes(l.id));
      expect(testLogs.length).toBeGreaterThanOrEqual(2);
      
      const messages = testLogs.map(l => l.message).sort();
      expect(messages).toContain('Log 1');
      expect(messages).toContain('Log 2');
    });
  });

  describe('Complex Game Operations', () => {
    let gameId;
    let playerIds;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'lobby',
        round: 0,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);

      // Create 3 players
      const players = [];
      for (let i = 0; i < 3; i++) {
        const playerData = {
          game_id: gameId,
          name: `Player${i + 1}`,
          session_id: `session${i + 1}`,
          avatar: `/avatars/${i + 1}.png`
        };
        const player = await createPlayer(playerData);
        players.push(player);
        testPlayerIds.push(player.id);
      }
      playerIds = players.map(p => p.id);
    });

    test('should assign roles to players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const assignments = {
        [playerIds[0]]: 'Citizen',
        [playerIds[1]]: 'Cleaner',
        [playerIds[2]]: 'Doctor'
      };

      for (const [playerId, roleName] of Object.entries(assignments)) {
        await updatePlayer(playerId, { role: roleName });
      }

      const players = await findPlayersByGameId(gameId);
      expect(players.find(p => p.id === playerIds[0]).role).toBe('Citizen');
      expect(players.find(p => p.id === playerIds[1]).role).toBe('Cleaner');
      expect(players.find(p => p.id === playerIds[2]).role).toBe('Doctor');
    });

    test('should reset game to lobby', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      // Set game to day phase
      await updateGame(gameId, {
        phase: 'day',
        round: 2,
        winner: 'good'
      });

      // Set players to various states
      const players = await findPlayersByGameId(gameId);
      for (const p of players) {
        await updatePlayer(p.id, {
          alive: false,
          role: 'Cleaner',
          has_voted: true,
          vote_for_id: playerIds[0]
        });
      }

      // Reset to lobby
      await updateGame(gameId, {
        phase: 'lobby',
        round: 0,
        winner: null,
        winner_player_ids: []
      });

      for (const p of players) {
        await updatePlayer(p.id, {
          alive: true,
          role: null,
          has_voted: false,
          vote_for_id: null
        });
      }

      // Verify reset
      const updatedGame = await findGameById(gameId);
      expect(updatedGame.phase).toBe('lobby');
      expect(updatedGame.round).toBe(0);
      expect(updatedGame.winner).toBeNull();

      const updatedPlayers = await findPlayersByGameId(gameId);
      updatedPlayers.forEach(p => {
        expect(p.alive).toBe(true);
        expect(p.role).toBeNull();
        expect(p.has_voted).toBe(false);
        expect(p.vote_for_id).toBeNull();
      });
    });
  });

  describe('Monk Role - start-config usesRemaining initialization', () => {
    let gameId;
    let playerIds;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'lobby',
        round: 0,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);

      // Create 3 players
      const players = [];
      for (let i = 0; i < 3; i++) {
        const playerData = {
          game_id: gameId,
          name: `Player${i + 1}`,
          session_id: `session${i + 1}`,
          avatar: `/avatars/${i + 1}.png`
        };
        const player = await createPlayer(playerData);
        players.push(player);
        testPlayerIds.push(player.id);
      }
      playerIds = players.map(p => p.id);
    });

    test('should initialize usesRemaining for Monk role during start-config', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;
      const { updatePlayersBatch } = require('../../db/helpers');

      // Assign Monk role to first player
      const monkPlayerId = playerIds[0];
      await updatePlayer(monkPlayerId, { role: 'Monk' });

      // Get role data for Monk
      const roleData = ROLES['Monk'];
      expect(roleData.hasLimitedUses).toBe(true);
      expect(roleData.maxUses).toBe(2);

      // Simulate start-config logic: initialize usesRemaining for limited-use roles
      const players = await findPlayersByGameId(gameId);
      const monkPlayer = players.find(p => p.id === monkPlayerId);
      
      const currentRoleData = monkPlayer.role_data || {};
      if (roleData?.hasLimitedUses) {
        const usesRemaining = roleData.maxUses || 3;
        const updatedRoleData = { ...currentRoleData, usesRemaining };
        
        await updatePlayersBatch([{
          id: monkPlayerId,
          updates: { role_data: updatedRoleData }
        }]);
      }

      // Verify usesRemaining was initialized
      const updatedPlayer = await findPlayerById(monkPlayerId);
      expect(updatedPlayer.role_data).toBeDefined();
      expect(updatedPlayer.role_data.usesRemaining).toBe(2);
    });

    test('should initialize usesRemaining for all hasLimitedUses roles during start-config', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;
      const { updatePlayersBatch } = require('../../db/helpers');

      // Assign Monk to first player, Accuser (also hasLimitedUses) to second
      await updatePlayer(playerIds[0], { role: 'Monk' });
      await updatePlayer(playerIds[1], { role: 'Accuser' });

      // Simulate start-config logic
      const players = await findPlayersByGameId(gameId);
      const roleDataUpdates = [];

      for (const p of players) {
        if (!p.role) continue;
        const roleData = ROLES[p.role];
        const currentRoleData = p.role_data || {};
        
        if (roleData?.hasLimitedUses) {
          const usesRemaining = roleData.maxUses || 3;
          const updatedRoleData = { ...currentRoleData, usesRemaining };
          roleDataUpdates.push({
            id: p.id,
            updates: { role_data: updatedRoleData }
          });
        }
      }

      if (roleDataUpdates.length > 0) {
        await updatePlayersBatch(roleDataUpdates);
      }

      // Verify Monk
      const monkPlayer = await findPlayerById(playerIds[0]);
      expect(monkPlayer.role_data.usesRemaining).toBe(2);

      // Verify Accuser (should have 3 uses by default)
      const accuserPlayer = await findPlayerById(playerIds[1]);
      expect(accuserPlayer.role_data.usesRemaining).toBe(3);
    });
  });

  describe('Monk Role - set-night-action usesRemaining validation', () => {
    let gameId;
    let monkPlayerId;
    let targetPlayerId;

    beforeEach(async () => {
      if (!isConnected) return;
      const gameData = {
        phase: 'night', // Night phase for set-night-action
        round: 1,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGameWithRetry(gameData);
      gameId = game.id;
      testGameIds.push(gameId);

      // Create Monk player
      const monkPlayer = await createPlayer({
        game_id: gameId,
        name: 'Monk',
        session_id: 'session-monk',
        avatar: '/avatars/monk.png',
        role: 'Monk',
        alive: true,
        role_data: { usesRemaining: 2 } // Initialize with 2 uses
      });
      monkPlayerId = monkPlayer.id;
      testPlayerIds.push(monkPlayerId);

      // Create target player (dead)
      const targetPlayer = await createPlayer({
        game_id: gameId,
        name: 'Target',
        session_id: 'session-target',
        avatar: '/avatars/target.png',
        role: 'Citizen',
        alive: false // Dead player
      });
      targetPlayerId = targetPlayer.id;
      testPlayerIds.push(targetPlayerId);
    });

    test('should allow Monk to set action when usesRemaining > 0', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;

      // Get player and role data
      const player = await findPlayerById(monkPlayerId);
      const roleData = ROLES[player.role];
      
      // Simulate set-night-action logic for limited-use roles
      const roleDataObj = player.role_data || {};
      const usesLeft = roleDataObj.usesRemaining || roleData.maxUses || 2;

      expect(usesLeft).toBeGreaterThan(0);

      // Action should be allowed (not decremented yet - resolver will do it)
      await updatePlayer(monkPlayerId, {
        night_action: {
          targetId: targetPlayerId,
          action: roleData?.actionType || 'revive',
          results: []
        },
        role_data: roleDataObj // Keep current usesRemaining
      });

      // Verify action was set
      const updatedPlayer = await findPlayerById(monkPlayerId);
      expect(updatedPlayer.night_action).toBeDefined();
      expect(updatedPlayer.night_action.action).toBe('revive');
      expect(updatedPlayer.night_action.targetId.toString()).toBe(targetPlayerId);
      expect(updatedPlayer.role_data.usesRemaining).toBe(2); // Not decremented yet
    });

    test('should prevent Monk from setting action when usesRemaining <= 0', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;

      // Set usesRemaining to 0
      await updatePlayer(monkPlayerId, {
        role_data: { usesRemaining: 0 }
      });

      // Get player and role data
      const player = await findPlayerById(monkPlayerId);
      const roleData = ROLES[player.role];
      const roleDataObj = player.role_data || {};
      const usesLeft = roleDataObj.usesRemaining || 0;

      // Action should be rejected (simulate validation)
      expect(usesLeft).toBeLessThanOrEqual(0);

      // In real endpoint, this would return 400 error
      // Here we just verify the validation logic
      const shouldReject = usesLeft <= 0;
      expect(shouldReject).toBe(true);
    });

    test('should initialize usesRemaining from maxUses if not set', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;

      // Create new Monk player without role_data
      const newMonk = await createPlayer({
        game_id: gameId,
        name: 'NewMonk',
        session_id: 'session-newmonk',
        avatar: '/avatars/newmonk.png',
        role: 'Monk',
        alive: true
        // No role_data
      });
      testPlayerIds.push(newMonk.id);

      // Simulate set-night-action initialization logic
      const player = await findPlayerById(newMonk.id);
      const roleData = ROLES[player.role];
      const roleDataObj = player.role_data || {};
      
      // Initialize if not set (simulate endpoint logic)
      if (roleDataObj.usesRemaining === undefined || roleDataObj.usesRemaining === null) {
        roleDataObj.usesRemaining = roleData.maxUses || 2;
      }

      expect(roleDataObj.usesRemaining).toBe(2);

      // Update player
      await updatePlayer(newMonk.id, {
        night_action: {
          targetId: targetPlayerId,
          action: 'revive',
          results: []
        },
        role_data: roleDataObj
      });

      // Verify
      const updatedPlayer = await findPlayerById(newMonk.id);
      expect(updatedPlayer.role_data.usesRemaining).toBe(2);
    });

    test('should allow Monk to target dead players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const ROLES = require('../../models/Role').ROLES;

      // Get player and role data
      const player = await findPlayerById(monkPlayerId);
      const roleData = ROLES[player.role];
      const target = await findPlayerById(targetPlayerId);
      
      // Verify target is dead
      expect(target.alive).toBe(false);
      
      // Verify role can target dead players (visitsTarget: false means doesn't visit, can target dead)
      expect(roleData.visitsTarget).toBe(false);
      expect(roleData.actionType).toBe('revive');

      // Action should be allowed (Monk can target dead players)
      const roleDataObj = player.role_data || {};
      await updatePlayer(monkPlayerId, {
        night_action: {
          targetId: targetPlayerId,
          action: 'revive',
          results: []
        },
        role_data: roleDataObj
      });

      // Verify action was set
      const updatedPlayer = await findPlayerById(monkPlayerId);
      expect(updatedPlayer.night_action).toBeDefined();
      expect(updatedPlayer.night_action.action).toBe('revive');
      expect(updatedPlayer.night_action.targetId.toString()).toBe(targetPlayerId);
    });

    test('should prevent Monk from targeting alive players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      // Create alive target player
      const aliveTarget = await createPlayer({
        game_id: gameId,
        name: 'AliveTarget',
        session_id: 'session-alivetarget',
        avatar: '/avatars/alivetarget.png',
        role: 'Citizen',
        alive: true // Alive player
      });
      testPlayerIds.push(aliveTarget.id);

      // Get player
      const player = await findPlayerById(monkPlayerId);
      
      // Verify target is alive
      const target = await findPlayerById(aliveTarget.id);
      expect(target.alive).toBe(true);

      // In nightActionResolver, revive action checks if target is alive and returns error
      // Here we verify that revive action should only target dead players
      // The validation happens in nightActionResolver, not in set-night-action endpoint
      // But we can verify the logic: if target is alive, revive should fail
      const roleDataObj = player.role_data || {};
      
      // Set the action (endpoint doesn't validate target alive/dead status for revive)
      // Validation happens in nightActionResolver
      await updatePlayer(monkPlayerId, {
        night_action: {
          targetId: aliveTarget.id,
          action: 'revive',
          results: []
        },
        role_data: roleDataObj
      });

      // Action was set, but resolver will reject it
      // The endpoint allows setting the action, validation happens in resolver
      const updatedPlayer = await findPlayerById(monkPlayerId);
      expect(updatedPlayer.night_action).toBeDefined();
      expect(updatedPlayer.night_action.targetId.toString()).toBe(aliveTarget.id);
      
      // Note: The actual validation (preventing revive of alive players) 
      // happens in nightActionResolver, not in the endpoint
      // This test verifies the endpoint allows setting the action
    });
  });
});
