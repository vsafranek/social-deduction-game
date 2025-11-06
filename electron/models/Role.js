const ROLES = {
  // Town (Good)
  'Doctor': {
    team: 'good',
    emoji: '💉',
    description: 'Protects one player each night from death',
    actionType: 'protect',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Jailer': {
    team: 'good',
    emoji: '👮',
    description: 'Locks a player each night; the target cannot act',
    actionType: 'block',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Investigator': {
    team: 'good',
    emoji: '🔍',
    description: 'Learns two possible roles of the target each night (one is correct)',
    actionType: 'investigate',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Lookout': {
    team: 'good',
    emoji: '👁️',
    description: 'Watches a house and sees who visited the target',
    actionType: 'watch',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Trapper': {
    team: 'good',
    emoji: '🪤',
    description: 'Sets a trap; visitors are revealed and their action fails',
    actionType: 'trap',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Tracker': {
    team: 'good',
    emoji: '👣',
    description: 'Follows the target and learns whom they visited',
    actionType: 'track',
    canUseEveryNight: true,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },
  'Citizen': {
    team: 'good',
    emoji: '👤',
    description: 'No special ability',
    actionType: 'none',
    canUseEveryNight: false,
    defaultAffiliations: ['good'],
    defaultVictory: { canWinWithTeams: ['good'], soloWin: false, customRules: [] }
  },

  // Mafia (Evil)
  'Killer': {
    team: 'evil',
    emoji: '🔪',
    description: 'Kills one player each night',
    actionType: 'kill',
    canUseEveryNight: true,
    defaultAffiliations: ['evil'],
    defaultVictory: { canWinWithTeams: ['evil'], soloWin: false, customRules: [
      { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
    ] }
  },
  'Cleaner': {
    team: 'evil',
    emoji: '🧹',
    description: "Kills and hides the victim's role",
    actionType: 'clean_kill',
    canUseEveryNight: true,
    defaultAffiliations: ['evil'],
    defaultVictory: { canWinWithTeams: ['evil'], soloWin: false, customRules: [
      { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
    ] }
  },
  'Framer': {
    team: 'evil',
    emoji: '🖼️',
    description: 'Makes a player appear as evil to investigations',
    actionType: 'frame',
    canUseEveryNight: true,
    defaultAffiliations: ['evil'],
    defaultVictory: { canWinWithTeams: ['evil'], soloWin: false, customRules: [
      { type: 'parity', team: 'evil', against: 'good', comparator: '>=' }
    ] }
  },

  // Neutral
  'Diplomat': {
    team: 'neutral',
    emoji: '🕊️',
    description: 'May win with either side',
    actionType: 'none',
    canUseEveryNight: false,
    defaultAffiliations: ['neutral'],
    defaultVictory: { canWinWithTeams: ['good','evil'], soloWin: false, customRules: [] }
  },
  'Survivor': {
    team: 'neutral',
    emoji: '🛡️',
    description: 'Aims to survive alone',
    actionType: 'none',
    canUseEveryNight: false,
    defaultAffiliations: ['neutral','solo'],
    defaultVictory: { canWinWithTeams: [], soloWin: true, customRules: [
      { type: 'aliveExactly', team: 'neutral', count: 1 },
      { type: 'aliveExactly', team: 'good', count: 0 },
      { type: 'aliveExactly', team: 'evil', count: 0 }
    ] }
  },
  'Infected': {
    team: 'neutral',
    emoji: '🦠',
    description: 'Visits players at night to infect them; wins when all others are infected',
    actionType: 'infect',
    canUseEveryNight: true,
    defaultAffiliations: ['neutral'],
    defaultVictory: {
      canWinWithTeams: [],
      soloWin: false,
      customRules: [
        { type: 'allOthersHaveEffect', effect: 'infected', negate: false }
      ]
    }
  }  // ← OPRAVENO: chyběly uzavírací závorky
};

const MODIFIERS = {
  'Drunk': {
    emoji: '🍺',
    description: '50% chance the ability fails or returns false info',
    effect: 'random_fail',
    showToPlayer: false
  },
  'Recluse': {
    emoji: '🏚️',
    description: 'Appears as evil to investigations even if good',
    effect: 'appears_evil',
    showToPlayer: false
  }
};

module.exports = { ROLES, MODIFIERS };
