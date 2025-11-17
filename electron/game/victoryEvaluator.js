// electron/game/victoryEvaluator.js

/**
 * Victory evaluation module
 * Handles all win condition logic based on role definitions
 */

function hasEffect(player, effectType) {
  const now = new Date();
  return (player.effects || []).some(e => 
    e.type === effectType && (!e.expiresAt || e.expiresAt > now)
  );
}

function liveTeamCounts(players) {
  const counts = new Map(); // team -> count
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return counts;
}

function groupByAffiliation(players) {
  const map = new Map(); // team -> [players]
  for (const p of players) {
    if (!p.alive) continue;
    for (const t of (p.affiliations || [])) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(p);
    }
  }
  return map;
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
      const alive = ctx.players.filter(pl => pl.alive);
      const selfId = ctx.self?._id?.toString();
      for (const pl of alive) {
        if (selfId && pl._id.toString() === selfId) continue;
        const has = hasEffect(pl, effect);
        if (negate ? has : !has) return false;
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Main victory evaluation function
 * Returns: { winner: string, players: [ObjectId], teams: [string] } or null
 */
function evaluateVictory(players) {
  const alive = players.filter(p => p.alive);
  
  // Nobody alive = draw/no winner
  if (alive.length === 0) {
    return { winner: 'draw', players: [], teams: [] };
  }

  const counts = liveTeamCounts(players);
  const byTeam = groupByAffiliation(players);

  // 1) Solo wins (highest priority)
  for (const p of alive) {
    if (p.victoryConditions?.soloWin) {
      const others = alive.filter(x => x._id.toString() !== p._id.toString());
      if (others.length === 0) {
        return { 
          winner: 'solo', 
          players: [p._id], 
          teams: p.affiliations || ['solo'] 
        };
      }
    }
  }

  // 2) Custom rules per player (e.g., Infected)
  for (const p of alive) {
    const rules = p.victoryConditions?.customRules || [];
    if (rules.length) {
      const ctx = { counts, byTeam, players, self: p };
      const allSatisfied = rules.every(rule => evaluateCustomRule(rule, ctx));
      if (allSatisfied) {
        // Find all players who can win with this condition
        const winners = alive.filter(pl => {
          const plRules = pl.victoryConditions?.customRules || [];
          if (plRules.length === 0) return false;
          return plRules.every(r => evaluateCustomRule(r, { counts, byTeam, players, self: pl }));
        });
        
        return { 
          winner: 'custom', 
          players: winners.map(w => w._id), 
          teams: p.affiliations || ['neutral'] 
        };
      }
    }
  }

  // 3) Coalition defaults (good/evil)
  const evilAlive = (byTeam.get('evil') || []).length;
  const goodAlive = (byTeam.get('good') || []).length;
  const neutralAlive = (byTeam.get('neutral') || []).length;

  // Good win: no evil alive and at least one good/neutral alive
  if (evilAlive === 0 && (goodAlive > 0 || neutralAlive > 0)) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('good')
    );
    if (winners.length) {
      return { 
        winner: 'good', 
        players: winners.map(w => w._id), 
        teams: ['good'] 
      };
    }
  }

  // Evil win: no good alive OR parity/majority
  if (goodAlive === 0 || (evilAlive >= goodAlive)) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('evil')
    );
    if (winners.length) {
      return { 
        winner: 'evil', 
        players: winners.map(w => w._id), 
        teams: ['evil'] 
      };
    }
  }

  return null;
}

module.exports = {
  evaluateVictory,
  evaluateCustomRule,
  liveTeamCounts,
  groupByAffiliation
};
