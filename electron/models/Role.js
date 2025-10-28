// electron/models/Role.js - Definice všech rolí
const ROLES = {
  // 🟢 DOBRÉ ROLE
  'Doktor': {
    team: 'good',
    emoji: '💉',
    description: 'Každou noc chrání jednoho hráče před smrtí',
    actionType: 'protect',
    canUseEveryNight: true
  },
  'Policie': {
    team: 'good',
    emoji: '👮',
    description: 'Každou noc uzamkne hráče - nemůže použít schopnost',
    actionType: 'block',
    canUseEveryNight: true
  },
  'Vyšetřovatel': {
    team: 'good',
    emoji: '🔍',
    description: 'Každou noc zjistí 2 možné role hráče',
    actionType: 'investigate',
    canUseEveryNight: true
  },
  'Pozorovatel': {
    team: 'good',
    emoji: '👁️',
    description: 'Každou noc vidí kdo navštívil vybraný dům',
    actionType: 'watch',
    canUseEveryNight: true
  },
  'Pastičkář': {
    team: 'good',
    emoji: '🪤',
    description: 'Každou noc nastraží past - chytí návštěvníky',
    actionType: 'trap',
    canUseEveryNight: true
  },
  'Stopař': {
    team: 'good',
    emoji: '👣',
    description: 'Každou noc sleduje hráče a zjistí koho navštívil',
    actionType: 'track',
    canUseEveryNight: true
  },
  'Občan': {
    team: 'good',
    emoji: '👤',
    description: 'Nemá speciální schopnost',
    actionType: 'none',
    canUseEveryNight: false
  },
  
  // 🔴 ZLÉ ROLE
  'Vrah': {
    team: 'evil',
    emoji: '🔪',
    description: 'Každou noc zabije jednoho hráče',
    actionType: 'kill',
    canUseEveryNight: true
  },
  'Uklízeč': {
    team: 'evil',
    emoji: '🧹',
    description: 'Zabije hráče a skryje jeho roli',
    actionType: 'clean_kill',
    canUseEveryNight: true
  },
  'Falšovač': {
    team: 'evil',
    emoji: '🖼️',
    description: 'Označí hráče aby vypadal jako zlý',
    actionType: 'frame',
    canUseEveryNight: true
  }
};

// 🟡 PASIVNÍ MODIFIKÁTORY (skryté před hráčem)
const MODIFIERS = {
  'Opilý': {
    emoji: '🍺',
    description: 'Jeho schopnost má 50% šanci nefungovat',
    effect: 'random_fail',
    showToPlayer: false
  },
  'Poustevník': {
    emoji: '🏚️',
    description: 'Vypadá jako zlý při vyšetřování',
    effect: 'appears_evil',
    showToPlayer: false
  }
};

module.exports = { ROLES, MODIFIERS };
