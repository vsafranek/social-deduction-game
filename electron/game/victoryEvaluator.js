// electron/game/victoryEvaluator.js

/**
 * Victory evaluation module
 * Handles all win condition logic based on role definitions
 * Evil wins only at parity when they have control (not 2v2, but 1v1 or majority)
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
 * 
 * Evil wins when:
 * - Evil > Good (majority)
 * - Evil === Good === 1 (1v1 - cannot lynch)
 * 
 * Good wins when:
 * - Evil === 0 (all evil eliminated)
 * 
 * Game continues when:
 * - Evil < Good (good has majority)
 * - Evil === Good > 1 (e.g., 2v2 - good can still lynch)
 */
function evaluateVictory(players) {
  const alive = players.filter(p => p.alive);
  
  // Nobody alive = Evil wins by default
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
    if (p.victoryConditions?.soloWin) {
      const others = alive.filter(x => x._id.toString() !== p._id.toString());
      if (others.length === 0) {
        console.log(`✅ Solo win: ${p.name}`);
        return { 
          winner: 'solo', 
          players: [p._id], 
          teams: p.affiliations || ['solo'] 
        };
      }
    }
  }

  // 2) Custom rules per player (e.g., Infected, Jester, Executioner)
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
        
        console.log(`✅ Custom rule win: ${winners.map(w => w.name).join(', ')}`);
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

  console.log(`📊 Alive counts: Good=${goodAlive}, Evil=${evilAlive}, Neutral=${neutralAlive}, Total=${alive.length}`);

  // ✅ Good win: no evil alive
  if (evilAlive === 0) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('good')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Good wins: No evil remaining`);
      return { 
        winner: 'good', 
        players: winners.map(w => w._id), 
        teams: ['good'] 
      };
    }
    
    // Edge case: Only neutrals left - good wins by default
    if (neutralAlive > 0) {
      console.log(`✅ Good wins: Only neutrals remaining (no evil)`);
      const neutralWinners = alive.filter(p => 
        p.victoryConditions?.canWinWithTeams?.includes('good') ||
        p.affiliations?.includes('neutral')
      );
      return { 
        winner: 'good', 
        players: neutralWinners.map(w => w._id), 
        teams: ['good', 'neutral'] 
      };
    }
  }

  // ✅ Evil win conditions (revised)
  // Evil wins when they have MAJORITY or when it's 1v1 (cannot be lynched)
  
  // Case 1: Evil has majority (more evil than good)
  if (evilAlive > goodAlive && evilAlive > 0) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (majority): ${evilAlive} evil > ${goodAlive} good`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w._id), 
        teams: ['evil'] 
      };
    }
  }

  // Case 2: 1v1 scenario (cannot lynch - evil wins)
  if (evilAlive === 1 && goodAlive === 1 && alive.length === 2) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (1v1): Cannot be lynched`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w._id), 
        teams: ['evil'] 
      };
    }
  }

  // Case 3: Parity with total = 2 (1v1 with neutrals counted)
  // If total is 2 and there's 1 evil, evil wins
  if (alive.length === 2 && evilAlive >= 1) {
    const winners = alive.filter(p => 
      p.victoryConditions?.canWinWithTeams?.includes('evil')
    );
    
    if (winners.length > 0) {
      console.log(`✅ Evil wins (2 players, 1 evil): Cannot be lynched`);
      return { 
        winner: 'evil', 
        players: winners.map(w => w._id), 
        teams: ['evil'] 
      };
    }
  }

  // ✅ Edge case: Only one player left (not solo win)
  if (alive.length === 1) {
    const lastPlayer = alive[0];
    const team = lastPlayer.affiliations?.includes('evil') ? 'evil' : 'good';
    
    console.log(`✅ Last player standing: ${lastPlayer.name} (${team})`);
    return {
      winner: team,
      players: [lastPlayer._id],
      teams: [team]
    };
  }

  // ✅ Game continues (e.g., 2v2, 3v2, etc.)
  console.log(`⏭️ Game continues: Good can still lynch evil`);
  return null;
}

module.exports = {
  evaluateVictory,
  evaluateCustomRule,
  liveTeamCounts,
  groupByAffiliation
};
