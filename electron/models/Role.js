// electron/models/Role.js

const ROLES = {
  // Town (Good)
  'Doctor': {
    team: 'good',
    emoji: '💉',
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
    emoji: '👮',
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
    emoji: '🔍',
    description: 'Learns two possible roles of the target each night (one is correct)',
    actionType: 'investigate',
    nightPriority: 5,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Lookout': {
    team: 'good',
    emoji: '👁️',
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
    emoji: '🪤',
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
    emoji: '👣',
    description: 'Follows the target and learns whom they visited',
    actionType: 'track',
    nightPriority: 4,
    canUseEveryNight: true,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Citizen': {
    team: 'good',
    emoji: '👤',
    description: 'No special ability',
    actionType: 'none',
    nightPriority: 0,
    canUseEveryNight: false,
    visitsTarget: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  // Mafia (Evil)
  'Killer': {
    team: 'evil',
    emoji: '🔪',
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
      customRules: [
        { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
      ] 
    }
  },
  'Cleaner': {
    team: 'evil',
    emoji: '🧹',
    description: 'Může zabíjet NEBO vyčistit roli mrtvého (3 cleaningy za hru)',
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
      customRules: [
        { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
      ] 
    }
  },
  'Framer': {
    team: 'evil',
    emoji: '🖼️',
    description: 'Může zabíjet NEBO zarámovat hráče (3 framy za hru)',
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
      customRules: [
        { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
      ] 
    }
  },

  // Neutral
  'Diplomat': {
    team: 'neutral',
    emoji: '🕊️',
    description: 'May win with either side',
    actionType: 'none',
    nightPriority: 0,
    canUseEveryNight: false,
    visitsTarget: false,
    defaultAffiliations: ['neutral'],
    defaultVictory: { canWinWithTeams: ['good','evil'], soloWin: false, customRules: [] }
  },
  'Survivor': {
    team: 'neutral',
    emoji: '🛡️',
    description: 'Serial killer - aims to survive alone',
    actionType: 'kill',
    nightPriority: 1,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['neutral','solo'],
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
    emoji: '🦠',
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
  'Hunter': {
    team: 'good',
    emoji: '🏹',
    description: 'Může zabíjet v noci - pokud zabije nevinného, zemře',
    actionType: 'hunter_kill',
    nightPriority: 7,
    canUseEveryNight: true,
    visitsTarget: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  'Consigliere': {
    team: 'evil',
    emoji: '🕵️',
    description: 'Může zabíjet NEBO vyšetřit přesnou roli (3 investigate za hru)',
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
      customRules: [
        { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
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
    allowedTeams: ['good']
  },
  'Recluse': {
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
    allowedTeams: ['good'] 
  },
  
  'Insomniac': {
    emoji: '😵',
    description: 'Vidí všechny, kdo ho navštíví',
    effect: 'see_visitors',
    showToPlayer: true, 
    allowedTeams: ['good', 'neutral']
  }
};

module.exports = { ROLES, MODIFIERS };
