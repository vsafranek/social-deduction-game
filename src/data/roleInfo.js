// src/data/roleInfo.js
// Centralized role information for the entire application

export const ROLE_INFO = {
  // ==================
  // TOWN (Good)
  // ==================
  'Doctor': {
    emoji: '💉',
    team: 'good',
    teamLabel: 'Město',
    description: 'Každou noc chráníš jednoho hráče před smrtí',
    actionVerb: 'Chránit',
    nightAction: {
      verb: 'Chraň',
      icon: '💉',
      color: 'green',
      description: 'Chraň jednoho hráče'
    }
  },
  'Jailer': {
    emoji: '👮',
    team: 'good',
    teamLabel: 'Město',
    description: 'Každou noc uzamkneš jednoho hráče - nemůže provést akci',
    actionVerb: 'Uzamknout',
    nightAction: {
      verb: 'Uzamkni',
      icon: '👮',
      color: 'blue',
      description: 'Uzamkni jednoho hráče'
    }
  },
  'Investigator': {
    emoji: '🔍',
    team: 'good',
    teamLabel: 'Město',
    description: 'Zjišťuješ dvě možné role živého hráče (jedna je správná)',
    actionVerb: 'Vyšetřit',
    nightAction: {
      verb: 'Vyšetři',
      icon: '🔍',
      color: 'blue',
      description: 'Vyšetři jednoho živého hráče'
    }
  },
  'Coroner': {
    emoji: '🔬',
    team: 'good',
    teamLabel: 'Město',
    description: 'Provedeš pitvu na mrtvém hráči a zjistíš jeho přesnou roli',
    actionVerb: 'Proveď pitvu',
    nightAction: {
      verb: 'Proveď pitvu',
      icon: '🔬',
      color: 'blue',
      description: 'Proveď pitvu na mrtvém hráči - zjistíš přesnou roli'
    }
  },
  'Lookout': {
    emoji: '👁️',
    team: 'good',
    teamLabel: 'Město',
    description: 'Sleduj dům hráče a uvidíš, kdo ho navštívil',
    actionVerb: 'Pozorovat',
    nightAction: {
      verb: 'Pozoruj',
      icon: '👁️',
      color: 'blue',
      description: 'Pozoruj jednoho hráče'
    }
  },
  'Guardian': {
    emoji: '🛡️',
    team: 'good',
    teamLabel: 'Město',
    description: 'Nastav stráž u domu jiného hráče - návštěvníci jsou odhaleni a zastaveni',
    actionVerb: 'Nastavit stráž',
    nightAction: {
      verb: 'Nastav Stráž',
      icon: '🛡️',
      color: 'green',
      description: 'Nastav stráž u domu jiného hráče'
    }
  },
  'Tracker': {
    emoji: '👣',
    team: 'good',
    teamLabel: 'Město',
    description: 'Sleduj hráče a zjisti, kam šel',
    actionVerb: 'Sledovat',
    nightAction: {
      verb: 'Sleduj',
      icon: '👣',
      color: 'blue',
      description: 'Sleduj jednoho hráče'
    }
  },
  'Hunter': {
    emoji: '🏹',
    team: 'good',
    teamLabel: 'Město',
    description: 'Můžeš zabíjet v noci - pokud zabiješ nevinného, zemřeš',
    actionVerb: 'Zastřelit',
    nightAction: {
      verb: 'Zastřel',
      icon: '🏹',
      color: 'red',
      description: 'Zastřel jednoho hráče'
    }
  },
  'Citizen': {
    emoji: '👤',
    team: 'good',
    teamLabel: 'Město',
    description: 'Obyčejný občan bez speciální schopnosti',
    actionVerb: 'Žádná'
  },


  // ==================
  // MAFIA (Evil)
  // ==================
  'Cleaner': {
    emoji: '🧹',
    team: 'evil',
    teamLabel: 'Mafie',
    description: 'Můžeš zabíjet NEBO označit hráče - označený živý hráč ukáže Investigator falešný výsledek, mrtvý hráč bude mít skrytou roli',
    actionVerb: 'Zabít nebo označit',
    nightAction: {
      dual: true,
      actions: {
        'kill': {
          verb: 'Zabiš',
          icon: '🔪',
          color: 'red',
          description: 'Zabiš jednoho hráče'
        },
        'clean_role': {
          verb: 'Označ',
          icon: '🧹',
          color: 'purple',
          description: 'Označ hráče - živý ukáže Investigator falešný výsledek, mrtvý bude mít skrytou roli'
        }
      }
    }
  },
  'Accuser': {
    emoji: '👉',
    team: 'evil',
    teamLabel: 'Mafie',
    description: 'Můžeš zabíjet NEBO obviňovat hráče - obviněný hráč bude vypadat jako zločinec při vyšetřování',
    actionVerb: 'Zabít nebo obviňovat',
    nightAction: {
      dual: true,
      actions: {
        'kill': {
          verb: 'Zabiš',
          icon: '🔪',
          color: 'red',
          description: 'Zabiš jednoho hráče'
        },
        'frame': {
          verb: 'Obviň',
          icon: '👉',
          color: 'purple',
          description: 'Obviň hráče - bude vypadat jako zločinec při vyšetřování'
        }
      }
    }
  },
  'Consigliere': {
    emoji: '🕵️',
    team: 'evil',
    teamLabel: 'Mafie',
    description: 'Můžeš zabíjet NEBO vyšetřit živého hráče a zjistit jeho přesnou roli',
    actionVerb: 'Zabít nebo vyšetřit',
    nightAction: {
      dual: true,
      actions: {
        'kill': {
          verb: 'Zabiš',
          icon: '🔪',
          color: 'red',
          description: 'Zabiš jednoho hráče'
        },
        'consig_investigate': {
          verb: 'Vyšetři',
          icon: '🕵️',
          color: 'blue',
          description: 'Zjisti přesnou roli'
        }
      }
    }
  },

  // ==================
  // NEUTRAL
  // ==================
  'SerialKiller': {
    emoji: '🛡️',
    team: 'neutral',
    teamLabel: 'Sériový vrah',
    description: 'Zabíjej všechny - vyhraj sám. Chodíš vždy první a nemůžeš být zastaven.',
    actionVerb: 'Zabít',
    nightAction: {
      verb: 'Zabiš',
      icon: '🛡️',
      color: 'red',
      description: 'Zabiš jednoho hráče'
    }
  },
  'Infected': {
    emoji: '🦠',
    team: 'neutral',
    teamLabel: 'Nakažlivý',
    description: 'Nakaz všechny hráče a vyhraj',
    actionVerb: 'Nakazit',
    nightAction: {
      verb: 'Nakazi',
      icon: '🦠',
      color: 'purple',
      description: 'Nakazi jednoho hráče'
    }
  },

  'Jester': {
    emoji: '🎭',
    team: 'neutral',
    teamLabel: 'Šašek',
    description: 'Vyhraj, pokud jsi vyhlasován. Hra končí okamžitě, když jsi vyhlasován.',
    actionVerb: 'Žádná',
    nightAction: null // No night action
  },
  'Witch': {
    emoji: '🧙‍♀️',
    team: 'neutral',
    teamLabel: 'Čarodějnice',
    description: 'Přežij do konce hry. Ovládáš hráče - donutíš ho použít jeho schopnost na tvůj vybraný cíl. Hraješ před všemi ostatními.',
    actionVerb: 'Ovládnout',
    nightAction: {
      verb: 'Ovládni',
      icon: '🧙‍♀️',
      color: 'purple',
      description: 'Nejprve vyber hráče, kterého ovládneš, pak vyber cíl, na kterého použije svou schopnost',
      requiresTwoTargets: true
    }
  }
};

