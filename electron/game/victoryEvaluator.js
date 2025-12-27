// electron/game/victoryEvaluator.js

/**
 * Victory evaluation module
 * Good wins only when no evil AND no hostile neutrals remain
 */

function hasEffect(player, effectType) {
  const now = new Date();
  return (player.effects || []).some(e => 
    e.type === effectType && (!e.expiresAt || e.expiresAt > now)
  );
}

function liveTeamCounts(players) {
  const counts = new Map();
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return counts;
}

function groupByAffiliation(players) {
  const map = new Map();
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(p);
    }
  }
  return map;
}

// ✅ NEW: Check if neutral is hostile (can kill/win solo)
function isHostileNeutral(player) {
  const hostileRoles = ['SerialKiller', 'Infected'];
  return hostileRoles.includes(player.role);
}

function evaluateCustomRule(rule, ctx) {
  switch (rule.type) {
    case 'eliminate': {
      const n = ctx.counts.get(rule.targetTeam) || 0;
      return n === 0;
    }

    case 'parity': {
      const a = ctx.counts.get(rule.team) || 0;
      const b = ctx.counts.get(rule.against || 'good') || 0;
      const cmp = rule.comparator || '>=';
      if (cmp === '>=') return a >= b;
      if (cmp === '>') return a > b;
      if (cmp === '===') return a === b;
      return false;
    }

    case 'aliveExactly': {
      const n = ctx.counts.get(rule.team) || 0;
      return n === rule.count;
    }

    case 'aliveAtMost': {
      const n = ctx.counts.get(rule.team) || 0;
      return n <= rule.count;
    }

    case 'aliveAtLeast': {
      const n = ctx.counts.get(rule.team) || 0;
      return n >= rule.count;
    }

    case 'allOthersHaveEffect': {
      const { effect, negate } = rule;
      // For Infected: check all alive players (excluding self)
      // Infected wins if all other alive players have the 'infected' effect
      const alive = ctx.players.filter(pl => pl.alive);
      const selfId = ctx.self?.id?.toString();
      for (const pl of alive) {
        if (selfId && pl.id.toString() === selfId) continue;
        const has = hasEffect(pl, effect);
        if (negate ? has : !has) return false;
      }
      return true;
    }

    case 'allOthersVisited': {
      // Pro Infected roli - zkontroluj, zda navštívil všechny živé hráče
      const self = ctx.self;
      if (!self || self.role !== 'Infected') return false;
      
      const alive = ctx.players.filter(pl => pl.alive && pl.id.toString() !== self.id.toString());
      if (alive.length === 0) return true; // Pokud není nikdo jiný naživu, vyhrává
      
      const visitedPlayers = self.role_data?.visitedPlayers || [];
      const visitedIds = visitedPlayers.map(id => id?.toString()).filter(Boolean);
      
      // Zkontroluj, zda všechny živé hráče byly navštíveny
      for (const pl of alive) {
        if (!visitedIds.includes(pl.id.toString())) {
          return false;
        }
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Main victory evaluation function
 * 
 * Victory Priority:
 * 1. Solo wins (SerialKiller alone)
 * 2. Custom rules (Infected, etc.)
 * 3. Evil wins (majority or 1v1)
 * 4. Good wins (no evil AND no hostile neutrals)
 * 5. Game continues
 */
function evaluateVictory(players) {
  const alive = players.filter(p => p.alive);
  
  if (alive.length === 0) {
    console.log('⚠️ No players alive - Evil wins by default');
    return { 
      winner: 'evil', 
      players: [], 
      teams: ['evil'] 
    };
  }

  const counts = liveTeamCounts(players);
  const byTeam = groupByAffiliation(players);

  // 1) Solo wins (highest priority)
  for (const p of alive) {
    if (p.victory_conditions?.soloWin) {
      const others = alive.filter(x => x.id.toString() !== p.id.toString());
      if (others.length === 0) {
        console.log(`✅ Solo win: ${p.name}`);
        return { 
          winner: 'solo', 
          players: [p.id], 
          teams: p.affiliations || ['solo'] 
        };
      }
    }
  }

  // 2) Custom rules per player (e.g., Infected)
  for (const p of alive) {
    const rules = p.victory_conditions?.customRules || [];
    if (rules.length) {
      const ctx = { counts, byTeam, players, self: p };
      const allSatisfied = rules.every(rule => evaluateCustomRule(rule, ctx));
      if (allSatisfied) {
        const winners = alive.filter(pl => {
          const plRules = pl.victory_conditions?.customRules || [];
          if (plRules.length === 0) return false;
          return plRules.every(r => evaluateCustomRule(r, { counts, byTeam, players, self: pl }));
        });
        
        console.log(`✅ Custom rule win: ${winners.map(w => w.name).join(', ')}`);
        return { 
          winner: 'custom', 
          players: winners.map(w => w.id), 
          teams: p.affiliations || ['neutral'] 
        };
      }
    }
  }

  // 3) Coalition defaults
  const evilAlive = (byTeam.get('evil') || []).length;
  const goodAlive = (byTeam.get('good') || []).length;
  const neutralAlive = (byTeam.get('neutral') || []).length;

  // ✅ Check for hostile neutrals
  const hostileNeutrals = alive.filter(p => isHostileNeutral(p));
  const hasHostileNeutrals = hostileNeutrals.length > 0;

  console.log(`📊 Alive counts: Good=${goodAlive}, Evil=${evilAlive}, Neutral=${neutralAlive}, Hostile Neutrals=${hostileNeutrals.length}`);

  // ✅ Good win: no evil AND no hostile neutrals
  if (evilAlive === 0 && !hasHostileNeutrals) {
    const winners = alive.filter(p => 
      p.victory_conditions?.canWinWithTeams?.includes('good')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Good wins: No evil or hostile neutrals remaining`);
      return { 
        winner: 'good', 
        players: winners.map(w => w.id), 
        teams: ['good'] 
      };
    }
  }

  // ✅ If evil = 0 but hostile neutrals exist, check their custom rules
  if (evilAlive === 0 && hasHostileNeutrals) {
    console.log(`⏭️ Evil eliminated but hostile neutrals remain - checking custom rules`);
    
    // Game continues - neutrals must fulfill their win conditions
    // This will be caught by custom rules check above in next evaluation
    return null;
  }

  // Evil win conditions
  
  // Case 1: Evil has majority
  if (evilAlive > goodAlive && evilAlive > 0) {
    const winners = alive.filter(p => 
      p.victory_conditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (majority): ${evilAlive} evil > ${goodAlive} good`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w.id), 
        teams: ['evil'] 
      };
    }
  }

  // Case 2: 1v1 scenario (cannot lynch)
  if (evilAlive === 1 && goodAlive === 1 && alive.length === 2) {
    const winners = alive.filter(p => 
      p.victory_conditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (1v1): Cannot be lynched`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w.id), 
        teams: ['evil'] 
      };
    }
  }

  // Case 3: 2 players total with 1 evil
  if (alive.length === 2 && evilAlive >= 1) {
    const winners = alive.filter(p => 
      p.victory_conditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (2 players, 1 evil): Cannot be lynched`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w.id), 
        teams: ['evil'] 
      };
    }
  }

  // ✅ Edge case: 1 good vs hostile neutral(s)
  if (evilAlive === 0 && goodAlive === 1 && hasHostileNeutrals) {
    console.log(`⏭️ 1 good vs hostile neutral(s) - game continues (neutrals can kill)`);
    return null;
  }

  // Edge case: Last player standing
  if (alive.length === 1) {
    const lastPlayer = alive[0];
    const team = lastPlayer.affiliations?.includes('evil') ? 'evil' : 
                 lastPlayer.affiliations?.includes('good') ? 'good' : 'neutral';
    
    console.log(`✅ Last player standing: ${lastPlayer.name} (${team})`);
    return {
      winner: team,
      players: [lastPlayer.id],
      teams: [team]
    };
  }

  // Game continues
  console.log(`⏭️ Game continues`);
  return null;
}

module.exports = {
  evaluateVictory,
  evaluateCustomRule,
  liveTeamCounts,
  groupByAffiliation,
  isHostileNeutral
};
