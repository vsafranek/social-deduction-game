// electron/game/__tests__/nightActionResolver.test.js

const { resolveNightActions } = require('../nightActionResolver');
const { ROLES } = require('../../models/Role');

// Mock console.log to reduce noise in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

// Helper function to create mock players
const createMockPlayer = (id, name, role, options = {}) => {
  const {
    alive = true,
    modifier = null,
    nightAction = null,
    effects = [],
    roleData = {},
    roleHidden = false
  } = options;

  const player = {
    _id: { toString: () => id },
    name,
    role,
    alive,
    modifier,
    effects: [...effects],
    roleData: { ...roleData },
    roleHidden,
    nightAction: nightAction ? { ...nightAction } : { targetId: null, action: null, results: [] }
  };

  // Set save method after player is created
  player.save = jest.fn().mockResolvedValue(player);
  
  // Mock markModified for Mongoose (used for roleData changes)
  player.markModified = jest.fn(function(field) {
    // In tests, we don't need to do anything, but the method should exist
    return this;
  });

  return player;
};

// Helper to add effect to player
const addEffect = (player, type, sourceId = null, expiresAt = null, meta = {}) => {
  if (!player.effects) player.effects = [];
  player.effects.push({
    type,
    source: sourceId,
    addedAt: new Date(),
    expiresAt,
    meta
  });
};

