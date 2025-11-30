/**
 * Utility funkce pro logiku limitů rolí
 */

/**
 * Vypočítá pool size pro tým (součet roleCount pro aktivní role v týmu)
 * @param {Object} roleCount - Mapa role -> count
 * @param {Object} randomPoolRoles - Mapa role -> boolean (aktivní/naktivní)
 * @param {Function} teamOf - Funkce pro získání týmu role
 * @param {Array} roleKeys - Seznam všech rolí
 * @param {string} team - Tým ('good', 'evil', 'neutral')
 * @returns {number} Pool size pro tým
 */
export function calculateTeamPoolSize(roleCount, randomPoolRoles, teamOf, roleKeys, team) {
  return roleKeys.reduce((acc, r) => {
    const t = teamOf(r);
    if (t === team && randomPoolRoles[r] && roleCount[r] > 0) {
      return acc + (roleCount[r] || 0);
    }
    return acc;
  }, 0);
}

/**
 * Vypočítá počet garantovaných rolí pro tým
 * @param {Array} guaranteedRoles - Seznam garantovaných rolí
 * @param {Function} teamOf - Funkce pro získání týmu role
 * @param {string} team - Tým ('good', 'evil', 'neutral')
 * @returns {number} Počet garantovaných rolí pro tým
 */
export function calculateTeamGuaranteedCount(guaranteedRoles, teamOf, team) {
  return guaranteedRoles.filter(role => teamOf(role) === team).length;
}

/**
 * Zkontroluje, zda lze přidat garantovanou roli
 * @param {Object} params - Parametry kontroly
 * @param {number} params.guaranteedCount - Aktuální počet garantovaných rolí pro tuto konkrétní roli
 * @param {number} params.poolCount - PoolCount (maxLimit) pro tuto roli
 * @param {number} params.teamGuaranteedCount - Celkový počet garantovaných rolí pro tým
 * @param {number} params.teamRandomCount - Počet random rolí pro tým (teamLimit)
 * @param {number} params.teamPoolSize - Pool size pro tým (součet roleCount)
 * @returns {Object} Výsledek kontroly s canAdd a důvody
 */
export function canAddGuaranteedRole({
  guaranteedCount,
  poolCount,
  teamGuaranteedCount,
  teamRandomCount,
  teamPoolSize
}) {
  // Kontrola limitu pro tuto konkrétní roli
  // poolCount je již roven maxLimit (nebo roleCount, pokud maxLimit není nastaven)
  // Garantovaný počet nesmí překročit poolCount
  const wouldBeGuaranteedAfterAdd = guaranteedCount + 1;
  const canAddByRoleLimit = wouldBeGuaranteedAfterAdd <= poolCount;

  // Kontrola pool limitu pro tým
  const wouldBeTeamGuaranteedAfterAdd = teamGuaranteedCount + 1;
  const wouldBeTeamTotalAfterAdd = wouldBeTeamGuaranteedAfterAdd + teamRandomCount;
  const canAddByPoolLimit = wouldBeTeamTotalAfterAdd <= teamPoolSize;

  const canAdd = canAddByRoleLimit && canAddByPoolLimit;
  
  // maxGuaranteedAllowed = poolCount (což je maxLimit)
  const maxGuaranteedAllowed = poolCount;

  return {
    canAdd,
    canAddByRoleLimit,
    canAddByPoolLimit,
    maxGuaranteedAllowed,
    wouldBeTeamTotalAfterAdd,
    teamPoolSize
  };
}

/**
 * Zkontroluje, zda lze přidat random roli pro tým
 * @param {Object} params - Parametry kontroly
 * @param {number} params.currentTeamRandomCount - Aktuální počet random rolí pro tým (teamLimit)
 * @param {number} params.teamGuaranteedCount - Počet garantovaných rolí pro tým
 * @param {number} params.teamPoolSize - Pool size pro tým
 * @returns {Object} Výsledek kontroly s canAdd a maxRandomAllowed
 */
export function canAddRandomRole({
  currentTeamRandomCount,
  teamGuaranteedCount,
  teamPoolSize
}) {
  // Random + guaranteed nesmí překročit pool size
  // maxRandomAllowed = pool size - guaranteed (maximální počet random rolí, které můžeme mít)
  const maxRandomAllowed = Math.max(0, teamPoolSize - teamGuaranteedCount);
  // Kontrolujeme, zda po přidání +1 random bude total <= pool size:
  // currentTeamRandomCount + 1 + teamGuaranteedCount <= teamPoolSize
  // currentTeamRandomCount + 1 <= teamPoolSize - teamGuaranteedCount
  // currentTeamRandomCount + 1 <= maxRandomAllowed
  // Používáme <= protože kontrolujeme, zda po přidání +1 bude total <= pool size
  const canAdd = (currentTeamRandomCount + 1) <= maxRandomAllowed;

  return {
    canAdd,
    maxRandomAllowed,
    wouldBeTotal: currentTeamRandomCount + 1 + teamGuaranteedCount,
    teamPoolSize
  };
}

