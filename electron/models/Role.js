// electron/models/Role.js

const ROLES = {
  // ==================
  // TOWN (Good)
  // ==================

  'Doctor': {
    team: 'good',
    description: 'Protects one player each night from death',
    actionType: 'protect',
    nightPriority: 9,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Jailer': {
    team: 'good',
    description: 'Locks a player each night; the target cannot act',
    actionType: 'block',
    nightPriority: 2,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Investigator': {
    team: 'good',
    description: 'Learns two possible roles of the target each night (one is correct). Can only investigate alive players.',
    actionType: 'investigate',
    nightPriority: 5,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Coroner': {
    team: 'good',
    description: 'Can examine a dead player to learn their exact role. Cannot examine cleaned roles.',
    actionType: 'autopsy',
    nightPriority: 6,
    canUseEveryNight: true,
    visitsTarget: false, // Targets dead players, doesn't visit them
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Lookout': {
    team: 'good',
    description: 'Watches a house and sees who visited the target',
    actionType: 'watch',
    nightPriority: 4,
    canUseEveryNight: true,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Guardian': {
    team: 'good',
    description: 'Guards a player; visitors are revealed and their action fails',
    actionType: 'guard',
    nightPriority: 3,
    canUseEveryNight: true,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Tracker': {
    team: 'good',
    description: 'Follows the target and learns whom they visited',
    actionType: 'track',
    nightPriority: 4,
    canUseEveryNight: true,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Hunter': {
    team: 'good',
    description: 'Can kill at night - if kills an innocent, dies from guilt',
    actionType: 'hunter_kill',
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Citizen': {
    team: 'good',
    description: 'No special ability',
    actionType: 'none',
    nightPriority: 0,
    canUseEveryNight: false,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },



  // ==================
  // MAFIA (Evil)
  // ==================

  'Cleaner': {
    team: 'evil',
    description: 'Can kill OR mark players for cleaning. Marked alive players show fake investigation results. Dead marked players have hidden roles (3 uses per game)',
    actionType: 'dual',
    dualActions: ['kill', 'clean_role'],
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    hasLimitedUses: true,
    maxUses: 3,
    defaultAffiliations: ['evil'],
    defaultVictory: {
      canWinWithTeams: ['evil'],
      soloWin: false,
      customRules: [] // ✅ Removed - uses victoryEvaluator logic
    }
  },

  'Accuser': {
    team: 'evil',
    description: 'Can kill OR frame a player to appear as evil during investigation (3 uses per game)',
    actionType: 'dual',
    dualActions: ['kill', 'frame'],
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    hasLimitedUses: true,
    maxUses: 3,
    defaultAffiliations: ['evil'],
    defaultVictory: {
      canWinWithTeams: ['evil'],
      soloWin: false,
      customRules: [] // ✅ Removed - uses victoryEvaluator logic
    }
  },

  'Consigliere': {
    team: 'evil',
    description: 'Can kill OR investigate a player to learn their exact role. Can only investigate alive players (3 uses per game)',
    actionType: 'dual',
    dualActions: ['kill', 'consig_investigate'],
    nightPriority: 5,
    canUseEveryNight: true,
    visitsTarget: true,
    hasLimitedUses: true,
    maxUses: 3,
    defaultAffiliations: ['evil'],
    defaultVictory: {
      canWinWithTeams: ['evil'],
      soloWin: false,
      customRules: [] // ✅ Removed - uses victoryEvaluator logic
    }
  },

  'Poisoner': {
    team: 'evil',
    description: 'Can poison players - poisoned player dies the next day but can be healed by Doctor. Has a strong poison (once per game) that activates only after Doctor visits and cannot be healed.',
    actionType: 'dual',
    dualActions: ['poison', 'strong_poison'],
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    hasLimitedUses: true,
    maxUses: 1, // Only strong_poison has limited uses
    defaultAffiliations: ['evil'],
    defaultVictory: {
      canWinWithTeams: ['evil'],
      soloWin: false,
      customRules: []
    }
  },

  // ==================
  // NEUTRAL
  // ==================

  'SerialKiller': {
    team: 'neutral',
    description: 'Serial killer - aims to survive alone',
    actionType: 'kill',
    nightPriority: 0,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['neutral', 'solo'],
    defaultVictory: {
      canWinWithTeams: [],
      soloWin: true,
      customRules: [
        { type: 'aliveExactly', team: 'neutral', count: 1 },
        { type: 'aliveExactly', team: 'good', count: 0 },
        { type: 'aliveExactly', team: 'evil', count: 0 }
      ]
    }
  },

  'Infected': {
    team: 'neutral',
    description: 'Visits players at night to infect them; wins when all others are infected',
    actionType: 'infect',
    nightPriority: 6,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['neutral'],
    defaultVictory: {
      canWinWithTeams: [],
      soloWin: false,
      customRules: [
        { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
      ]
    }
  },

  'Jester': {
    team: 'neutral',
    description: 'Wins if executed by vote. Game ends immediately when Jester is executed.',
    actionType: null, // No night action
    nightPriority: null,
    canUseEveryNight: false,
    visitsTarget: false,
    defaultAffiliations: ['neutral', 'solo'],
    defaultVictory: {
      canWinWithTeams: [],
      soloWin: true,
      customRules: [] // Special win condition handled in votingResolver
    }
  },

  'Witch': {
    team: 'neutral',
    description: 'Survive until the end. Controls a player - forces them to use their ability on your chosen target. Acts before SerialKiller.',
    actionType: 'witch_control',
    nightPriority: -1, // Before SerialKiller (0)
    canUseEveryNight: true,
    visitsTarget: false, // Doesn't visit, controls others
    defaultAffiliations: ['neutral'],
    defaultVictory: {
      canWinWithTeams: ['good', 'evil'], // Wins with whoever survives
      soloWin: false,
      customRules: [] // Just needs to survive
    }
  }
};

const MODIFIERS = {
  'Drunk': {
    emoji: '🍺',
    description: 'He stays home and gets fake event results',
    effect: 'random_fail',
    showToPlayer: false,
    allowedTeams: ['good', 'neutral']
  },

  'Shady': {
    emoji: '🏚️',
    description: 'Appears as evil to investigations even if good',
    effect: 'appears_evil',
    showToPlayer: false,
    allowedTeams: ['good']
  },

  'Innocent': {
    emoji: '😇',
    description: 'Appears as good or neutral to investigations even if evil',
    effect: 'appears_good',
    showToPlayer: false,
    allowedTeams: ['evil']
  },

  'Paranoid': {
    emoji: '😱',
    description: 'Sees fake visitors who were not actually there',
    effect: 'paranoid',
    showToPlayer: false,
    allowedTeams: ['good', 'neutral']
  },

  'Insomniac': {
    emoji: '😵',
    description: 'Sees everyone who visits them',
    effect: 'see_visitors',
    showToPlayer: false,
    allowedTeams: ['good', 'neutral']
  },


};

module.exports = { ROLES, MODIFIERS };
