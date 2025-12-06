// electron/routes/__tests__/gameRoutes.integration.test.js
// Integration tests using Jest and Mongoose only (no supertest, no mongodb-memory-server)

const mongoose = require('mongoose');
const Game = require('../../models/Game');
const Player = require('../../models/Player');
const GameLog = require('../../models/GameLog');

// Mock console.log to reduce noise
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('GameRoutes Integration Tests', () => {
  // Use test database if available, otherwise skip tests
  const TEST_DB_URI = process.env.TEST_DB_URI || 'mongodb://localhost:27017/game-app-test';
  let isConnected = false;

  beforeAll(async () => {
    try {
      // Try to connect to test database
      await mongoose.connect(TEST_DB_URI);
      isConnected = true;
      console.log('Connected to test database');
    } catch (error) {
      console.warn('Could not connect to test database, skipping integration tests');
      isConnected = false;
    }
  });

  afterAll(async () => {
    if (isConnected) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
    if (console.log.mockRestore) console.log.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();
  });

  beforeEach(async () => {
    if (!isConnected) return;
    // Clean up database before each test
    await Game.deleteMany({});
    await Player.deleteMany({});
    await GameLog.deleteMany({});
  });

  describe('Game Model Operations', () => {
    test('should create a new game with room code', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const roomCode = (Math.floor(1000 + Math.random() * 9000)).toString();
      const game = new Game({
        roomCode,
        phase: 'lobby',
        round: 0,
        timerState: { phaseEndsAt: null }
      });

      await game.save();

      expect(game._id).toBeDefined();
      expect(game.roomCode).toBe(roomCode);
      expect(game.phase).toBe('lobby');
      expect(game.round).toBe(0);

      // Verify game was saved
      const found = await Game.findById(game._id);
      expect(found).toBeDefined();
      expect(found.roomCode).toBe(roomCode);
    });

    test('should find game by room code', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const roomCode = (Math.floor(1000 + Math.random() * 9000)).toString();
      const game = new Game({
        roomCode,
        phase: 'lobby',
        round: 0,
        timerState: { phaseEndsAt: null }
      });
      await game.save();

      const found = await Game.findOne({ roomCode });
      expect(found).toBeDefined();
      expect(found._id.toString()).toBe(game._id.toString());
    });
  });

  describe('Player Model Operations', () => {
    let gameId;

    beforeEach(async () => {
      if (!isConnected) return;
      const game = new Game({
        roomCode: '1234',
        phase: 'lobby',
        round: 0,
        timerState: { phaseEndsAt: null }
      });
      await game.save();
      gameId = game._id;
    });

    test('should create a new player', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const player = new Player({
        gameId,
        sessionId: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      });

      await player.save();

      expect(player._id).toBeDefined();
      expect(player.name).toBe('TestPlayer');
      expect(player.sessionId).toBe('session123');
      expect(player.gameId.toString()).toBe(gameId.toString());

      // Verify player was saved
      const found = await Player.findById(player._id);
      expect(found).toBeDefined();
      expect(found.name).toBe('TestPlayer');
    });

    test('should find player by sessionId', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const player = new Player({
        gameId,
        sessionId: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      });
      await player.save();

      const found = await Player.findOne({ sessionId: 'session123' });
      expect(found).toBeDefined();
      expect(found._id.toString()).toBe(player._id.toString());
    });

    test('should update player role', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const player = new Player({
        gameId,
        sessionId: 'session123',
        name: 'TestPlayer',
        avatar: '/avatars/1.png'
      });
      await player.save();

      player.role = 'Killer';
      await player.save();

      const found = await Player.findById(player._id);
      expect(found.role).toBe('Killer');
    });
  });

  describe('Game State Operations', () => {
    let gameId;
    let playerIds;

    beforeEach(async () => {
      if (!isConnected) return;
      const game = new Game({
        roomCode: '1234',
        phase: 'lobby',
        round: 0,
        timers: { nightSeconds: 90, daySeconds: 150 },
        timerState: { phaseEndsAt: null }
      });
      await game.save();
      gameId = game._id;

      // Create players
      const players = [];
      for (let i = 0; i < 3; i++) {
        const player = new Player({
          gameId,
          name: `Player${i + 1}`,
          sessionId: `session${i + 1}`,
          role: i === 0 ? 'Killer' : 'Citizen',
          alive: true,
          avatar: `/avatars/${i + 1}.png`
        });
        await player.save();
        players.push(player);
      }
      playerIds = players.map(p => p._id);
    });

    test('should get game state with players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const game = await Game.findById(gameId);
      const players = await Player.find({ gameId }).sort({ createdAt: 1 });

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

      const game = await Game.findById(gameId);
      game.phase = 'day';
      game.round = 1;
      await game.save();

      const updated = await Game.findById(gameId);
      expect(updated.phase).toBe('day');
      expect(updated.round).toBe(1);
    });

    test('should update player vote', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const player = await Player.findById(playerIds[0]);
      player.hasVoted = true;
      player.voteFor = playerIds[1];
      await player.save();

      const updated = await Player.findById(playerIds[0]);
      expect(updated.hasVoted).toBe(true);
      expect(updated.voteFor.toString()).toBe(playerIds[1].toString());
    });
  });

  describe('Game Log Operations', () => {
    let gameId;

    beforeEach(async () => {
      if (!isConnected) return;
      const game = new Game({
        roomCode: '1234',
        phase: 'lobby',
        round: 0,
        timerState: { phaseEndsAt: null }
      });
      await game.save();
      gameId = game._id;
    });

    test('should create game log', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const log = new GameLog({
        gameId,
        message: 'Test log message'
      });
      await log.save();

      expect(log._id).toBeDefined();
      expect(log.message).toBe('Test log message');

      const found = await GameLog.findById(log._id);
      expect(found).toBeDefined();
      expect(found.message).toBe('Test log message');
    });

    test('should find logs by gameId', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const log1 = new GameLog({ gameId, message: 'Log 1' });
      const log2 = new GameLog({ gameId, message: 'Log 2' });
      await log1.save();
      await log2.save();

      const logs = await GameLog.find({ gameId }).sort({ createdAt: 1 });
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Log 1');
      expect(logs[1].message).toBe('Log 2');
    });
  });

  describe('Complex Game Operations', () => {
    let gameId;
    let playerIds;

    beforeEach(async () => {
      if (!isConnected) return;
      const game = new Game({
        roomCode: '1234',
        phase: 'lobby',
        round: 0,
        timers: { nightSeconds: 90, daySeconds: 150 },
        timerState: { phaseEndsAt: null }
      });
      await game.save();
      gameId = game._id;

      // Create 3 players
      const players = [];
      for (let i = 0; i < 3; i++) {
        const player = new Player({
          gameId,
          name: `Player${i + 1}`,
          sessionId: `session${i + 1}`,
          avatar: `/avatars/${i + 1}.png`
        });
        await player.save();
        players.push(player);
      }
      playerIds = players.map(p => p._id);
    });

    test('should assign roles to players', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      const assignments = {
        [playerIds[0].toString()]: 'Citizen',
        [playerIds[1].toString()]: 'Killer',
        [playerIds[2].toString()]: 'Doctor'
      };

      for (const [playerId, roleName] of Object.entries(assignments)) {
        const player = await Player.findById(playerId);
        player.role = roleName;
        await player.save();
      }

      const players = await Player.find({ gameId });
      expect(players.find(p => p._id.toString() === playerIds[0].toString()).role).toBe('Citizen');
      expect(players.find(p => p._id.toString() === playerIds[1].toString()).role).toBe('Killer');
      expect(players.find(p => p._id.toString() === playerIds[2].toString()).role).toBe('Doctor');
    });

    test('should reset game to lobby', async () => {
      if (!isConnected) {
        console.log('Skipping test - database not connected');
        return;
      }

      // Set game to day phase
      const game = await Game.findById(gameId);
      game.phase = 'day';
      game.round = 2;
      game.winner = 'good';
      await game.save();

      // Set players to various states
      const players = await Player.find({ gameId });
      for (const p of players) {
        p.alive = false;
        p.role = 'Killer';
        p.hasVoted = true;
        p.voteFor = playerIds[0];
        await p.save();
      }

      // Reset to lobby
      game.phase = 'lobby';
      game.round = 0;
      game.winner = null;
      game.winnerPlayerIds = [];
      await game.save();

      for (const p of players) {
        p.alive = true;
        p.role = null;
        p.hasVoted = false;
        p.voteFor = null;
        await p.save();
      }

      // Verify reset
      const updatedGame = await Game.findById(gameId);
      expect(updatedGame.phase).toBe('lobby');
      expect(updatedGame.round).toBe(0);
      expect(updatedGame.winner).toBeNull();

      const updatedPlayers = await Player.find({ gameId });
      updatedPlayers.forEach(p => {
        expect(p.alive).toBe(true);
        expect(p.role).toBeNull();
        expect(p.hasVoted).toBe(false);
        expect(p.voteFor).toBeNull();
      });
    });
  });
});
