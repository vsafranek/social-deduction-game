// src/player/components/NightResults/resultMapping.js
// Shared result mapping for NightResults and NightResultsStories

export const RESULT_MAPPING = {
  // ============================================
  // GENERAL RESULTS (apply to any player)
  // ============================================

  // Death and protection
  killed: {
    emoji: "💀",
    label: "Byl jsi zavražděn",
    subtitle: "Někdo tě zabil v noci",
    bgGradient: "linear-gradient(135deg, #dc2626, #991b1b)",
    severity: "critical",
    hideDetails: true,
  },
  poisoned_killed: {
    emoji: "☠️",
    label: "Zemřel jsi na otravu",
    subtitle: "Otrava tě zabila",
    bgGradient: "linear-gradient(135deg, #7c2d12, #991b1b)",
    severity: "critical",
    hideDetails: true,
  },
  attacked_hunter: {
    emoji: "🏹",
    label: "Napaden lovcem!",
    subtitle: "Lovec na tebe zaútočil",
    bgGradient: "linear-gradient(135deg, #f97316, #ea580c)",
    severity: "critical",
    hideDetails: true,
  },
  attacked_killer: {
    emoji: "🔪",
    label: "Napaden vrahem!",
    subtitle: "Vrah na tebe zaútočil",
    bgGradient: "linear-gradient(135deg, #f97316, #ea580c)",
    severity: "critical",
    hideDetails: true,
  },
  healed: {
    emoji: "💚",
    label: "Zachráněn!",
    subtitle: "Doktor odvrátil útok",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    severity: "positive",
    hideDetails: false,
  },
  guardian_prevented: {
    emoji: "🛡️",
    label: "Stráž!",
    subtitle: "Zastaven stráží",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    severity: "negative",
    hideDetails: false,
  },
  visited: {
    emoji: "👤",
    label: "Návštěva",
    subtitle: "Někdo tě navštívil",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: true, // ✅ Skryj jména návštěvníků (pokud nemáš Lookout/Guardian)
  },
  safe: {
    emoji: "😴",
    label: "Klidná noc",
    subtitle: "Nic se ti nestalo",
    bgGradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    severity: "positive",
    hideDetails: false,
  },

  // Generic action results (used by multiple roles)
  success: {
    emoji: "✅",
    label: "Úspěch!",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    severity: "positive",
    hideDetails: false,
  },
  failed: {
    emoji: "❌",
    label: "Selhání",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    severity: "negative",
    hideDetails: false,
  },

  // ============================================
  // ROLE-SPECIFIC RESULTS
  // ============================================

  // Jailer (Good) - Role-specific feedback
  jailer_prevented: {
    emoji: "🔒",
    label: "Zadržen",
    subtitle: "Pokusil jsi se odejít, ale byl jsi zadržen",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    severity: "negative",
    hideDetails: false,
  },
  jailer_blocked: {
    emoji: "👮",
    label: "Zadržení",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    severity: "neutral",
    hideDetails: false,
  },
  jailer_home: {
    emoji: "🏠",
    label: "Zadržení",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Guardian (Good) - Role-specific feedback
  guardian_stopped: {
    emoji: "🛡️",
    label: "Zastavení",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    severity: "neutral",
    hideDetails: false,
  },
  guardian_quiet: {
    emoji: "😴",
    label: "Klidná noc",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Lookout (Good) - Role-specific feedback
  lookout_visitors: {
    emoji: "👁️",
    label: "Návštěvníci",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },
  lookout_quiet: {
    emoji: "😴",
    label: "Klidná noc",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Tracker (Good) - Role-specific feedback
  tracker_followed: {
    emoji: "👣",
    label: "Sledování",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },
  tracker_stayed: {
    emoji: "🏠",
    label: "Zůstal doma",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Doctor (Good) - Role-specific feedback
  doctor_saved: {
    emoji: "💚",
    label: "Zachránil jsi",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    severity: "positive",
    hideDetails: false,
  },
  doctor_quiet: {
    emoji: "💉",
    label: "Ochrana",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Hunter (Good) - Role-specific results
  hunter_kill: {
    emoji: "🏹",
    label: "Zabil jsi cíl",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #f97316, #ea580c)",
    severity: "neutral",
    hideDetails: false,
  },
  hunter_success: {
    emoji: "🏹",
    label: "Úspěšný lov",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    severity: "positive",
    hideDetails: false,
  },
  hunter_guilt: {
    emoji: "💀",
    label: "Zemřel jsi z viny",
    subtitle: "Zabil jsi nevinného a akce tě stála život",
    bgGradient: "linear-gradient(135deg, #dc2626, #991b1b)",
    severity: "critical",
    hideDetails: true,
  },

  // Investigator (Good) - Role-specific action result
  investigate: {
    emoji: "🔍",
    label: "Vyšetřování",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    severity: "neutral",
    hideDetails: false,
  },

  // Coroner (Good) - Role-specific action result
  autopsy: {
    emoji: "🔬",
    label: "Pitva",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    severity: "info",
    hideDetails: false,
  },

  // Consigliere (Evil) - Role-specific action result
  consig: {
    emoji: "🕵️",
    label: "Vyšetřování",
    subtitle: "detail",
    bgGradient: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    severity: "info",
    hideDetails: false,
  },
};
