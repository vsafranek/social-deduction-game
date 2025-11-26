// electron/game/__tests__/victoryEvaluator.test.js

const { 
  evaluateVictory, 
  evaluateCustomRule, 
  liveTeamCounts, 
  groupByAffiliation,
  isHostileNeutral
} = require('../victoryEvaluator');

// Mock console.log to reduce noise in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

// Helper function to create mock players
const createPlayer = (id, role, alive = true, affiliations = ['good'], victoryConditions = null) => ({
  _id: { toString: () => id },
  name: `Player${id}`,
  role,
  alive,
  affiliations,
  victoryConditions: victoryConditions || { 
    canWinWithTeams: affiliations, 
    soloWin: false, 
    customRules: [] 
  },
  effects: []
});

describe('victoryEvaluator', () => {
  
  describe('Helper Functions', () => {
    
    test('liveTeamCounts should count alive players per team', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', true, ['evil']),
        createPlayer('3', 'Doctor', true, ['good']),
        createPlayer('4', 'Cleaner', false, ['evil']),
      ];

      const counts = liveTeamCounts(players);
      
      expect(counts.get('good')).toBe(2);
      expect(counts.get('evil')).toBe(1);
    });

    test('groupByAffiliation should group alive players by team', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', true, ['evil']),
        createPlayer('3', 'Doctor', false, ['good']),
      ];

      const grouped = groupByAffiliation(players);
      
      expect(grouped.get('good')).toHaveLength(1);
      expect(grouped.get('evil')).toHaveLength(1);
      expect(grouped.get('good')[0].name).toBe('Player1');
    });

    test('isHostileNeutral - Survivor is hostile', () => {
      const survivor = createPlayer('1', 'Survivor', true, ['neutral']);
      expect(isHostileNeutral(survivor)).toBe(true);
    });

    test('isHostileNeutral - Infected is hostile', () => {
      const infected = createPlayer('1', 'Infected', true, ['neutral']);
      expect(isHostileNeutral(infected)).toBe(true);
    });

    test('isHostileNeutral - Diplomat is not hostile', () => {
      const diplomat = createPlayer('1', 'Diplomat', true, ['neutral']);
      expect(isHostileNeutral(diplomat)).toBe(false);
    });

    test('evaluateCustomRule - eliminate rule', () => {
      const counts = new Map([['evil', 0], ['good', 3]]);
      const rule = { type: 'eliminate', targetTeam: 'evil' };
      
      expect(evaluateCustomRule(rule, { counts })).toBe(true);
      
      counts.set('evil', 1);
      expect(evaluateCustomRule(rule, { counts })).toBe(false);
    });

    test('evaluateCustomRule - parity rule', () => {
      const counts = new Map([['evil', 2], ['good', 2]]);
      
      const ruleGTE = { type: 'parity', team: 'evil', against: 'good', comparator: '>=' };
      expect(evaluateCustomRule(ruleGTE, { counts })).toBe(true);
      
      const ruleGT = { type: 'parity', team: 'evil', against: 'good', comparator: '>' };
      expect(evaluateCustomRule(ruleGT, { counts })).toBe(false);
      
      counts.set('evil', 3);
      expect(evaluateCustomRule(ruleGT, { counts })).toBe(true);
    });

    test('evaluateCustomRule - aliveExactly rule', () => {
      const counts = new Map([['neutral', 1]]);
      const rule = { type: 'aliveExactly', team: 'neutral', count: 1 };
      
      expect(evaluateCustomRule(rule, { counts })).toBe(true);
      
      counts.set('neutral', 2);
      expect(evaluateCustomRule(rule, { counts })).toBe(false);
    });
  });

  describe('Good Wins - NEW RULES', () => {
    
    test('Good wins when all evil dead and no hostile neutrals', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('good');
      expect(result.teams).toContain('good');
      expect(result.players).toHaveLength(2);
    });

    test('Good wins with Diplomat (non-hostile neutral) when evil dead', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Diplomat', true, ['neutral'], { 
          canWinWithTeams: ['good', 'evil'], 
          soloWin: false, 
          customRules: [] 
        }),
        createPlayer('4', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('good');
      expect(result.players).toHaveLength(3); // Good + Diplomat
    });

    test('Good does NOT win when evil dead but Survivor alive', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Survivor', true, ['neutral', 'solo'], {
          canWinWithTeams: [],
          soloWin: true,
          customRules: [
            { type: 'aliveExactly', team: 'neutral', count: 1 },
            { type: 'aliveExactly', team: 'good', count: 0 },
            { type: 'aliveExactly', team: 'evil', count: 0 }
          ]
        }),
        createPlayer('4', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      // Game continues - Survivor can kill
      expect(result).toBeNull();
    });

    test('Good does NOT win when evil dead but Infected alive', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Infected', true, ['neutral'], {
          canWinWithTeams: [],
          soloWin: false,
          customRules: [
            { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
          ]
        }),
        createPlayer('4', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      // Game continues - Infected can infect
      expect(result).toBeNull();
    });

    test('1 good vs 1 Survivor - game continues', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Survivor', true, ['neutral', 'solo'], {
          canWinWithTeams: [],
          soloWin: true,
          customRules: []
        }),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      // Game continues - Survivor can kill good
      expect(result).toBeNull();
    });

    test('1 good vs 1 Infected - game continues', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Infected', true, ['neutral'], {
          canWinWithTeams: [],
          soloWin: false,
          customRules: [
            { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
          ]
        }),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      // Game continues - Infected can infect good
      expect(result).toBeNull();
    });
  });

  describe('Evil Wins', () => {
    
    test('Evil wins with 1v1 (cannot be lynched)', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
      expect(result.teams).toContain('evil');
      expect(result.players).toHaveLength(1);
    });

    test('Evil wins with majority (3v2)', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Killer', true, ['evil']),
        createPlayer('4', 'Cleaner', true, ['evil']),
        createPlayer('5', 'Accuser', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
      expect(result.players).toHaveLength(3);
    });

    test('Evil wins with 2v1', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', true, ['evil']),
        createPlayer('3', 'Cleaner', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
    });

    test('Evil wins when only 2 players left with 1 evil', () => {
      const players = [
        createPlayer('1', 'Diplomat', true, ['neutral']),
        createPlayer('2', 'Killer', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
    });
  });

  describe('Game Continues', () => {
    
    test('Game continues with 2v2 (good can lynch)', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Killer', true, ['evil']),
        createPlayer('4', 'Cleaner', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).toBeNull();
    });

    test('Game continues with 3v2 (good majority)', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Investigator', true, ['good']),
        createPlayer('4', 'Killer', true, ['evil']),
        createPlayer('5', 'Cleaner', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).toBeNull();
    });

    test('Game continues with 2v1 (good can lynch)', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Killer', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).toBeNull();
    });

    test('Game continues with 3v3 parity', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Investigator', true, ['good']),
        createPlayer('4', 'Killer', true, ['evil']),
        createPlayer('5', 'Cleaner', true, ['evil']),
        createPlayer('6', 'Accuser', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).toBeNull();
    });

    test('Game continues with hostile neutral when evil dead', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Survivor', true, ['neutral', 'solo'], {
          canWinWithTeams: [],
          soloWin: true,
          customRules: []
        }),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).toBeNull();
    });
  });

  describe('Solo Wins', () => {
    
    test('Survivor solo win when last one standing', () => {
      const survivor = createPlayer('1', 'Survivor', true, ['neutral', 'solo'], {
        canWinWithTeams: [],
        soloWin: true,
        customRules: [
          { type: 'aliveExactly', team: 'neutral', count: 1 },
          { type: 'aliveExactly', team: 'good', count: 0 },
          { type: 'aliveExactly', team: 'evil', count: 0 }
        ]
      });

      const players = [
        survivor,
        createPlayer('2', 'Citizen', false, ['good']),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('solo');
      expect(result.players).toHaveLength(1);
      expect(result.players[0].toString()).toBe('1');
    });

    test('Solo win does not trigger if other players alive', () => {
      const players = [
        createPlayer('1', 'Survivor', true, ['neutral', 'solo'], {
          canWinWithTeams: [],
          soloWin: true,
          customRules: []
        }),
        createPlayer('2', 'Citizen', true, ['good']),
      ];

      const result = evaluateVictory(players);
      
      expect(result === null || result.winner !== 'solo').toBe(true);
    });
  });

  describe('Custom Rules - Infected', () => {
    
    test('Infected wins when all others infected', () => {
      const infected = createPlayer('1', 'Infected', true, ['neutral'], {
        canWinWithTeams: [],
        soloWin: false,
        customRules: [
          { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
        ]
      });

      const victim1 = createPlayer('2', 'Citizen', true, ['good']);
      victim1.effects = [{ type: 'infected', expiresAt: new Date(Date.now() + 10000) }];

      const victim2 = createPlayer('3', 'Killer', true, ['evil']);
      victim2.effects = [{ type: 'infected', expiresAt: new Date(Date.now() + 10000) }];

      const players = [infected, victim1, victim2];
      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('custom');
      expect(result.players).toHaveLength(1);
    });

    test('Infected does not win if one player not infected', () => {
      const infected = createPlayer('1', 'Infected', true, ['neutral'], {
        canWinWithTeams: [],
        soloWin: false,
        customRules: [
          { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
        ]
      });

      const victim1 = createPlayer('2', 'Citizen', true, ['good']);
      victim1.effects = [{ type: 'infected', expiresAt: new Date(Date.now() + 10000) }];

      const healthy = createPlayer('3', 'Killer', true, ['evil']);
      healthy.effects = [];

      const players = [infected, victim1, healthy];
      const result = evaluateVictory(players);
      
      expect(result === null || result.winner !== 'custom').toBe(true);
    });

    test('Infected wins even if evil alive (custom rule priority)', () => {
      const infected = createPlayer('1', 'Infected', true, ['neutral'], {
        canWinWithTeams: [],
        soloWin: false,
        customRules: [
          { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
        ]
      });

      const victim1 = createPlayer('2', 'Citizen', true, ['good']);
      victim1.effects = [{ type: 'infected', expiresAt: new Date(Date.now() + 10000) }];

      const victim2 = createPlayer('3', 'Killer', true, ['evil']);
      victim2.effects = [{ type: 'infected', expiresAt: new Date(Date.now() + 10000) }];

      const players = [infected, victim1, victim2];
      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('custom');
    });
  });

  describe('Edge Cases', () => {
    
    test('No players alive - evil wins by default', () => {
      const players = [
        createPlayer('1', 'Citizen', false, ['good']),
        createPlayer('2', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
      expect(result.players).toHaveLength(0);
    });

    test('Last player standing (good) wins', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', false, ['evil']),
        createPlayer('3', 'Cleaner', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('good');
      expect(result.players).toHaveLength(1);
    });

    test('Last player standing (evil) wins', () => {
      const players = [
        createPlayer('1', 'Killer', true, ['evil']),
        createPlayer('2', 'Citizen', false, ['good']),
        createPlayer('3', 'Doctor', false, ['good']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('evil');
      expect(result.players).toHaveLength(1);
    });

    test('Multiple hostile neutrals - game continues', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Survivor', true, ['neutral', 'solo'], {
          canWinWithTeams: [],
          soloWin: true,
          customRules: []
        }),
        createPlayer('3', 'Infected', true, ['neutral'], {
          canWinWithTeams: [],
          soloWin: false,
          customRules: [
            { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
          ]
        }),
        createPlayer('4', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      // Game continues - multiple hostile neutrals
      expect(result).toBeNull();
    });
  });

  describe('Winner Player IDs', () => {
    
    test('Winner IDs correct for good win', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Doctor', true, ['good']),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.players).toHaveLength(2);
      expect(result.players.map(p => p.toString())).toContain('1');
      expect(result.players.map(p => p.toString())).toContain('2');
    });

    test('Winner IDs correct for evil win', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Killer', true, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.players).toHaveLength(1);
      expect(result.players[0].toString()).toBe('2');
    });

    test('Diplomat wins with good team', () => {
      const players = [
        createPlayer('1', 'Citizen', true, ['good']),
        createPlayer('2', 'Diplomat', true, ['neutral'], {
          canWinWithTeams: ['good', 'evil'],
          soloWin: false,
          customRules: []
        }),
        createPlayer('3', 'Killer', false, ['evil']),
      ];

      const result = evaluateVictory(players);
      
      expect(result).not.toBeNull();
      expect(result.winner).toBe('good');
      expect(result.players).toHaveLength(2); // Good + Diplomat
    });
  });
});
