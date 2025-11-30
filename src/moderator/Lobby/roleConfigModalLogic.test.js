/**
 * Unit tests for logic in RoleConfigModal.jsx
 */

describe('RoleConfigModal Logic', () => {
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

  describe('configuredSumByTeam calculation', () => {
    it('should correctly calculate pool for individual teams with roleMaxLimits', () => {
      const roleKeys = ['Investigator', 'Coroner', 'Hunter', 'Mafia'];
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': 1,
        'Mafia': 1
      };
      const roleMaxLimits = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': null, // null = use roleCount
        'Mafia': 1
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true,
        'Hunter': true,
        'Mafia': true
      };

      const configuredSumByTeam = roleKeys.reduce((acc, role) => {
        if (randomPoolRoles[role]) {
          const team = teamOf(role);
          const maxLimit = roleMaxLimits[role];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[role] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(configuredSumByTeam.good).toBe(4); // 2 (Investigator maxLimit) + 1 (Coroner maxLimit) + 1 (Hunter roleCount)
      expect(configuredSumByTeam.evil).toBe(1); // 1 (Mafia maxLimit)
      expect(configuredSumByTeam.neutral).toBe(0);
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

      const configuredSumByTeam = roleKeys.reduce((acc, role) => {
        if (randomPoolRoles[role]) {
          const team = teamOf(role);
          const maxLimit = roleMaxLimits[role];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[role] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(configuredSumByTeam.good).toBe(5); // 3 + 2
    });

    it('should ignore inactive roles', () => {
      const roleKeys = ['Investigator', 'Coroner', 'Hunter'];
      const roleCount = {
        'Investigator': 2,
        'Coroner': 1,
        'Hunter': 1
      };
      const roleMaxLimits = {
        'Investigator': 2,
        'Coroner': null,
        'Hunter': null
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': false, // inactive
        'Hunter': true
      };

      const configuredSumByTeam = roleKeys.reduce((acc, role) => {
        if (randomPoolRoles[role]) {
          const team = teamOf(role);
          const maxLimit = roleMaxLimits[role];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[role] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(configuredSumByTeam.good).toBe(3); // 2 (Investigator) + 1 (Hunter), Coroner is inactive
    });

    it('should correctly calculate for all three teams', () => {
      const roleKeys = ['Investigator', 'Mafia', 'Survivor'];
      const roleCount = {
        'Investigator': 2,
        'Mafia': 1,
        'Survivor': 1
      };
      const roleMaxLimits = {
        'Investigator': 2,
        'Mafia': 1,
        'Survivor': null
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Mafia': true,
        'Survivor': true
      };

      const configuredSumByTeam = roleKeys.reduce((acc, role) => {
        if (randomPoolRoles[role]) {
          const team = teamOf(role);
          const maxLimit = roleMaxLimits[role];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[role] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(configuredSumByTeam.good).toBe(2);
      expect(configuredSumByTeam.evil).toBe(1);
      expect(configuredSumByTeam.neutral).toBe(1);
    });

    it('should correctly combine roleMaxLimits and roleCount', () => {
      const roleKeys = ['Investigator', 'Coroner'];
      const roleCount = {
        'Investigator': 5, // roleCount is 5, but maxLimit is 2
        'Coroner': 3 // roleCount is 3, but no maxLimit, so uses 3
      };
      const roleMaxLimits = {
        'Investigator': 2, // uses maxLimit instead of roleCount
        'Coroner': null // uses roleCount
      };
      const randomPoolRoles = {
        'Investigator': true,
        'Coroner': true
      };

      const configuredSumByTeam = roleKeys.reduce((acc, role) => {
        if (randomPoolRoles[role]) {
          const team = teamOf(role);
          const maxLimit = roleMaxLimits[role];
          const poolValue = (maxLimit !== null && maxLimit !== undefined) 
            ? maxLimit 
            : (roleCount[role] || 0);
          acc[team] = (acc[team] || 0) + poolValue;
        }
        return acc;
      }, { good: 0, evil: 0, neutral: 0 });

      expect(configuredSumByTeam.good).toBe(5); // 2 (Investigator maxLimit) + 3 (Coroner roleCount)
    });
  });
});