// Modifier information
export const MODIFIER_INFO = {
  'Drunk': {
    emoji: '🍺',
    label: 'Opilý',
    description: 'Zůstane doma a dostane falešné výsledky akcí'
  },
  'Shady': {
    emoji: '🏚️',
    label: 'Podezřelý',
    description: 'Při vyšetřování vypadá jako zlý, i když je dobrý'
  },
  'Innocent': {
    emoji: '😇',
    label: 'Nevinný',
    description: 'Při vyšetřování vypadá jako dobrý nebo neutrální, i když je zlý'
  },
  'Paranoid': {
    emoji: '😱',
    label: 'Paranoidní',
    description: 'Vidí falešné návštěvníky, kteří u něj nebyly'
  },
  'Insomniac': {
    emoji: '😵',
    label: 'Nespavec',
    description: 'Vidí všechny, kdo ho navštíví'
  },
  'Sweetheart': {
    emoji: '💖',
    label: 'Miláček',
    description: 'Když zemřeš, náhodný hráč se stane opilcem.'
  }
};

// Helper function to get role info with fallback
export function getRoleInfo(role) {
  return ROLE_INFO[role] || ROLE_INFO['Citizen'];
}

// Helper function to get modifier info
export function getModifierInfo(modifier) {
  return MODIFIER_INFO[modifier] || null;
}

// Helper function to get team label
export function getTeamLabel(team) {
  const teamLabels = {
    'good': 'Město',
    'evil': 'Mafie',
    'neutral': 'Neutrální'
  };
  return teamLabels[team] || 'Neutrální';
}

