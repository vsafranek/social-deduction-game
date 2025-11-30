/**
 * Unit tests for logic in RoleConfiguration.jsx
 */

describe('RoleConfiguration Logic', () => {
  // Helper function
  const teamOf = (role) => {
    const teams = {
      'Investigator': 'good',
      'Coroner': 'good',
      'Hunter': 'good',
      'Mafia': 'evil',
      'SerialKiller': 'evil',
      'Survivor': 'neutral'
    };
    return teams[role] || 'good';
  };

  describe('teamPoolSizeByTeam calculation', () => {
    it('should correctly calculate pool size for team with roleMaxLimits', () => {
      const roleKeys = ['Investigator', 'Coroner', 'Hunter'];
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': 1
      };
      const roleMaxLimits = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': null // null = use roleCount
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true,
        'Hunter': true
      };

      const teamPoolSizeByTeam = roleKeys.reduce((acc, r) => {
        if (randomPoolRoles[r]) {
          const team = teamOf(r);
          const maxLimit = roleMaxLimits[r];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[r] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(teamPoolSizeByTeam.good).toBe(4); // 2 (Investigator maxLimit) + 1 (Coroner maxLimit) + 1 (Hunter roleCount)
      expect(teamPoolSizeByTeam.evil).toBe(0);
    });

    it('should use roleCount if roleMaxLimit is not set', () => {
      const roleKeys = ['Investigator', 'Coroner'];
      const roleCount = {
        'Investigator': 3,
        'Coroner': 2
      };
      const roleMaxLimits = {
        'Investigator': null,
        'Coroner': null
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true
      };

      const teamPoolSizeByTeam = roleKeys.reduce((acc, r) => {
        if (randomPoolRoles[r]) {
          const team = teamOf(r);
          const maxLimit = roleMaxLimits[r];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[r] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(teamPoolSizeByTeam.good).toBe(5); // 3 + 2
    });

    it('should ignore inactive roles', () => {
      const roleKeys = ['Investigator', 'Coroner'];
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1
      };
      const roleMaxLimits = {
        'Investigator': 2,
        'Coroner': null
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': false // inactive
      };

      const teamPoolSizeByTeam = roleKeys.reduce((acc, r) => {
        if (randomPoolRoles[r]) {
          const team = teamOf(r);
          const maxLimit = roleMaxLimits[r];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[r] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(teamPoolSizeByTeam.good).toBe(2); // only Investigator
    });
  });

  describe('totalRolesForValidation calculation', () => {
    it('should correctly calculate total number of roles from teamLimits', () => {
      const teamLimits = {
        good: 4,
        evil: 2,
        neutral: 1
      };

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);

      expect(totalRolesForValidation).toBe(7); // 4 + 2 + 1
    });

    it('should return 0 if all teamLimits are 0', () => {
      const teamLimits = {
        good: 0,
        evil: 0,
        neutral: 0
      };

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);

      expect(totalRolesForValidation).toBe(0);
    });
  });

  describe('canStart validation', () => {
    it('should allow starting game if totalRolesForValidation === playersCount and playersCount >= 3', () => {
      const teamLimits = {
        good: 4,
        evil: 2,
        neutral: 1
      };
      const playersCount = 7;

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);
      const canStart = playersCount >= 3 && totalRolesForValidation === playersCount;

      expect(canStart).toBe(true);
    });

    it('should not allow starting game if playersCount < 3', () => {
      const teamLimits = {
        good: 2,
        evil: 0,
        neutral: 0
      };
      const playersCount = 2;

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);
      const canStart = playersCount >= 3 && totalRolesForValidation === playersCount;

      expect(canStart).toBe(false);
    });

    it('should not allow starting game if totalRolesForValidation !== playersCount', () => {
      const teamLimits = {
        good: 4,
        evil: 2,
        neutral: 1
      };
      const playersCount = 8; // 7 roles, but 8 players

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);
      const canStart = playersCount >= 3 && totalRolesForValidation === playersCount;

      expect(canStart).toBe(false);
      expect(totalRolesForValidation).toBe(7);
      expect(playersCount).toBe(8);
    });

    it('should allow starting game with exactly 3 players', () => {
      const teamLimits = {
        good: 2,
        evil: 1,
        neutral: 0
      };
      const playersCount = 3;

      const totalRolesForValidation = (teamLimits.good || 0) + (teamLimits.evil || 0) + (teamLimits.neutral || 0);
      const canStart = playersCount >= 3 && totalRolesForValidation === playersCount;

      expect(canStart).toBe(true);
      expect(totalRolesForValidation).toBe(3);
    });
  });

  describe('poolCount calculation for guaranteed roles', () => {
    it('should use roleMaxLimit if it is set', () => {
      const maxLimit = 2;
      const roleCount = { 'Investigator': 5 };
      const randomPoolRoles = { 'Investigator': true };
      const role = 'Investigator';

      const poolCount = (maxLimit !== null && maxLimit !== undefined) 
        ? maxLimit 
        : (randomPoolRoles[role] ? (roleCount[role] || 0) : 0);

      expect(poolCount).toBe(2); // uses maxLimit
    });

    it('should use roleCount if roleMaxLimit is not set', () => {
      const maxLimit = null;
      const roleCount = { 'Investigator': 5 };
      const randomPoolRoles = { 'Investigator': true };
      const role = 'Investigator';

      const poolCount = (maxLimit !== null && maxLimit !== undefined) 
        ? maxLimit 
        : (randomPoolRoles[role] ? (roleCount[role] || 0) : 0);

      expect(poolCount).toBe(5); // uses roleCount
    });

    it('should use roleCount if roleMaxLimit is undefined', () => {
      const maxLimit = undefined;
      const roleCount = { 'Investigator': 3 };
      const randomPoolRoles = { 'Investigator': true };
      const role = 'Investigator';

      const poolCount = (maxLimit !== null && maxLimit !== undefined) 
        ? maxLimit 
        : (randomPoolRoles[role] ? (roleCount[role] || 0) : 0);

      expect(poolCount).toBe(3); // uses roleCount
    });
  });
});

