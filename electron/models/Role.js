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
  
  'Trapper': {
    team: 'good',
    description: 'Sets a trap; visitors are revealed and their action fails',
    actionType: 'trap',
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
    description: 'Může zabíjet v noci - pokud zabije nevinného, zemře',
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
  
  'Killer': {
    team: 'evil',
    description: 'Kills one player each night',
    actionType: 'kill',
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    hasLimitedUses: false,
    defaultAffiliations: ['evil'],
    defaultVictory: { 
      canWinWithTeams: ['evil'], 
      soloWin: false, 
      customRules: [] // ✅ Removed - uses victoryEvaluator logic
    }
  },
  
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
  
  'Paranoid': {
    emoji: '😱',
    description: 'Vidí falešné návštěvníky, kteří u něj nebyly',
    effect: 'paranoid',
    showToPlayer: false,
     allowedTeams: ['good', 'neutral'] 
  },
  
  'Insomniac': {
    emoji: '😵',
    description: 'Vidí všechny, kdo ho navštíví',
    effect: 'see_visitors',
    showToPlayer: false,
    allowedTeams: ['good', 'neutral'] 
  }
};

module.exports = { ROLES, MODIFIERS };
