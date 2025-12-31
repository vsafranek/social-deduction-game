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
        room_code: '1234',
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };
      const game = await createGame(gameData);
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
        room_code: '1234',
        phase: 'lobby',
        round: 0,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGame(gameData);
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
        room_code: '1234',
        phase: 'lobby',
        round: 0,
        timer_state: { phase_ends_at: null }
      };
      const game = await createGame(gameData);
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
        room_code: '1234',
        phase: 'lobby',
        round: 0,
        timers: { night_seconds: 90, day_seconds: 150 },
        timer_state: { phase_ends_at: null }
      };
      const game = await createGame(gameData);
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
});
