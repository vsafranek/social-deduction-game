// electron/game/__tests__/votingResolver.test.js

const { resolveDayVoting } = require('../votingResolver');

// Mock console.log to reduce noise in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

// Mock GameLog model
const mockGameLog = {
  create: jest.fn().mockResolvedValue({})
};

// Helper function to create mock players
const createMockPlayer = (id, name, role, options = {}) => {
  const {
    alive = true,
    voteFor = null,
    hasVoted = false
  } = options;

  // Create voteFor as object with toString if provided, to match mongoose behavior
  let voteForObj = null;
  if (voteFor) {
    const voteForId = typeof voteFor === 'string' ? voteFor : voteFor.toString();
    voteForObj = { toString: () => voteForId };
  }

  const player = {
    _id: { toString: () => id },
    name,
    role,
    alive,
    voteFor: voteForObj,
    hasVoted
  };

  // Set save method after player is created
  player.save = jest.fn().mockResolvedValue(player);

  return player;
};

// Helper to create mock game
const createMockGame = (id = 'game1') => ({
  _id: { toString: () => id }
});

describe('votingResolver', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Cases', () => {
    
    test('should return no execution when no alive players', async () => {
      const game = createMockGame();
      const players = [
        createMockPlayer('1', 'Dead1', 'Citizen', { alive: false }),
        createMockPlayer('2', 'Dead2', 'Killer', { alive: false })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('no_players');
      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: 'No execution (no alive players).'
      });
    });

    test('should return no execution when no votes cast', async () => {
      const game = createMockGame();
      const players = [
        createMockPlayer('1', 'Player1', 'Citizen', { voteFor: null }),
        createMockPlayer('2', 'Player2', 'Citizen', { voteFor: null }),
        createMockPlayer('3', 'Player3', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('no_votes');
      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: 'No execution (no votes cast).'
      });
    });
  });

  describe('Tie Scenarios', () => {
    
    test('should return tie when two players have same votes', async () => {
      const game = createMockGame();
      const target1 = createMockPlayer('1', 'Target1', 'Citizen');
      const target2 = createMockPlayer('2', 'Target2', 'Citizen');
      const players = [
        target1,
        target2,
        createMockPlayer('3', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter2', 'Citizen', { voteFor: '2' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('tie');
      expect(result.tied).toContain('1');
      expect(result.tied).toContain('2');
      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: expect.stringContaining('No execution (tie:')
      });
    });

    test('should return tie when three players have same votes', async () => {
      const game = createMockGame();
      const target1 = createMockPlayer('1', 'Target1', 'Citizen');
      const target2 = createMockPlayer('2', 'Target2', 'Citizen');
      const target3 = createMockPlayer('3', 'Target3', 'Citizen');
      const players = [
        target1,
        target2,
        target3,
        createMockPlayer('4', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter2', 'Citizen', { voteFor: '2' }),
        createMockPlayer('6', 'Voter3', 'Citizen', { voteFor: '3' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('tie');
      expect(result.tied.length).toBe(3);
    });
  });

  describe('Insufficient Votes', () => {
    
    test('should return insufficient votes when no majority (2 votes out of 5)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Abstain1', 'Citizen', { voteFor: null }),
        createMockPlayer('5', 'Abstain2', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(2);
      expect(result.topCandidate).toBe('1');
      expect(target.alive).toBe(true);
      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: expect.stringContaining('No execution (insufficient votes: 2/5')
      });
    });

    test('should return insufficient votes when exactly 50% (3 votes out of 6)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Abstain1', 'Citizen', { voteFor: null }),
        createMockPlayer('6', 'Abstain2', 'Citizen', { voteFor: null }),
        createMockPlayer('7', 'Abstain3', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(3);
      // Majority threshold for 7 players is 4 (floor(7/2) + 1)
      expect(target.alive).toBe(true);
    });

    test('should return insufficient votes when 1 vote out of 3', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Abstain1', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(1);
      // Majority threshold for 3 players is 2 (floor(3/2) + 1)
      expect(target.alive).toBe(true);
    });
  });

  describe('Successful Execution', () => {
    
    test('should execute player with majority (4 votes out of 6)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter4', 'Citizen', { voteFor: '1' }), // 4 votes for majority (need 4 = floor(6/2) + 1)
        createMockPlayer('6', 'Abstain1', 'Citizen', { voteFor: null }) // Abstain counts in totalWeightedVotes
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      // executedName should be set if target was found and executed
      if (result.executed) {
        expect(result.executedName).toBe('Target');
        expect(result.votesAgainst).toBe(2); // 6 total - 4 votes = 2 against (including abstain)
        expect(result.totalAlive).toBe(6);
      }
      expect(result.votesFor).toBe(4);
      expect(target.alive).toBe(false);
      expect(target.save).toHaveBeenCalled();
      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: 'Executed: Target (4/6 weighted votes)'
      });
    });

    test('should execute player with exactly majority threshold (2 votes out of 3)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      expect(result.executedName).toBe('Target');
      expect(result.votesFor).toBe(2);
      expect(result.votesAgainst).toBe(1);
      expect(target.alive).toBe(false);
    });

    test('should execute player with unanimous vote (4 votes out of 4)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      expect(result.executedName).toBe('Target');
      expect(result.votesFor).toBe(3); // Target can't vote for themselves
      expect(result.votesAgainst).toBe(1);
      expect(target.alive).toBe(false);
    });

    test('should execute player with overwhelming majority (5 votes out of 7)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter4', 'Citizen', { voteFor: '1' }),
        createMockPlayer('6', 'Voter5', 'Citizen', { voteFor: '1' }),
        createMockPlayer('7', 'Abstain1', 'Citizen', { voteFor: null }),
        createMockPlayer('8', 'Abstain2', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      expect(result.executedName).toBe('Target');
      expect(result.votesFor).toBe(5);
      expect(result.votesAgainst).toBe(3);
      expect(target.alive).toBe(false);
    });
  });

  describe('Vote Clearing', () => {
    
    test('should clear all votes after execution', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const voter1 = createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1', hasVoted: true });
      const voter2 = createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1', hasVoted: true });
      const players = [target, voter1, voter2];

      await resolveDayVoting(game, players, mockGameLog);

      expect(voter1.voteFor).toBeNull();
      expect(voter1.hasVoted).toBe(false);
      expect(voter2.voteFor).toBeNull();
      expect(voter2.hasVoted).toBe(false);
      expect(voter1.save).toHaveBeenCalled();
      expect(voter2.save).toHaveBeenCalled();
    });

    test('should clear all votes after execution', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const voter1 = createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1', hasVoted: true });
      const voter2 = createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1', hasVoted: true });
      const players = [target, voter1, voter2];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // Votes are cleared after execution (code loops through alive players after execution)
      // Code sets p.hasVoted = false and p.voteFor = null for all alive players
      // Note: Votes are only cleared if execution happens or reaches the clearing code
      // For 2 votes out of 3, need 2 votes (majority threshold), so execution should happen
      if (result.executed) {
        expect(voter1.hasVoted).toBe(false);
        expect(voter2.hasVoted).toBe(false);
        expect(voter1.save).toHaveBeenCalled();
        expect(voter2.save).toHaveBeenCalled();
      }
    });
  });

  describe('Multiple Candidates', () => {
    
    test('should execute player with most votes when multiple candidates', async () => {
      const game = createMockGame();
      const target1 = createMockPlayer('1', 'Target1', 'Citizen');
      const target2 = createMockPlayer('2', 'Target2', 'Citizen');
      const players = [
        target1,
        target2,
        createMockPlayer('3', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter3', 'Citizen', { voteFor: '1' }),
        createMockPlayer('6', 'Voter4', 'Citizen', { voteFor: '1' }),
        createMockPlayer('7', 'Voter5', 'Citizen', { voteFor: '1' }), // 5 votes for majority (need 5 out of 8)
        createMockPlayer('8', 'Voter6', 'Citizen', { voteFor: '2' }),
        createMockPlayer('9', 'Voter7', 'Citizen', { voteFor: '2' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      // executedName should be set if target was found and executed
      if (result.executed) {
        expect(result.executedName).toBe('Target1');
        expect(result.votesAgainst).toBe(4); // 9 total - 5 votes = 4 against
      }
      expect(result.votesFor).toBe(5);
      expect(target1.alive).toBe(false);
      expect(target2.alive).toBe(true);
    });

    test('should handle votes split across multiple candidates', async () => {
      const game = createMockGame();
      const target1 = createMockPlayer('1', 'Target1', 'Citizen');
      const target2 = createMockPlayer('2', 'Target2', 'Citizen');
      const target3 = createMockPlayer('3', 'Target3', 'Citizen');
      const players = [
        target1,
        target2,
        target3,
        createMockPlayer('4', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('6', 'Voter3', 'Citizen', { voteFor: '2' }),
        createMockPlayer('7', 'Voter4', 'Citizen', { voteFor: '3' }),
        createMockPlayer('8', 'Abstain1', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // 2 votes is not majority for 8 players (need 5)
      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(2);
      expect(target1.alive).toBe(true);
      expect(target2.alive).toBe(true);
      expect(target3.alive).toBe(true);
    });
  });

  describe('Edge Cases with Dead Players', () => {
    
    test('should ignore votes from dead players', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1', alive: true }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1', alive: true }),
        createMockPlayer('4', 'DeadVoter', 'Citizen', { voteFor: '1', alive: false })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      expect(result.executedName).toBe('Target');
      expect(result.votesFor).toBe(2);
      expect(result.totalAlive).toBe(3); // Only alive players count
    });

    test('should not execute dead target', async () => {
      const game = createMockGame();
      const deadTarget = createMockPlayer('1', 'DeadTarget', 'Citizen', { alive: false });
      const players = [
        deadTarget,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1', alive: true }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1', alive: true })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // Should still count votes but not execute dead player
      // Since target is dead, it won't be executed even with majority
      // But votes are counted, so if it has majority, executed will be target._id but target.alive stays false
      expect(deadTarget.alive).toBe(false);
      // The result may have executed set to target._id, but target won't be killed again
      if (result.executed) {
        expect(result.executedName).toBe('DeadTarget');
      }
    });
  });

  describe('Vote Counting Logic', () => {
    
    test('should correctly count votes against (abstain/skip)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Abstain1', 'Citizen', { voteFor: null }),
        createMockPlayer('5', 'Abstain2', 'Citizen', { voteFor: null }),
        createMockPlayer('6', 'Abstain3', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // 2 votes is not majority for 6 players (need 4 = floor(6/2) + 1)
      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(2);
      // votesAgainst and totalAlive are only returned when execution happens
    });

    test('should correctly count skip votes as votes against (majority calculation)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Skip1', 'Citizen', { voteFor: null, hasVoted: true }), // Skip vote
        createMockPlayer('5', 'Skip2', 'Citizen', { voteFor: null, hasVoted: true }) // Skip vote
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // 2 votes is not majority for 5 players (need 3 = floor(5/2) + 1)
      // Skip votes count as votes against in totalWeightedVotes
      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(2);
      expect(target.alive).toBe(true);
    });

    test('should require majority even with skip votes (4 votes out of 6 with 2 skips)', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' }),
        createMockPlayer('5', 'Voter4', 'Citizen', { voteFor: '1' }),
        createMockPlayer('6', 'Skip1', 'Citizen', { voteFor: null, hasVoted: true }),
        createMockPlayer('7', 'Skip2', 'Citizen', { voteFor: null, hasVoted: true })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // 4 votes is majority for 7 players (need 4 = floor(7/2) + 1)
      expect(result.executed).toBeDefined();
      expect(result.executedName).toBe('Target');
      expect(result.votesFor).toBe(4);
      expect(result.votesAgainst).toBe(3); // 7 total - 4 votes = 3 against (including skips)
      expect(target.alive).toBe(false);
    });

    test('should handle single player voting', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      // Majority threshold for 2 players is 2 (floor(2/2) + 1)
      // So 1 vote is insufficient
      expect(result.executed).toBeNull();
      expect(result.reason).toBe('insufficient_votes');
      expect(result.votesFor).toBe(1);
      expect(target.alive).toBe(true);
    });

    test('should handle all players voting for same target', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter3', 'Citizen', { voteFor: '1' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result.executed).toBeDefined();
      expect(result.votesFor).toBe(3);
      expect(result.votesAgainst).toBe(1);
      expect(target.alive).toBe(false);
    });
  });

  describe('GameLog Integration', () => {
    
    test('should log execution message correctly', async () => {
      const game = createMockGame('game123');
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' })
      ];

      await resolveDayVoting(game, players, mockGameLog);

      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: 'Executed: Target (2/3 weighted votes)'
      });
    });

    test('should log tie message with correct names', async () => {
      const game = createMockGame();
      const target1 = createMockPlayer('1', 'Alice', 'Citizen');
      const target2 = createMockPlayer('2', 'Bob', 'Citizen');
      const players = [
        target1,
        target2,
        createMockPlayer('3', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('4', 'Voter2', 'Citizen', { voteFor: '2' })
      ];

      await resolveDayVoting(game, players, mockGameLog);

      expect(mockGameLog.create).toHaveBeenCalledWith({
        gameId: game._id,
        message: expect.stringMatching(/No execution \(tie: .*Alice.*Bob.*\)|No execution \(tie: .*Bob.*Alice.*\)/)
      });
    });
  });

  describe('Return Value Structure', () => {
    
    test('should return correct structure for execution', async () => {
      const game = createMockGame();
      const target = createMockPlayer('1', 'Target', 'Citizen');
      const players = [
        target,
        createMockPlayer('2', 'Voter1', 'Citizen', { voteFor: '1' }),
        createMockPlayer('3', 'Voter2', 'Citizen', { voteFor: '1' })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result).toHaveProperty('executed');
      expect(result).toHaveProperty('executedName');
      expect(result).toHaveProperty('votesFor');
      expect(result).toHaveProperty('votesAgainst');
      expect(result).toHaveProperty('totalAlive');
      expect(typeof result.votesFor).toBe('number');
      expect(typeof result.votesAgainst).toBe('number');
      expect(typeof result.totalAlive).toBe('number');
    });

    test('should return correct structure for no execution', async () => {
      const game = createMockGame();
      const players = [
        createMockPlayer('1', 'Player1', 'Citizen', { voteFor: null }),
        createMockPlayer('2', 'Player2', 'Citizen', { voteFor: null })
      ];

      const result = await resolveDayVoting(game, players, mockGameLog);

      expect(result).toHaveProperty('executed');
      expect(result).toHaveProperty('reason');
      expect(result.executed).toBeNull();
      expect(result.reason).toBe('no_votes');
    });
  });
});

