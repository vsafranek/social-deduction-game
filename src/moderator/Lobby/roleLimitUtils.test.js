import {
  calculateTeamPoolSize,
  calculateTeamGuaranteedCount,
  canAddGuaranteedRole,
  canAddRandomRole
} from './roleLimitUtils';

describe('roleLimitUtils', () => {
  // Helper function
  const teamOf = (role) => {
    const teams = {
      'Investigator': 'good',
      'Coroner': 'good',
      'Hunter': 'good',
      'Mafia': 'evil',
      'SerialKiller': 'evil'
    };
    return teams[role] || 'good';
  };

  const roleKeys = ['Investigator', 'Coroner', 'Hunter', 'Mafia', 'SerialKiller'];

  describe('calculateTeamPoolSize', () => {
    it('should correctly calculate pool size for a team', () => {
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': 1,
        'Mafia': 1
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true,
        'Hunter': true,
        'Mafia': true,
        'SerialKiller': false
      };

      const poolSize = calculateTeamPoolSize(
        roleCount,
        randomPoolRoles,
        teamOf,
        roleKeys,
        'good'
      );

      expect(poolSize).toBe(4); // 2 + 1 + 1 = 4
    });

    it('should ignore inactive roles', () => {
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': false,
        'Hunter': true
      };

      const poolSize = calculateTeamPoolSize(
        roleCount,
        randomPoolRoles,
        teamOf,
        roleKeys,
        'good'
      );

      expect(poolSize).toBe(2); // only Investigator (Coroner is inactive)
    });

    it('should ignore roles with count 0', () => {
      const roleCount = {
        'Investigator': 2,
        'Coroner': 0,
        'Hunter': 1
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true,
        'Hunter': true
      };

      const poolSize = calculateTeamPoolSize(
        roleCount,
        randomPoolRoles,
        teamOf,
        roleKeys,
        'good'
      );

      expect(poolSize).toBe(3); // 2 + 0 + 1 = 3 (Coroner with count 0 is ignored)
    });
  });

  describe('calculateTeamGuaranteedCount', () => {
    it('should correctly count guaranteed roles for a team', () => {
      const guaranteedRoles = ['Investigator', 'Coroner', 'Mafia'];
      const count = calculateTeamGuaranteedCount(guaranteedRoles, teamOf, 'good');

      expect(count).toBe(2); // Investigator + Coroner
    });

    it('should return 0 if there are no guaranteed roles', () => {
      const guaranteedRoles = [];
      const count = calculateTeamGuaranteedCount(guaranteedRoles, teamOf, 'good');

      expect(count).toBe(0);
    });
  });

  describe('canAddGuaranteedRole', () => {
    describe('limit for individual role', () => {
      it('should allow adding if guaranteed count < poolCount', () => {
        const result = canAddGuaranteedRole({
          guaranteedCount: 1,
          poolCount: 2, // poolCount is already maxLimit or roleCount
          teamGuaranteedCount: 1,
          teamRandomCount: 2,
          teamPoolSize: 4
        });

        expect(result.canAddByRoleLimit).toBe(true); // 1 + 1 = 2 <= 2
        expect(result.maxGuaranteedAllowed).toBe(2);
      });

      it('should not allow adding if guaranteed count >= poolCount', () => {
        const result = canAddGuaranteedRole({
          guaranteedCount: 2,
          poolCount: 2,
          teamGuaranteedCount: 2,
          teamRandomCount: 2,
          teamPoolSize: 4
        });

        expect(result.canAddByRoleLimit).toBe(false); // 2 + 1 = 3 > 2
        expect(result.maxGuaranteedAllowed).toBe(2);
      });

      it('should respect poolCount (which is maxLimit)', () => {
        const result = canAddGuaranteedRole({
          guaranteedCount: 1,
          poolCount: 2, // poolCount is already maxLimit
          teamGuaranteedCount: 1,
          teamRandomCount: 2,
          teamPoolSize: 10
        });

        expect(result.canAddByRoleLimit).toBe(true); // 1 + 1 = 2 <= 2
        expect(result.maxGuaranteedAllowed).toBe(2);
      });
    });

    describe('pool limit for team', () => {
      it('should allow adding if guaranteed + random < pool size', () => {
        const result = canAddGuaranteedRole({
          guaranteedCount: 1,
          poolCount: 2,
          teamGuaranteedCount: 1, // 1 guaranteed
          teamRandomCount: 2, // 2 random
          teamPoolSize: 4 // pool = 4
        });

        expect(result.canAddByPoolLimit).toBe(true); // 1 + 1 + 2 = 4 <= 4
        expect(result.wouldBeTeamTotalAfterAdd).toBe(4);
      });

      it('should not allow adding if guaranteed + random >= pool size', () => {
        const result = canAddGuaranteedRole({
          guaranteedCount: 1,
          poolCount: 2,
          teamGuaranteedCount: 2, // 2 guaranteed
          teamRandomCount: 2, // 2 random
          teamPoolSize: 4 // pool = 4
        });

        expect(result.canAddByPoolLimit).toBe(false); // 2 + 1 + 2 = 5 > 4
        expect(result.wouldBeTeamTotalAfterAdd).toBe(5);
      });

      it('requirements example: 2 random, 1 guaranteed, pool=4, can add 1 guaranteed', () => {
        // Pool: 2x Investigator + 1x Coroner + 1x Hunter = 4
        // Random: 2
        // Guaranteed: 1x Coroner
        // Can add: 1x Investigator

        const result = canAddGuaranteedRole({
          guaranteedCount: 0, // no Investigator yet
          poolCount: 2, // Investigator has 2 in pool (maxLimit)
          teamGuaranteedCount: 1, // 1x Coroner guaranteed
          teamRandomCount: 2, // 2 random roles
          teamPoolSize: 4 // total pool = 4
        });

        expect(result.canAdd).toBe(true);
        expect(result.canAddByRoleLimit).toBe(true); // 0 + 1 = 1 <= 2
        expect(result.canAddByPoolLimit).toBe(true); // 1 + 1 + 2 = 4 <= 4
      });

      it('requirements example: after adding 1x Investigator, cannot add more', () => {
        // Pool: 4
        // Random: 2
        // Guaranteed: 1x Coroner + 1x Investigator
        // Total: 4, cannot add more

        const result = canAddGuaranteedRole({
          guaranteedCount: 1, // already 1x Investigator
          poolCount: 2,
          teamGuaranteedCount: 2, // 1x Coroner + 1x Investigator
          teamRandomCount: 2,
          teamPoolSize: 4
        });

        expect(result.canAdd).toBe(false);
        expect(result.canAddByRoleLimit).toBe(true); // 1 + 1 = 2 <= 2
        expect(result.canAddByPoolLimit).toBe(false); // 2 + 1 + 2 = 5 > 4
      });
    });
  });

  describe('canAddRandomRole', () => {
    it('should allow adding if random + guaranteed < pool size', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 2,
        teamGuaranteedCount: 1,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(true); // (2 + 1) = 3 <= 3, maxRandom = 3
      expect(result.maxRandomAllowed).toBe(3); // 4 - 1 = 3
      expect(result.wouldBeTotal).toBe(4); // 2 + 1 + 1 = 4
    });

    it('should not allow adding if random + guaranteed >= pool size', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 2,
        teamGuaranteedCount: 2,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(false); // (2 + 1) = 3 > 2, maxRandom = 2
      expect(result.maxRandomAllowed).toBe(2); // 4 - 2 = 2
      expect(result.wouldBeTotal).toBe(5); // 2 + 1 + 2 = 5 > 4
    });

    it('should allow adding if random + guaranteed = pool size - 1', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 2,
        teamGuaranteedCount: 1,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(true); // (2 + 1) = 3 <= 3
      expect(result.maxRandomAllowed).toBe(3); // 4 - 1 = 3
    });

    it('should not allow adding if random + guaranteed = pool size', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 3,
        teamGuaranteedCount: 1,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(false); // (3 + 1) = 4 > 3, maxRandom = 3
      expect(result.maxRandomAllowed).toBe(3); // 4 - 1 = 3
    });

    it('should correctly calculate maxRandomAllowed = pool - guaranteed', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 0,
        teamGuaranteedCount: 1,
        teamPoolSize: 4
      });

      expect(result.maxRandomAllowed).toBe(3); // 4 - 1 = 3
      expect(result.canAdd).toBe(true); // 0 < 3
    });

    it('should return 0 if guaranteed >= pool size', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 0,
        teamGuaranteedCount: 5,
        teamPoolSize: 4
      });

      expect(result.maxRandomAllowed).toBe(0); // Math.max(0, 4 - 5) = 0
      expect(result.canAdd).toBe(false); // 0 >= 0
    });

    it('requirements example: pool=4, guaranteed=0, random can be max 4', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 3,
        teamGuaranteedCount: 0,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(true); // 3 < 4
      expect(result.maxRandomAllowed).toBe(4);
    });

    it('requirements example: pool=4, guaranteed=1, random can be max 3', () => {
      const result = canAddRandomRole({
        currentTeamRandomCount: 3,
        teamGuaranteedCount: 1,
        teamPoolSize: 4
      });

      expect(result.canAdd).toBe(false); // 3 >= 3
      expect(result.maxRandomAllowed).toBe(3); // 4 - 1 = 3
    });

    it('requirements example: pool=4, can set 2 random + 2 guaranteed = 4', () => {
      // Pool size = 4 (2 roles, each with limit 2)
      // Should be possible to set: 2 random + 2 guaranteed = 4
      
      // Step 1: Setting 2 random
      const result1 = canAddRandomRole({
        currentTeamRandomCount: 1,
        teamGuaranteedCount: 0,
        teamPoolSize: 4
      });
      expect(result1.canAdd).toBe(true); // 1 < 4
      
      const result2 = canAddRandomRole({
        currentTeamRandomCount: 2,
        teamGuaranteedCount: 0,
        teamPoolSize: 4
      });
      expect(result2.canAdd).toBe(true); // 2 < 4

      // Step 2: With 2 random, can we add 2 guaranteed?
      // Test: can we add first guaranteed?
      const result3 = canAddGuaranteedRole({
        guaranteedCount: 0,
        poolCount: 2,
        teamGuaranteedCount: 0,
        teamRandomCount: 2,
        teamPoolSize: 4
      });
      expect(result3.canAdd).toBe(true);
      expect(result3.canAddByPoolLimit).toBe(true); // (0 + 1) + 2 = 3 <= 4

      // Test: can we add second guaranteed (to reach 2 guaranteed)?
      const result4 = canAddGuaranteedRole({
        guaranteedCount: 1,
        poolCount: 2,
        teamGuaranteedCount: 1,
        teamRandomCount: 2,
        teamPoolSize: 4
      });
      expect(result4.canAdd).toBe(true);
      expect(result4.canAddByPoolLimit).toBe(true); // (1 + 1) + 2 = 4 <= 4 ✓

      // Test: with 2 random + 2 guaranteed, cannot add more random
      const result5 = canAddRandomRole({
        currentTeamRandomCount: 2,
        teamGuaranteedCount: 2,
        teamPoolSize: 4
      });
      expect(result5.canAdd).toBe(false); // 2 >= (4 - 2) = 2
      expect(result5.maxRandomAllowed).toBe(2); // 4 - 2 = 2

      // Test: with 2 random + 2 guaranteed, cannot add more guaranteed
      const result6 = canAddGuaranteedRole({
        guaranteedCount: 2,
        poolCount: 2,
        teamGuaranteedCount: 2,
        teamRandomCount: 2,
        teamPoolSize: 4
      });
      expect(result6.canAdd).toBe(false);
      expect(result6.canAddByPoolLimit).toBe(false); // (2 + 1) + 2 = 5 > 4
    });
  });
});