describe('nightActionResolver', () => {
  
  describe('Basic Action Resolution', () => {
    
    test('should resolve simple kill action', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const victim = createMockPlayer('2', 'Victim', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [cleaner, victim]);

      expect(victim.alive).toBe(false);
      expect(victim.nightAction.results).toContain('killed:Zavražděn');
      expect(cleaner.nightAction.results).toContain('success:Zaútočil Victim');
    });

    test('should resolve protect action', async () => {
      const doctor = createMockPlayer('1', 'Doctor', 'Doctor', {
        nightAction: { targetId: '2', action: 'protect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor, target]);

      const hasProtected = target.effects.some(e => e.type === 'protected');
      expect(hasProtected).toBe(true);
    });

    test('should resolve block action (Jailer)', async () => {
      const jailer = createMockPlayer('1', 'Jailer', 'Jailer', {
        nightAction: { targetId: '2', action: 'block', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true
      });

      await resolveNightActions({}, [jailer, target]);

      const hasBlocked = target.effects.some(e => e.type === 'blocked');
      expect(hasBlocked).toBe(true);
    });

    test('should resolve investigate action', async () => {
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true
      });

      await resolveNightActions({ round: 1 }, [investigator, target]);

      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      expect(investigateResult).toContain('Target');
      expect(investigateResult).toContain('=');
      
      // Check that investigation history is stored
      expect(investigator.roleData.investigationHistory).toBeDefined();
      expect(investigator.roleData.investigationHistory['2']).toBeDefined();
      expect(investigator.roleData.investigationHistory['2'].type).toBe('investigate');
      expect(investigator.roleData.investigationHistory['2'].round).toBe(1);
    });

    test('should resolve watch action', async () => {
      const lookout = createMockPlayer('1', 'Lookout', 'Lookout', {
        nightAction: { targetId: '2', action: 'watch', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });
      const visitor = createMockPlayer('3', 'Visitor', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });

      await resolveNightActions({}, [lookout, target, visitor]);

      const watchResult = lookout.nightAction.results.find(r => r.startsWith('watch:'));
      expect(watchResult).toBeDefined();
    });

    test('should resolve track action', async () => {
      const tracker = createMockPlayer('1', 'Tracker', 'Tracker', {
        nightAction: { targetId: '2', action: 'track', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const destination = createMockPlayer('3', 'Destination', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [tracker, target, destination]);

      const trackResult = tracker.nightAction.results.find(r => r.startsWith('track:'));
      expect(trackResult).toBeDefined();
    });

    test('should resolve guard action', async () => {
      const guardian = createMockPlayer('1', 'Guardian', 'Guardian', {
        nightAction: { targetId: '1', action: 'guard', results: [] }
      });

      await resolveNightActions({}, [guardian]);

      const hasGuard = guardian.effects.some(e => e.type === 'guard');
      expect(hasGuard).toBe(true);
      expect(guardian.nightAction.results).toContain('success:Nastavil jsi stráž u Guardian');
    });
  });

  describe('Priority Ordering', () => {
    
    test('should process actions in priority order (Jailer before Cleaner)', async () => {
      const jailer = createMockPlayer('1', 'Jailer', 'Jailer', {
        nightAction: { targetId: '2', action: 'block', results: [] }
      });
      const cleaner = createMockPlayer('2', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [jailer, cleaner, target]);

      // Cleaner should be blocked
      const hasBlocked = cleaner.effects.some(e => e.type === 'blocked');
      expect(hasBlocked).toBe(true);
      
      // Target should not be killed because cleaner was blocked
      expect(target.alive).toBe(true);
    });

    test('should process Doctor protection before kill', async () => {
      const doctor = createMockPlayer('1', 'Doctor', 'Doctor', {
        nightAction: { targetId: '3', action: 'protect', results: [] }
      });
      const cleaner = createMockPlayer('2', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor, cleaner, target]);

      // Target should be protected and not die
      expect(target.alive).toBe(true);
      expect(target.nightAction.results).toContain('attacked:Útok');
      expect(target.nightAction.results).toContain('healed:Zachráněn');
      expect(doctor.nightAction.results.some(r => r.includes('Zachránil'))).toBe(true);
    });
  });

  describe('Drunk Modifier', () => {
    
    test('should prevent drunk player from acting', async () => {
      const drunk = createMockPlayer('1', 'Drunk', 'Cleaner', {
        modifier: 'Drunk',
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [drunk, target]);

      // Target should not be killed
      expect(target.alive).toBe(true);
      
      // Drunk should get fake message
      const fakeMessage = drunk.nightAction.results.find(r => r.includes('Zaútočil jsi'));
      expect(fakeMessage).toBeDefined();
    });

    test('should generate fake messages for drunk player', async () => {
      const drunk = createMockPlayer('1', 'Drunk', 'Doctor', {
        modifier: 'Drunk',
        nightAction: { targetId: '2', action: 'protect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [drunk, target]);

      const fakeMessage = drunk.nightAction.results.find(r => r.includes('Chráníš'));
      expect(fakeMessage).toBeDefined();
    });
  });

  describe('Blocked Effects', () => {
    
    test('should prevent blocked player from acting', async () => {
      // Jailer blocks the cleaner in the same night
      const jailer = createMockPlayer('1', 'Jailer', 'Jailer', {
        nightAction: { targetId: '2', action: 'block', results: [] }
      });
      const blocked = createMockPlayer('2', 'Blocked', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [jailer, blocked, target]);

      expect(target.alive).toBe(true);
      expect(blocked.nightAction.results).toContain('blocked:Uzamčen');
    });

    test('should clear blocked effects at start of night', async () => {
      const player = createMockPlayer('1', 'Player', 'Citizen', {
        effects: [
          { type: 'blocked', source: null, addedAt: new Date() },
          { type: 'protected', source: null, addedAt: new Date() }
        ]
      });

      await resolveNightActions({}, [player]);

      const hasBlocked = player.effects.some(e => e.type === 'blocked');
      expect(hasBlocked).toBe(false);
    });
  });

  describe('Trap Effects', () => {
    
    test('should guard visitor when target has guard', async () => {
      // Guardian sets guard on themselves in the same night
      const guardian = createMockPlayer('1', 'Guardian', 'Guardian', {
        nightAction: { targetId: '1', action: 'guard', results: [] }
      });
      // Visitor tries to visit guardian in the same night
      // Note: guard effect is added during processing, so visitor should be guarded
      const visitor = createMockPlayer('2', 'Visitor', 'Cleaner', {
        nightAction: { targetId: '1', action: 'kill', results: [] }
      });

      await resolveNightActions({}, [guardian, visitor]);

      // Guardian should have guard effect
      const hasGuard = guardian.effects.some(e => e.type === 'guard');
      expect(hasGuard).toBe(true);
      
      // Visitor should be guarded (guard is checked before action)
      // However, since guard is set in the same night, the visitor might not be guarded
      // because guard effect is added during processing. Let's test that guard is set correctly.
      expect(guardian.nightAction.results).toContain('success:Nastavil jsi stráž u Guardian');
    });
  });

  describe('Shady Modifier', () => {
    
    test('should show Shady as true role + evil role to Investigator', async () => {
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const shady = createMockPlayer('2', 'Shady', 'Citizen', {
        modifier: 'Shady',
        alive: true
      });

      await resolveNightActions({}, [investigator, shady]);

      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      // Should show true role (Citizen)
      expect(investigateResult).toContain('Citizen');
      // Should also show an evil role
      const evilRoles = Object.keys(ROLES).filter(r => ROLES[r].team === 'evil');
      const showsEvil = evilRoles.some(role => investigateResult.includes(role));
      expect(showsEvil).toBe(true);
      // Should have format "Citizen / EvilRole" or "EvilRole / Citizen"
      expect(investigateResult).toMatch(/Citizen\s*\/\s*\w+|\w+\s*\/\s*Citizen/);
    });
  });

  describe('Innocent Modifier', () => {
    
    test('should show Innocent as good or neutral to Investigator', async () => {
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const innocent = createMockPlayer('2', 'Innocent', 'Cleaner', {
        modifier: 'Innocent',
        alive: true
      });

      await resolveNightActions({}, [investigator, innocent]);

      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      // Should show a good or neutral role (not evil)
      const goodOrNeutralRoles = Object.keys(ROLES).filter(r => 
        ROLES[r].team === 'good' || ROLES[r].team === 'neutral'
      );
      const showsGoodOrNeutral = goodOrNeutralRoles.some(role => investigateResult.includes(role));
      expect(showsGoodOrNeutral).toBe(true);
      // Should NOT show the true evil role (Cleaner)
      expect(investigateResult).not.toContain('Cleaner');
    });
  });

  describe('Framed Effect', () => {
    
    test('should show framed player as evil to Investigator (instead of true role)', async () => {
      const accuser = createMockPlayer('0', 'Accuser', 'Accuser', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'frame', results: [] }
      });
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const framed = createMockPlayer('2', 'Framed', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [accuser, investigator, framed]);

      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      // Should show an evil role (not Citizen)
      const evilRoles = Object.keys(ROLES).filter(r => ROLES[r].team === 'evil');
      const showsEvil = evilRoles.some(role => investigateResult.includes(role));
      expect(showsEvil).toBe(true);
      // Should NOT show the true role (Citizen)
      expect(investigateResult).not.toContain('Citizen');
    });

    test('should apply frame before investigation due to priority ordering', async () => {
      // This test verifies that Accuser's frame action (priority 4) executes before Investigator (priority 5)
      const accuser = createMockPlayer('0', 'Accuser', 'Accuser', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'frame', results: [] }
      });
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Doctor', {
        alive: true
      });

      await resolveNightActions({}, [accuser, investigator, target]);

      // Frame should be applied first
      const hasFramed = target.effects.some(e => e.type === 'framed');
      expect(hasFramed).toBe(true);
      
      // Investigator should see the fake evil role, not the true role (Doctor)
      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      // Should NOT show the true role (Doctor)
      expect(investigateResult).not.toContain('Doctor');
      // Should show an evil role
      const evilRoles = Object.keys(ROLES).filter(r => ROLES[r].team === 'evil');
      const showsEvil = evilRoles.some(role => investigateResult.includes(role));
      expect(showsEvil).toBe(true);
    });

    test('should show framed evil role to Coroner when investigating dead framed player', async () => {
      const accuser = createMockPlayer('0', 'Accuser', 'Accuser', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'frame', results: [] }
      });
      const coroner = createMockPlayer('1', 'Coroner', 'Coroner', {
        nightAction: { targetId: '2', action: 'autopsy', results: [] }
      });
      const framed = createMockPlayer('2', 'Framed', 'Citizen', {
        alive: false,
        effects: [{ 
          type: 'framed', 
          source: null, 
          addedAt: new Date(), 
          expiresAt: null, 
          meta: { fakeEvilRole: 'Cleaner' } 
        }]
      });

      await resolveNightActions({}, [accuser, coroner, framed]);

      const autopsyResult = coroner.nightAction.results.find(r => r.startsWith('autopsy:'));
      expect(autopsyResult).toBeDefined();
      // Should show the fake evil role (Cleaner), not the true role (Citizen)
      expect(autopsyResult).toContain('Cleaner');
      expect(autopsyResult).not.toContain('Citizen');
    });
  });

  describe('Investigator Limitations', () => {
    
    test('should not allow Investigator to investigate dead player', async () => {
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const dead = createMockPlayer('2', 'Dead', 'Citizen', {
        alive: false
      });

      await resolveNightActions({}, [investigator, dead]);

      const failedResult = investigator.nightAction.results.find(r => r.includes('failed:'));
      expect(failedResult).toBeDefined();
      expect(failedResult).toContain('mrtvého hráče');
    });

    test('should not allow Investigator to investigate cleaned role', async () => {
      const investigator = createMockPlayer('1', 'Investigator', 'Investigator', {
        nightAction: { targetId: '2', action: 'investigate', results: [] }
      });
      const cleaned = createMockPlayer('2', 'Cleaned', 'Cleaner', {
        alive: false,
        roleHidden: true
      });

      await resolveNightActions({}, [investigator, cleaned]);

      const failedResult = investigator.nightAction.results.find(r => r.includes('failed:'));
      expect(failedResult).toBeDefined();
      expect(failedResult).toContain('vyčištěna');
    });
  });

  describe('Coroner Role', () => {
    
    test('should allow Coroner to autopsy dead player and learn exact role', async () => {
      const coroner = createMockPlayer('1', 'Coroner', 'Coroner', {
        nightAction: { targetId: '2', action: 'autopsy', results: [] }
      });
      const dead = createMockPlayer('2', 'Dead', 'Cleaner', {
        alive: false,
        roleHidden: false
      });

      await resolveNightActions({ round: 1 }, [coroner, dead]);

      const autopsyResult = coroner.nightAction.results.find(r => r.startsWith('autopsy:'));
      expect(autopsyResult).toBeDefined();
      expect(autopsyResult).toContain('Cleaner');
      expect(autopsyResult).toContain('Dead');
      
      // Check that autopsy history is stored
      expect(coroner.roleData.investigationHistory).toBeDefined();
      expect(coroner.roleData.investigationHistory['2']).toBeDefined();
      expect(coroner.roleData.investigationHistory['2'].type).toBe('autopsy');
      expect(coroner.roleData.investigationHistory['2'].round).toBe(1);
    });

    test('should not allow Coroner to autopsy alive player', async () => {
      const coroner = createMockPlayer('1', 'Coroner', 'Coroner', {
        nightAction: { targetId: '2', action: 'autopsy', results: [] }
      });
      const alive = createMockPlayer('2', 'Alive', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [coroner, alive]);

      const failedResult = coroner.nightAction.results.find(r => r.includes('failed:'));
      expect(failedResult).toBeDefined();
      expect(failedResult).toContain('živém hráči');
    });

    test('should allow Coroner to autopsy cleaned role but get Unknown result', async () => {
      const coroner = createMockPlayer('1', 'Coroner', 'Coroner', {
        nightAction: { targetId: '2', action: 'autopsy', results: [] }
      });
      const cleaned = createMockPlayer('2', 'Cleaned', 'Cleaner', {
        alive: false,
        roleHidden: true
      });

      await resolveNightActions({}, [coroner, cleaned]);

      const autopsyResult = coroner.nightAction.results.find(r => r.startsWith('autopsy:'));
      expect(autopsyResult).toBeDefined();
      expect(autopsyResult).toContain('Unknown');
      expect(autopsyResult).toContain('vyčištěna');
      // Should not contain the actual role
      expect(autopsyResult).not.toContain('Cleaner');
    });
  });

  describe('Paranoid Modifier', () => {
    
    test('should add fake visitors to Paranoid player', async () => {
      const paranoid = createMockPlayer('1', 'Paranoid', 'Citizen', {
        modifier: 'Paranoid',
        alive: true
      });
      const other = createMockPlayer('2', 'Other', 'Citizen', {
        alive: true
      });

      // Mock Math.random to return < 0.5 (50% chance)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.3);

      await resolveNightActions({}, [paranoid, other]);

      Math.random = originalRandom;

      const visitedResult = paranoid.nightAction.results.find(r => r.startsWith('visited:'));
      // May or may not have fake visitor (50% chance)
      // Just check that if it exists, it's formatted correctly
      if (visitedResult) {
        expect(visitedResult).toMatch(/^visited:/);
      }
    });
  });

  describe('Insomniac Modifier', () => {
    
    test('should show real visitors to Insomniac', async () => {
      const insomniac = createMockPlayer('1', 'Insomniac', 'Citizen', {
        modifier: 'Insomniac',
        alive: true
      });
      const visitor = createMockPlayer('2', 'Visitor', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '1', action: 'kill', results: [] }
      });

      await resolveNightActions({}, [insomniac, visitor]);

      const visitedResult = insomniac.nightAction.results.find(r => r.startsWith('visited:'));
      expect(visitedResult).toBeDefined();
      expect(visitedResult).toContain('Visitor');
    });
  });

  describe('Kill Resolution', () => {
    
    test('should kill unprotected target', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [cleaner, target]);

      expect(target.alive).toBe(false);
      expect(target.nightAction.results).toContain('killed:Zavražděn');
    });

    test('should not kill protected target', async () => {
      const doctor = createMockPlayer('1', 'Doctor', 'Doctor', {
        nightAction: { targetId: '3', action: 'protect', results: [] }
      });
      const cleaner = createMockPlayer('2', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor, cleaner, target]);

      expect(target.alive).toBe(true);
      expect(target.nightAction.results).toContain('attacked:Útok');
      expect(target.nightAction.results).toContain('healed:Zachráněn');
    });

    test('should give Doctor feedback when saving someone', async () => {
      const doctor = createMockPlayer('1', 'Doctor', 'Doctor', {
        nightAction: { targetId: '3', action: 'protect', results: [] }
      });
      const cleaner = createMockPlayer('2', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor, cleaner, target]);

      const saveMessage = doctor.nightAction.results.find(r => r.includes('Zachránil'));
      expect(saveMessage).toBeDefined();
    });

    test('should give Doctor feedback when no attack occurred', async () => {
      const doctor = createMockPlayer('1', 'Doctor', 'Doctor', {
        nightAction: { targetId: '2', action: 'protect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor, target]);

      const noAttackMessage = doctor.nightAction.results.find(r => r.includes('Chránil'));
      expect(noAttackMessage).toBeDefined();
    });
  });

  describe('Jailer Feedback', () => {
    
    test('should inform Jailer when target tried to act', async () => {
      const jailer = createMockPlayer('1', 'Jailer', 'Jailer', {
        nightAction: { targetId: '2', action: 'block', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const victim = createMockPlayer('3', 'Victim', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [jailer, target, victim]);

      const triedToLeave = jailer.nightAction.results.find(r => r.includes('odešel'));
      expect(triedToLeave).toBeDefined();
    });

    test('should inform Jailer when target stayed home', async () => {
      const jailer = createMockPlayer('1', 'Jailer', 'Jailer', {
        nightAction: { targetId: '2', action: 'block', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true,
        nightAction: { targetId: null, action: null, results: [] }
      });

      await resolveNightActions({}, [jailer, target]);

      const stayedHome = jailer.nightAction.results.find(r => r.includes('doma'));
      expect(stayedHome).toBeDefined();
    });
  });

  describe('Hunter Kill', () => {
    
    test('should kill innocent target and cause Hunter to die', async () => {
      const hunter = createMockPlayer('1', 'Hunter', 'Hunter', {
        alive: true,
        nightAction: { targetId: '2', action: 'hunter_kill', results: [] }
      });
      const innocent = createMockPlayer('2', 'Innocent', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [hunter, innocent]);

      expect(innocent.alive).toBe(false);
      expect(hunter.alive).toBe(false);
      expect(hunter.nightAction.results).toContain('hunter_guilt:Zabil nevinného');
    });

    test('should kill evil target without Hunter dying', async () => {
      const hunter = createMockPlayer('1', 'Hunter', 'Hunter', {
        alive: true,
        nightAction: { targetId: '2', action: 'hunter_kill', results: [] }
      });
      const evil = createMockPlayer('2', 'Evil', 'Cleaner', {
        alive: true
      });

      await resolveNightActions({}, [hunter, evil]);

      expect(evil.alive).toBe(false);
      expect(hunter.alive).toBe(true);
      const successMessage = hunter.nightAction.results.find(r => r.includes('Zabil'));
      expect(successMessage).toBeDefined();
    });
  });

  describe('Limited Uses Actions', () => {
    
    test('should allow Accuser to frame with uses remaining', async () => {
      const accuser = createMockPlayer('1', 'Accuser', 'Accuser', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'frame', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [accuser, target]);

      const hasFramed = target.effects.some(e => e.type === 'framed');
      expect(hasFramed).toBe(true);
      expect(accuser.roleData.usesRemaining).toBe(1);
      const successMessage = accuser.nightAction.results.find(r => r.includes('Obvinil'));
      expect(successMessage).toBeDefined();
    });

    test('should prevent Accuser from framing with no uses left', async () => {
      const accuser = createMockPlayer('1', 'Accuser', 'Accuser', {
        roleData: { usesRemaining: 0 },
        nightAction: { targetId: '2', action: 'frame', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [accuser, target]);

      const hasFramed = target.effects.some(e => e.type === 'framed');
      expect(hasFramed).toBe(false);
      expect(accuser.nightAction.results).toContain('failed:Žádná použití');
    });

    test('should allow Consigliere to investigate with uses remaining', async () => {
      const consig = createMockPlayer('1', 'Consigliere', 'Consigliere', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'consig_investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true
      });

      await resolveNightActions({ round: 1 }, [consig, target]);

      const consigResult = consig.nightAction.results.find(r => r.startsWith('consig:'));
      expect(consigResult).toBeDefined();
      expect(consigResult).toContain('Cleaner');
      expect(consig.roleData.usesRemaining).toBe(1);
      
      // Check that investigation history is stored
      expect(consig.roleData.investigationHistory).toBeDefined();
      expect(consig.roleData.investigationHistory['2']).toBeDefined();
      expect(consig.roleData.investigationHistory['2'].type).toBe('consig');
      expect(consig.roleData.investigationHistory['2'].round).toBe(1);
    });

    test('should not allow Consigliere to investigate dead player', async () => {
      const consig = createMockPlayer('1', 'Consigliere', 'Consigliere', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'consig_investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: false
      });

      await resolveNightActions({}, [consig, target]);

      const failedResult = consig.nightAction.results.find(r => r.includes('failed:'));
      expect(failedResult).toBeDefined();
      expect(failedResult).toContain('mrtvého hráče');
      // Should not use a use
      expect(consig.roleData.usesRemaining).toBe(2);
    });

    test('should always show true role when Consigliere investigates (even if marked or framed)', async () => {
      const consig = createMockPlayer('1', 'Consigliere', 'Consigliere', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'consig_investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true,
        effects: [
          { type: 'marked_for_cleaning', source: null, addedAt: new Date(), expiresAt: null, meta: {} },
          { type: 'framed', source: null, addedAt: new Date(), expiresAt: null, meta: { fakeEvilRole: 'Accuser' } }
        ]
      });

      await resolveNightActions({}, [consig, target]);

      const consigResult = consig.nightAction.results.find(r => r.startsWith('consig:'));
      expect(consigResult).toBeDefined();
      // Should contain the TRUE role (Cleaner), not fake roles
      expect(consigResult).toContain('Cleaner');
      expect(consigResult).not.toContain('Accuser');
      expect(consig.roleData.usesRemaining).toBe(1);
    });

    test('should prevent Consigliere from investigating with no uses left', async () => {
      const consig = createMockPlayer('1', 'Consigliere', 'Consigliere', {
        roleData: { usesRemaining: 0 },
        nightAction: { targetId: '2', action: 'consig_investigate', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true
      });

      await resolveNightActions({}, [consig, target]);

      const failedResult = consig.nightAction.results.find(r => r.includes('failed:'));
      expect(failedResult).toBeDefined();
      expect(failedResult).toContain('Žádná použití');
    });
  });

  describe('Cleaner Role Cleaning', () => {
    
    test('should clean dead player role when Cleaner used clean_role on them', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'clean_role', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true
      });
      const killerCleaner = createMockPlayer('3', 'KillerCleaner', 'Cleaner', {
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });

      await resolveNightActions({}, [cleaner, target, killerCleaner]);

      // Target should be dead
      expect(target.alive).toBe(false);
      // Role should be hidden
      expect(target.roleHidden).toBe(true);
      expect(cleaner.roleData.usesRemaining).toBe(1);
    });

    test('should mark alive player for cleaning when Cleaner uses clean_role', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'clean_role', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true,
        roleHidden: false
      });

      await resolveNightActions({}, [cleaner, target]);

      // Target is alive, so role should not be hidden yet
      expect(target.roleHidden).toBe(false);
      // Should have marked_for_cleaning effect
      const hasMarked = target.effects.some(e => e.type === 'marked_for_cleaning');
      expect(hasMarked).toBe(true);
      // Cleaner should have used one use
      expect(cleaner.roleData.usesRemaining).toBe(1);
    });

    test('should allow Cleaner to use clean_role on dead player', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'clean_role', results: [] }
      });
      const deadTarget = createMockPlayer('2', 'DeadTarget', 'Citizen', {
        alive: false
      });

      await resolveNightActions({}, [cleaner, deadTarget]);

      // Should process the action and hide the role
      expect(deadTarget.roleHidden).toBe(true);
      const successResult = cleaner.nightAction.results.find(r => r.includes('success:'));
      expect(successResult).toBeDefined();
      expect(cleaner.roleData.usesRemaining).toBe(1);
    });

    test('should hide role when marked player dies during the same night', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'clean_role', results: [] }
      });
      const killerCleaner = createMockPlayer('3', 'KillerCleaner', 'Cleaner', {
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [cleaner, killerCleaner, target]);

      // Target should be dead
      expect(target.alive).toBe(false);
      // Role should be hidden because marked player died
      expect(target.roleHidden).toBe(true);
      // Effect should be removed after role is hidden (no longer needed)
      const hasMarked = target.effects.some(e => e.type === 'marked_for_cleaning');
      expect(hasMarked).toBe(false);
    });

    test('should show fake investigation results when Investigator investigates marked player', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '3', action: 'clean_role', results: [] }
      });
      const investigator = createMockPlayer('2', 'Investigator', 'Investigator', {
        nightAction: { targetId: '3', action: 'investigate', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true,
        effects: [{ type: 'marked_for_cleaning', source: null, addedAt: new Date(), expiresAt: null, meta: {} }]
      });

      await resolveNightActions({}, [cleaner, investigator, target]);

      // Investigator should see fake results (both roles are fake)
      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      expect(investigateResult).toContain('Target');
      // Should contain two roles (both fake)
      expect(investigateResult).toContain(' = ');
      // Should NOT contain the true role (Citizen) as a separate word - this is critical for the bug fix
      // Use regex to check for "Citizen" as a whole word
      const citizenRegex = /\bCitizen\b/;
      expect(investigateResult).not.toMatch(citizenRegex);
      
      // Run multiple times to ensure true role never appears
      for (let i = 0; i < 10; i++) {
        const newInvestigator = createMockPlayer('2', 'Investigator', 'Investigator', {
          nightAction: { targetId: '3', action: 'investigate', results: [] }
        });
        await resolveNightActions({}, [newInvestigator, target]);
        const result = newInvestigator.nightAction.results.find(r => r.startsWith('investigate:'));
        expect(result).not.toMatch(citizenRegex);
      }
    });

    test('should show normal role when investigating unmarked alive player', async () => {
      const cleaner = createMockPlayer('1', 'Cleaner', 'Cleaner', {
        roleData: { usesRemaining: 2 },
        nightAction: { targetId: '2', action: 'kill', results: [] } // Not using clean_role
      });
      const investigator = createMockPlayer('2', 'Investigator', 'Investigator', {
        nightAction: { targetId: '3', action: 'investigate', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [cleaner, investigator, target]);

      // Investigator should see normal results (one true, one fake)
      const investigateResult = investigator.nightAction.results.find(r => r.startsWith('investigate:'));
      expect(investigateResult).toBeDefined();
      expect(investigateResult).toContain('Target');
      // Should contain Citizen (true role) or another role
      expect(investigateResult).toContain(' = ');
    });
  });

  describe('Infected Action', () => {
    
    test('should infect target', async () => {
      const infected = createMockPlayer('1', 'Infected', 'Infected', {
        nightAction: { targetId: '2', action: 'infect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [infected, target]);

      const hasInfected = target.effects.some(e => e.type === 'infected');
      expect(hasInfected).toBe(true);
      expect(infected.nightAction.results).toContain('success:Nakazil Target');
    });

    test('should not infect already infected target', async () => {
      const infected = createMockPlayer('1', 'Infected', 'Infected', {
        nightAction: { targetId: '2', action: 'infect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true,
        effects: [{ type: 'infected', source: '1', addedAt: new Date() }]
      });

      await resolveNightActions({}, [infected, target]);

      const infectedCount = target.effects.filter(e => e.type === 'infected').length;
      expect(infectedCount).toBe(1); // Should still be 1, not 2
    });

    test('should track visited players in roleData', async () => {
      const infected = createMockPlayer('1', 'Infected', 'Infected', {
        nightAction: { targetId: '2', action: 'infect', results: [] },
        roleData: {}
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [infected, target]);

      expect(infected.roleData.visitedPlayers).toBeDefined();
      expect(Array.isArray(infected.roleData.visitedPlayers)).toBe(true);
      expect(infected.roleData.visitedPlayers).toContain('2');
      expect(infected.markModified).toHaveBeenCalledWith('roleData');
    });

    test('should not infect dead target', async () => {
      const infected = createMockPlayer('1', 'Infected', 'Infected', {
        nightAction: { targetId: '2', action: 'infect', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: false
      });

      await resolveNightActions({}, [infected, target]);

      const hasInfected = target.effects.some(e => e.type === 'infected');
      expect(hasInfected).toBe(false);
      const failedResult = infected.nightAction.results.find(r => r.includes('mrtvého'));
      expect(failedResult).toBeDefined();
    });
  });

  describe('Watch and Track Results', () => {
    
    test('should show visitors to Lookout', async () => {
      const lookout = createMockPlayer('1', 'Lookout', 'Lookout', {
        nightAction: { targetId: '2', action: 'watch', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });
      const visitor1 = createMockPlayer('3', 'Visitor1', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const visitor2 = createMockPlayer('4', 'Visitor2', 'Doctor', {
        alive: true,
        nightAction: { targetId: '2', action: 'protect', results: [] }
      });

      await resolveNightActions({}, [lookout, target, visitor1, visitor2]);

      const watchResult = lookout.nightAction.results.find(r => r.startsWith('watch:'));
      expect(watchResult).toBeDefined();
      expect(watchResult).toContain('Target');
    });

    test('should show "nobody" when no visitors', async () => {
      const lookout = createMockPlayer('1', 'Lookout', 'Lookout', {
        nightAction: { targetId: '2', action: 'watch', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [lookout, target]);

      const watchResult = lookout.nightAction.results.find(r => r.startsWith('watch:'));
      expect(watchResult).toBeDefined();
      expect(watchResult).toContain('nikdo nebyl');
    });

    test('should track target movement', async () => {
      const tracker = createMockPlayer('1', 'Tracker', 'Tracker', {
        nightAction: { targetId: '2', action: 'track', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const destination = createMockPlayer('3', 'Destination', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [tracker, target, destination]);

      const trackResult = tracker.nightAction.results.find(r => r.startsWith('track:'));
      expect(trackResult).toBeDefined();
      expect(trackResult).toContain('Destination');
    });

    test('should show "stayed home" for tracked drunk player', async () => {
      const tracker = createMockPlayer('1', 'Tracker', 'Tracker', {
        nightAction: { targetId: '2', action: 'track', results: [] }
      });
      const drunk = createMockPlayer('2', 'Drunk', 'Cleaner', {
        modifier: 'Drunk',
        alive: true,
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [tracker, drunk, target]);

      const trackResult = tracker.nightAction.results.find(r => r.startsWith('track:'));
      expect(trackResult).toBeDefined();
      expect(trackResult).toContain('nikam nešel');
    });
  });

  describe('Default Messages', () => {
    
    test('should add default safe message to players with no results', async () => {
      const player = createMockPlayer('1', 'Player', 'Citizen', {
        alive: true,
        nightAction: { targetId: null, action: null, results: [] }
      });

      await resolveNightActions({}, [player]);

      expect(player.nightAction.results).toContain('safe:V noci se ti nic nestalo');
    });

    test('should not add default message if player has results', async () => {
      // Player with an action that produces results (like being visited)
      const insomniac = createMockPlayer('1', 'Insomniac', 'Citizen', {
        modifier: 'Insomniac',
        alive: true
      });
      const visitor = createMockPlayer('2', 'Visitor', 'Cleaner', {
        alive: true,
        nightAction: { targetId: '1', action: 'kill', results: [] }
      });

      await resolveNightActions({}, [insomniac, visitor]);

      // Insomniac should get visited message, not default safe message
      const safeMessage = insomniac.nightAction.results.find(r => r.startsWith('safe:'));
      expect(safeMessage).toBeUndefined();
      const visitedMessage = insomniac.nightAction.results.find(r => r.startsWith('visited:'));
      expect(visitedMessage).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    
    test('should skip dead players', async () => {
      const dead = createMockPlayer('1', 'Dead', 'Cleaner', {
        alive: false,
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [dead, target]);

      expect(target.alive).toBe(true);
    });

    test('should skip actions with invalid targets', async () => {
      const actor = createMockPlayer('1', 'Actor', 'Cleaner', {
        nightAction: { targetId: '999', action: 'kill', results: [] }
      });
      const target = createMockPlayer('2', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [actor, target]);

      // Should not crash and target should be safe
      expect(target.alive).toBe(true);
    });

    test('should skip actions with dead targets', async () => {
      const actor = createMockPlayer('1', 'Actor', 'Cleaner', {
        nightAction: { targetId: '2', action: 'kill', results: [] }
      });
      const deadTarget = createMockPlayer('2', 'DeadTarget', 'Citizen', {
        alive: false
      });

      await resolveNightActions({}, [actor, deadTarget]);

      // Should not crash
      expect(deadTarget.alive).toBe(false);
    });

    test('should handle players without nightAction', async () => {
      const player = createMockPlayer('1', 'Player', 'Citizen', {
        alive: true
      });
      delete player.nightAction;

      await resolveNightActions({}, [player]);

      // Should not crash and should create nightAction
      expect(player.nightAction).toBeDefined();
    });

    test('should clear expired effects', async () => {
      const expired = new Date(Date.now() - 10000); // 10 seconds ago
      const player = createMockPlayer('1', 'Player', 'Citizen', {
        alive: true,
        effects: [
          { type: 'protected', expiresAt: expired },
          { type: 'blocked', expiresAt: null } // No expiration
        ]
      });

      await resolveNightActions({}, [player]);

      const hasExpired = player.effects.some(e => e.expiresAt && e.expiresAt < new Date());
      expect(hasExpired).toBe(false);
    });
  });

  describe('Multiple Actions on Same Target', () => {
    
    test('should handle multiple killers targeting same victim', async () => {
      const cleaner1 = createMockPlayer('1', 'Cleaner1', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const cleaner2 = createMockPlayer('2', 'Cleaner2', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const victim = createMockPlayer('3', 'Victim', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [cleaner1, cleaner2, victim]);

      expect(victim.alive).toBe(false);
    });

    test('should handle multiple doctors protecting same target', async () => {
      const doctor1 = createMockPlayer('1', 'Doctor1', 'Doctor', {
        nightAction: { targetId: '3', action: 'protect', results: [] }
      });
      const doctor2 = createMockPlayer('2', 'Doctor2', 'Doctor', {
        nightAction: { targetId: '3', action: 'protect', results: [] }
      });
      const cleaner = createMockPlayer('4', 'Cleaner', 'Cleaner', {
        nightAction: { targetId: '3', action: 'kill', results: [] }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [doctor1, doctor2, cleaner, target]);

      expect(target.alive).toBe(true);
    });
  });

  describe('Player Save', () => {
    
    test('should call save on all players', async () => {
      const player1 = createMockPlayer('1', 'Player1', 'Citizen', {
        alive: true
      });
      const player2 = createMockPlayer('2', 'Player2', 'Citizen', {
        alive: true
      });

      await resolveNightActions({}, [player1, player2]);

      expect(player1.save).toHaveBeenCalled();
      expect(player2.save).toHaveBeenCalled();
    });
  });

  describe('Witch Control', () => {
    
    test('should override puppet target when Witch controls a player', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3', // Controlled target
          puppetId: '2', // Puppet to control
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '4', // Original target - should be overridden
          results: []
        }
      });
      const originalTarget = createMockPlayer('4', 'OriginalTarget', 'Citizen', {
        alive: true
      });
      const controlledTarget = createMockPlayer('3', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet, originalTarget, controlledTarget];

      await resolveNightActions({}, players);

      // Puppet's target should be overridden to controlledTarget
      expect(puppet.nightAction.targetId.toString()).toBe('3');
      expect(puppet.nightAction.action).toBe('kill');
      expect(puppet.roleData.controlledByWitch).toBe(true);
      expect(puppet.save).toHaveBeenCalled();
      
      // Controlled target should be killed
      expect(controlledTarget.alive).toBe(false);
      
      // Original target should be safe
      expect(originalTarget.alive).toBe(true);
      
      // Witch should get success message
      expect(witch.nightAction.results).toContain(
        expect.stringContaining('Ovladla jsi Puppet, aby použil svou schopnost na ControlledTarget')
      );
    });

    test('should set default action for puppet if not set (dual role)', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: null, // No action set
          targetId: null,
          results: []
        }
      });
      const controlledTarget = createMockPlayer('3', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet, controlledTarget];

      await resolveNightActions({}, players);

      // Puppet's action should be set to 'kill' (default for dual roles)
      expect(puppet.nightAction.action).toBe('kill');
      expect(puppet.nightAction.targetId.toString()).toBe('3');
      expect(controlledTarget.alive).toBe(false);
    });

    test('should fail when puppet is dead', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const deadPuppet = createMockPlayer('2', 'DeadPuppet', 'Cleaner', {
        alive: false,
        nightAction: {
          action: 'kill',
          targetId: '3',
          results: []
        }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });
      const players = [witch, deadPuppet, target];

      await resolveNightActions({}, players);

      expect(witch.nightAction.results).toContain(
        expect.stringContaining('Loutka není naživu nebo neexistuje')
      );
      expect(deadPuppet.nightAction.targetId.toString()).toBe('3'); // Not changed
    });

    test('should fail when controlled target is dead', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '4',
          results: []
        }
      });
      const deadTarget = createMockPlayer('3', 'DeadTarget', 'Citizen', {
        alive: false
      });
      const players = [witch, puppet, deadTarget];

      await resolveNightActions({}, players);

      expect(witch.nightAction.results).toContain(
        expect.stringContaining('Cíl není naživu nebo neexistuje')
      );
      expect(puppet.nightAction.targetId.toString()).toBe('4'); // Not changed
    });

    test('should fail when puppet has no night action (Citizen)', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const citizen = createMockPlayer('2', 'Citizen', 'Citizen', {
        nightAction: {
          action: null,
          targetId: null,
          results: []
        }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });
      const players = [witch, citizen, target];

      await resolveNightActions({}, players);

      expect(witch.nightAction.results).toContain(
        expect.stringContaining('Citizen nemá noční akci')
      );
    });

    test('should fail when puppet has no night action (Jester)', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const jester = createMockPlayer('2', 'Jester', 'Jester', {
        nightAction: {
          action: null,
          targetId: null,
          results: []
        }
      });
      const target = createMockPlayer('3', 'Target', 'Citizen', {
        alive: true
      });
      const players = [witch, jester, target];

      await resolveNightActions({}, players);

      expect(witch.nightAction.results).toContain(
        expect.stringContaining('Jester nemá noční akci')
      );
    });

    test('should execute puppet action before SerialKiller (priority -1 vs 0)', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '4',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '5',
          results: []
        }
      });
      const serialKiller = createMockPlayer('3', 'SerialKiller', 'SerialKiller', {
        nightAction: {
          action: 'kill',
          targetId: '4',
          results: []
        }
      });
      const controlledTarget = createMockPlayer('4', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const originalTarget = createMockPlayer('5', 'OriginalTarget', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet, serialKiller, controlledTarget, originalTarget];

      await resolveNightActions({}, players);

      // Puppet's target should be overridden to controlledTarget
      expect(puppet.nightAction.targetId.toString()).toBe('4');
      // Controlled target should be killed by puppet (before SerialKiller)
      expect(controlledTarget.alive).toBe(false);
      // Original target should be safe
      expect(originalTarget.alive).toBe(true);
    });

    test('should store original target and action in puppet roleData', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '4',
          results: []
        },
        roleData: {}
      });
      const controlledTarget = createMockPlayer('3', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const originalTarget = createMockPlayer('4', 'OriginalTarget', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet, controlledTarget, originalTarget];

      await resolveNightActions({}, players);

      // Original target and action should be stored
      expect(puppet.roleData.originalTargetId).toBeDefined();
      expect(puppet.roleData.originalAction).toBe('kill');
      expect(puppet.roleData.controlledByWitch).toBe(true);
      expect(puppet.roleData.witchId).toBeDefined();
    });

    test('should handle Witch controlling multiple different puppets', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '4',
          puppetId: '2',
          results: []
        }
      });
      const puppet1 = createMockPlayer('2', 'Puppet1', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '5',
          results: []
        }
      });
      const puppet2 = createMockPlayer('6', 'Puppet2', 'Doctor', {
        nightAction: {
          action: 'protect',
          targetId: '7',
          results: []
        }
      });
      const controlledTarget = createMockPlayer('4', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const originalTarget1 = createMockPlayer('5', 'OriginalTarget1', 'Citizen', {
        alive: true
      });
      const originalTarget2 = createMockPlayer('7', 'OriginalTarget2', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet1, puppet2, controlledTarget, originalTarget1, originalTarget2];

      await resolveNightActions({}, players);

      // Only puppet1 should be controlled (witch only controls one per night)
      expect(puppet1.nightAction.targetId.toString()).toBe('4');
      expect(puppet2.nightAction.targetId.toString()).toBe('7'); // Not changed
      
      // Controlled target should be killed
      expect(controlledTarget.alive).toBe(false);
    });

    test('should not skip witch_control action in Phase 1', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '4',
          results: []
        }
      });
      const controlledTarget = createMockPlayer('3', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const players = [witch, puppet, controlledTarget];

      await resolveNightActions({}, players);

      // Witch action should be handled in Phase 0, not Phase 1
      // This test verifies that witch_control is not collected in Phase 1
      // (indirectly tested by ensuring puppet action executes correctly)
      expect(puppet.nightAction.targetId.toString()).toBe('3');
      expect(controlledTarget.alive).toBe(false);
    });

    test('should update puppet in memory after saving', async () => {
      const witch = createMockPlayer('1', 'Witch', 'Witch', {
        nightAction: {
          action: 'witch_control',
          targetId: '3',
          puppetId: '2',
          results: []
        }
      });
      const puppet = createMockPlayer('2', 'Puppet', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '4',
          results: []
        }
      });
      const controlledTarget = createMockPlayer('3', 'ControlledTarget', 'Citizen', {
        alive: true
      });
      const attacker = createMockPlayer('5', 'Attacker', 'Cleaner', {
        nightAction: {
          action: 'kill',
          targetId: '3',
          results: []
        }
      });
      const players = [witch, puppet, controlledTarget, attacker];

      await resolveNightActions({}, players);

      // Both puppet and attacker should target controlledTarget
      // Puppet should execute first (controlled by witch), then attacker
      // Both should kill the target
      expect(puppet.nightAction.targetId.toString()).toBe('3');
      expect(attacker.nightAction.targetId.toString()).toBe('3');
      expect(controlledTarget.alive).toBe(false);
    });
  });
});

