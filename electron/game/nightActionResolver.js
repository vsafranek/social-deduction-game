// electron/game/nightActionResolver.js

const { ROLES } = require('../models/Role');

/**
 * Helper functions
 */
function hasEffect(player, effectType) {
  const now = new Date();
  return (player.effects || []).some(e => 
    e.type === effectType && (!e.expiresAt || e.expiresAt > now)
  );
}

function addEffect(player, type, sourceId = null, expiresAt = null, meta = {}) {
  if (!player.effects) player.effects = [];
  player.effects.push({
    type,
    source: sourceId,
    addedAt: new Date(),
    expiresAt,
    meta
  });
}

function removeEffects(player, predicate) {
  if (!player.effects) return;
  player.effects = player.effects.filter(e => !predicate(e));
}

function clearExpiredEffects(players) {
  const now = new Date();
  for (const p of players) {
    if (!p.effects) continue;
    p.effects = p.effects.filter(e => !e.expiresAt || e.expiresAt > now);
  }
}

/**
 * Main night action resolver
 */
async function resolveNightActions(game, players) {
  console.log('🌙 [NightResolver] Starting night action resolution...');
  
  const idMap = new Map(players.map(p => [p._id.toString(), p]));
  const blocked = new Set();
  const trapped = new Set();
  const visits = [];
  
  // Clear previous results
  for (const p of players) {
    if (!p.nightAction) {
      p.nightAction = { targetId: null, action: null, results: [] };
    }
    if (!p.nightAction.results) {
      p.nightAction.results = [];
    } else {
      p.nightAction.results = [];
    }
  }

  clearExpiredEffects(players);

  // PHASE 1: Collect and validate actions
  console.log('📋 [NightResolver] Phase 1: Validating actions...');
  for (const actor of players) {
    if (!actor.alive) continue;
    
    const action = actor.nightAction?.action;
    const targetId = actor.nightAction?.targetId?.toString();
    
    if (!action || !targetId) continue;

    const target = idMap.get(targetId);
    if (!target || !target.alive) {
      console.log(`  ⚠️ ${actor.name}: Invalid target`);
      continue;
    }

    // Check if blocked
    if (hasEffect(actor, 'blocked')) {
      blocked.add(actor._id.toString());
      actor.nightAction.results.push('blocked:Byl jsi uzamčen - tvá akce selhala');
      console.log(`  🔒 ${actor.name}: Blocked`);
      continue;
    }

    // Check for trap
    if (hasEffect(target, 'trap')) {
      trapped.add(actor._id.toString());
      addEffect(actor, 'trapped', null, null, {});
      actor.nightAction.results.push('trapped:Spadl jsi do pasti!');
      console.log(`  🪤 ${actor.name}: Trapped by ${target.name}`);
      continue;
    }

    // Check drunk modifier
    if (actor.modifier === 'Opilý' || actor.modifier === 'Drunk') {
      if (Math.random() < 0.5) {
        blocked.add(actor._id.toString());
        actor.nightAction.results.push('drunk:Jsi příliš opilý - akce selhala');
        console.log(`  🍺 ${actor.name}: Too drunk`);
        continue;
      }
    }

    visits.push({ actorId: actor._id.toString(), targetId, action });
    console.log(`  ✓ ${actor.name} → ${action} → ${target.name}`);
  }

  // PHASE 2: Track visits
  console.log('👁️ [NightResolver] Phase 2: Tracking visits...');
  const visitsByTarget = new Map();
  for (const v of visits) {
    const actor = idMap.get(v.actorId);
    if (!visitsByTarget.has(v.targetId)) {
      visitsByTarget.set(v.targetId, []);
    }
    visitsByTarget.get(v.targetId).push(actor.name);
  }

  // PHASE 3: Apply effects
  console.log('⚡ [NightResolver] Phase 3: Applying effects...');
  const toSave = new Set();

  for (const v of visits) {
    if (blocked.has(v.actorId) || trapped.has(v.actorId)) continue;

    const actor = idMap.get(v.actorId);
    const target = idMap.get(v.targetId);
    if (!actor || !target) continue;

    switch (v.action) {
      case 'infect': {
        if (!hasEffect(target, 'infected')) {
          addEffect(target, 'infected', actor._id, null, {});
          toSave.add(target._id.toString());
          actor.nightAction.results.push(`success:Nakazil jsi ${target.name}`);
          console.log(`    🦠 ${actor.name} infected ${target.name}`);
        }
        break;
      }

      case 'frame': {
        addEffect(target, 'framed', actor._id, null, {});
        toSave.add(target._id.toString());
        actor.nightAction.results.push(`success:Zarámoval jsi ${target.name}`);
        console.log(`    🖼️ ${actor.name} framed ${target.name}`);
        break;
      }

      case 'kill':
      case 'clean_kill': {
        addEffect(target, 'pendingKill', actor._id, null, { clean: v.action === 'clean_kill' });
        toSave.add(target._id.toString());
        actor.nightAction.results.push(`success:Zaútočil jsi na ${target.name}`);
        console.log(`    🔪 ${actor.name} attacked ${target.name}${v.action === 'clean_kill' ? ' (clean)' : ''}`);
        break;
      }

      case 'protect': {
        addEffect(target, 'protected', actor._id, null, {});
        toSave.add(target._id.toString());
        actor.nightAction.results.push(`success:Chráníš ${target.name}`);
        console.log(`    💉 ${actor.name} protected ${target.name}`);
        break;
      }

      case 'block': {
        addEffect(target, 'blocked', actor._id, null, {});
        toSave.add(target._id.toString());
        actor.nightAction.results.push(`success:Uzamkl jsi ${target.name}`);
        console.log(`    👮 ${actor.name} jailed ${target.name}`);
        break;
      }

      case 'trap': {
        addEffect(actor, 'trap', actor._id, null, {});
        toSave.add(actor._id.toString());
        actor.nightAction.results.push('success:Nastavil jsi past');
        console.log(`    🪤 ${actor.name} set a trap`);
        break;
      }

      case 'watch': {
        const visitors = visitsByTarget.get(v.targetId) || [];
        const otherVisitors = visitors.filter(n => n !== actor.name);
        if (otherVisitors.length > 0) {
          actor.nightAction.results.push(`watch:U ${target.name}: ${otherVisitors.join(', ')}`);
          console.log(`    👁️ ${actor.name} saw: ${otherVisitors.join(', ')}`);
        } else {
          actor.nightAction.results.push(`watch:U ${target.name} nikdo nebyl`);
          console.log(`    👁️ ${actor.name} saw: nobody`);
        }
        break;
      }

      case 'track': {
        const targetAction = target.nightAction;
        if (targetAction?.targetId) {
          const trackedTarget = idMap.get(targetAction.targetId.toString());
          actor.nightAction.results.push(`track:${target.name} → ${trackedTarget?.name || '?'}`);
          console.log(`    👣 ${actor.name} tracked ${target.name} to ${trackedTarget?.name}`);
        } else {
          actor.nightAction.results.push(`track:${target.name} nikam nešel`);
          console.log(`    👣 ${actor.name} tracked ${target.name}: nowhere`);
        }
        break;
      }

      case 'investigate': {
        const roleData = ROLES[target.role];
        const possibleRoles = roleData?.investigatorResults || [target.role, 'Citizen'];
        actor.nightAction.results.push(`investigate:${target.name} = ${possibleRoles.join(' / ')}`);
        console.log(`    🔍 ${actor.name} investigated ${target.name}: ${possibleRoles.join('/')}`);
        break;
      }

      default:
        console.log(`    ❓ Unknown action: ${v.action}`);
        break;
    }
  }

  // PHASE 4: Inform targets about visitors
  console.log('📬 [NightResolver] Phase 4: Informing targets...');
  for (const [targetId, visitors] of visitsByTarget.entries()) {
    const target = idMap.get(targetId);
    if (!target) continue;

    const otherVisitors = visitors.filter(v => v !== target.name);
    if (otherVisitors.length > 0) {
      if (!target.nightAction) {
        target.nightAction = { targetId: null, action: null, results: [] };
      }
      if (!target.nightAction.results) {
        target.nightAction.results = [];
      }
      target.nightAction.results.push(`visited:${otherVisitors.join(', ')}`);
      console.log(`    👤 ${target.name} was visited by: ${otherVisitors.join(', ')}`);
    }
  }

  // PHASE 5: Resolve kills
  console.log('💀 [NightResolver] Phase 5: Resolving kills...');
  for (const p of players) {
    if (!p.alive) continue;
    
    const pending = (p.effects || []).filter(e => e.type === 'pendingKill');
    if (!pending.length) continue;

    if (!p.nightAction) {
      p.nightAction = { targetId: null, action: null, results: [] };
    }
    if (!p.nightAction.results) {
      p.nightAction.results = [];
    }

    const isProtected = hasEffect(p, 'protected');
    
    if (!isProtected) {
      // ✅ Hráč zemřel - přidej "killed" story
      p.alive = false;
      p.nightAction.results.push('killed:Byl jsi zavražděn');
      toSave.add(p._id.toString());
      console.log(`    ☠️ ${p.name} was killed`);
    } else {
      // První story: útok
      p.nightAction.results.push('attacked:Na tebe byl proveden útok');
      // Druhá story: záchrana
      p.nightAction.results.push('healed:Doktor tě zachránil!');
      console.log(`    💚 ${p.name} was attacked but saved`);
    }

    removeEffects(p, e => e.type === 'pendingKill');
    toSave.add(p._id.toString());
  }

  // PHASE 6: Default messages
  console.log('📝 [NightResolver] Phase 6: Adding default messages...');
  for (const p of players) {
    if (!p.alive) continue;
    
    if (!p.nightAction) {
      p.nightAction = { targetId: null, action: null, results: [] };
    }
    if (!p.nightAction.results) {
      p.nightAction.results = [];
    }
    
    if (p.nightAction.results.length === 0) {
      p.nightAction.results.push('safe:V noci se ti nic nestalo');
    }
  }

  // PHASE 7: Save all
  console.log('💾 [NightResolver] Phase 7: Saving players...');
  for (const p of players) {
    await p.save();
    console.log(`  ✓ ${p.name}: ${p.nightAction?.results?.length || 0} results`);
  }

  console.log('✅ [NightResolver] Night action resolution complete!');
}

module.exports = { resolveNightActions };
