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
 * Generate fake success message for drunk player based on action type
 */
function generateDrunkFakeMessage(action, targetName) {
  const messages = {
    'protect': `success:Chráníš ${targetName}`,
    'block': `success:Uzamkl jsi ${targetName}`,
    'investigate': `investigate:${targetName} = Doctor / Killer`,
    'watch': `watch:U ${targetName} nikdo nebyl`,
    'track': `track:${targetName} nikam nešel`,
    'kill': `success:Zaútočil jsi na ${targetName}`,
    'clean_kill': `success:Zaútočil jsi na ${targetName}`,
    'frame': `success:Zarámoval jsi ${targetName}`,
    'infect': `success:Nakazil jsi ${targetName}`,
    'trap': `success:Nastavil jsi past`
  };
  return messages[action] || `success:Akce provedena`;
}

/**
 * Main night action resolver with priority ordering
 */
async function resolveNightActions(game, players) {
  console.log('🌙 [NightResolver] Starting night action resolution...');
  
  const idMap = new Map(players.map(p => [p._id.toString(), p]));
  const blocked = new Set();
  const trapped = new Set();
  const allVisits = [];
  const drunkPlayers = new Set();
  const jailTargets = new Map(); // ✅ Track Jailer → Target mapping
  
  // ✅ Clear ALL temporary effects from previous night
  for (const p of players) {
    removeEffects(p, e => 
      e.type === 'blocked' || 
      e.type === 'trapped' || 
      e.type === 'protected' ||
      e.type === 'trap'
    );
  }
  
  // Clear previous results
  for (const p of players) {
    if (!p.nightAction) {
      p.nightAction = { targetId: null, action: null, results: [] };
    }
    p.nightAction.results = [];
  }

  clearExpiredEffects(players);

  // PHASE 1: Collect and validate all actions
  console.log('📋 [NightResolver] Phase 1: Collecting actions...');
  const actionsToResolve = [];
  
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

    // Get priority from role
    const roleData = ROLES[actor.role];
    const priority = roleData?.nightPriority || 5;

    actionsToResolve.push({
      actorId: actor._id.toString(),
      targetId,
      action,
      priority,
      actorName: actor.name,
      targetName: target.name
    });
  }

  // Sort by priority (lower number = earlier)
  actionsToResolve.sort((a, b) => a.priority - b.priority);
  
  console.log('🔢 [NightResolver] Action order by priority:');
  actionsToResolve.forEach((a, idx) => {
    console.log(`  ${idx + 1}. [P${a.priority}] ${a.actorName} → ${a.action} → ${a.targetName}`);
  });

  // PHASE 2: Process actions in priority order
  console.log('⚡ [NightResolver] Phase 2: Processing actions by priority...');
  const visitsByTarget = new Map();
  const toSave = new Set();

  for (const actionData of actionsToResolve) {
    const { actorId, targetId, action } = actionData;
    const actor = idMap.get(actorId);
    const target = idMap.get(targetId);

    if (!actor || !target) continue;

    // Check drunk FIRST
    if (actor.modifier === 'Opilý' || actor.modifier === 'Drunk') {
      drunkPlayers.add(actorId);
      const fakeMessage = generateDrunkFakeMessage(action, target.name);
      actor.nightAction.results.push(fakeMessage);
      console.log(`  🍺 ${actor.name}: Too drunk - stayed home (fake: ${action} → ${target.name})`);
      continue;
    }

    // Check if actor is blocked
    if (hasEffect(actor, 'blocked')) {
      if (!blocked.has(actorId)) {
        blocked.add(actorId);
        actor.nightAction.results.push('blocked:Byl jsi uzamčen - tvá akce selhala');
        console.log(`  🔒 ${actor.name}: Blocked`);
      }
      continue;
    }

    // Check for trap
    if (hasEffect(target, 'trap')) {
      if (!trapped.has(actorId)) {
        trapped.add(actorId);
        addEffect(actor, 'trapped', null, null, {});
        actor.nightAction.results.push('trapped:Spadl jsi do pasti!');
        console.log(`  🪤 ${actor.name}: Trapped by ${target.name}`);
      }
      continue;
    }

    // Track visit
    if (!visitsByTarget.has(targetId)) {
      visitsByTarget.set(targetId, []);
    }
    visitsByTarget.get(targetId).push(actor.name);
    allVisits.push(actionData);

    // Apply action effects immediately
    switch (action) {
      case 'block': {
        addEffect(target, 'blocked', actor._id, null, {});
        toSave.add(targetId);
        
        // ✅ Track this jail for later feedback
        jailTargets.set(actorId, targetId);
        
        // Don't give success message yet - will do it in PHASE 3
        console.log(`  👮 [P${actionData.priority}] ${actor.name} jailing ${target.name}...`);
        break;
      }

      case 'trap': {
        addEffect(actor, 'trap', actor._id, null, {});
        toSave.add(actorId);
        actor.nightAction.results.push('success:Nastavil jsi past');
        console.log(`  🪤 [P${actionData.priority}] ${actor.name} set a trap`);
        break;
      }

      case 'watch': {
        console.log(`  👁️ [P${actionData.priority}] ${actor.name} watching ${target.name}`);
        break;
      }

      case 'track': {
        console.log(`  👣 [P${actionData.priority}] ${actor.name} tracking ${target.name}`);
        break;
      }

      case 'investigate': {
        const trueRole = target.role;
        const allRoles = Object.keys(ROLES);
        const otherRoles = allRoles.filter(r => r !== trueRole);
        const fakeRole = otherRoles.length > 0 
          ? otherRoles[Math.floor(Math.random() * otherRoles.length)]
          : 'Citizen';
        const possibleRoles = Math.random() < 0.5 
          ? [trueRole, fakeRole]
          : [fakeRole, trueRole];
        
        actor.nightAction.results.push(
          `investigate:${target.name} = ${possibleRoles.join(' / ')}`
        );
        console.log(`  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: ${possibleRoles.join('/')}`);
        break;
      }

      case 'infect': {
        if (!hasEffect(target, 'infected')) {
          addEffect(target, 'infected', actor._id, null, {});
          toSave.add(targetId);
          actor.nightAction.results.push(`success:Nakazil jsi ${target.name}`);
          console.log(`  🦠 [P${actionData.priority}] ${actor.name} infected ${target.name}`);
        }
        break;
      }

      case 'frame': {
        addEffect(target, 'framed', actor._id, null, {});
        toSave.add(targetId);
        actor.nightAction.results.push(`success:Zarámoval jsi ${target.name}`);
        console.log(`  🖼️ [P${actionData.priority}] ${actor.name} framed ${target.name}`);
        break;
      }

      case 'kill':
      case 'clean_kill': {
        addEffect(target, 'pendingKill', actor._id, null, { clean: action === 'clean_kill' });
        toSave.add(targetId);
        actor.nightAction.results.push(`success:Zaútočil jsi na ${target.name}`);
        console.log(`  🔪 [P${actionData.priority}] ${actor.name} attacked ${target.name}${action === 'clean_kill' ? ' (clean)' : ''}`);
        break;
      }

      case 'protect': {
        addEffect(target, 'protected', actor._id, null, {});
        toSave.add(targetId);
        console.log(`  💉 [P${actionData.priority}] ${actor.name} protecting ${target.name}...`);
        break;
      }

      default:
        console.log(`  ❓ Unknown action: ${action}`);
        break;
    }
  }

  // PHASE 3: Complete watch/track and Jailer feedback
  console.log('👁️ [NightResolver] Phase 3: Completing observations and Jailer feedback...');
  
  // ✅ Jailer feedback - check if target tried to leave
  for (const [jailerId, targetId] of jailTargets.entries()) {
    const jailer = idMap.get(jailerId);
    const target = idMap.get(targetId);
    if (!jailer || !target) continue;

    // Check if target tried to perform an action
    const targetTriedToAct = actionsToResolve.some(a => 
      a.actorId === targetId && !drunkPlayers.has(targetId)
    );

    if (targetTriedToAct) {
      jailer.nightAction.results.push(`success:Uzamkl jsi ${target.name} - pokusil se odejít`);
      console.log(`  👮 ${jailer.name}: ${target.name} tried to leave`);
    } else {
      jailer.nightAction.results.push(`success:Uzamkl jsi ${target.name} - zůstal doma`);
      console.log(`  👮 ${jailer.name}: ${target.name} stayed home`);
    }
  }

  // Watch/Track
  for (const v of allVisits) {
    const actor = idMap.get(v.actorId);
    const target = idMap.get(v.targetId);
    if (!actor || !target) continue;

    if (v.action === 'watch') {
      const targetId = v.targetId;
      
      // ✅ Get ONLY visitors who actually made it to the target
      // (not blocked, not drunk, not trapped)
      const successfulVisitors = allVisits
        .filter(visit => {
          // Visit to this target
          if (visit.targetId !== targetId) return false;
          
          const visitorId = visit.actorId;
          const visitor = idMap.get(visitorId);
          if (!visitor) return false;
          
          // Skip self
          if (visitorId === actor._id.toString()) return false;
          
          // Check if visitor was blocked/drunk/trapped
          if (drunkPlayers.has(visitorId)) return false;
          if (blocked.has(visitorId)) return false;
          if (trapped.has(visitorId)) return false;
          
          return true;
        })
        .map(visit => {
          const visitor = idMap.get(visit.actorId);
          return visitor?.name;
        })
        .filter(Boolean);
      
      if (successfulVisitors.length > 0) {
        actor.nightAction.results.push(`watch:U ${target.name}: ${successfulVisitors.join(', ')}`);
        console.log(`    👁️ ${actor.name} watched ${target.name}: ${successfulVisitors.join(', ')}`);
      } else {
        actor.nightAction.results.push(`watch:U ${target.name} nikdo nebyl`);
        console.log(`    👁️ ${actor.name} watched ${target.name}: nobody`);
      }
    }

    if (v.action === 'track') {
      const targetId = v.targetId;
      const targetPlayer = idMap.get(targetId);
      
      // Check if target was drunk - stayed home
      if (drunkPlayers.has(targetId)) {
        actor.nightAction.results.push(`track:${target.name} nikam nešel`);
        console.log(`    👣 ${actor.name} tracked drunk ${target.name} - stayed home`);
        continue;
      }
      
      // Check if target was blocked - stayed home
      if (blocked.has(targetId)) {
        actor.nightAction.results.push(`track:${target.name} nikam nešel`);
        console.log(`    👣 ${actor.name} tracked blocked ${target.name} - stayed home`);
        continue;
      }
      
      // Check if target was trapped - stayed home (fell into trap)
      if (trapped.has(targetId)) {
        actor.nightAction.results.push(`track:${target.name} nikam nešel`);
        console.log(`    👣 ${actor.name} tracked trapped ${target.name} - stayed home`);
        continue;
      }
      
      // Target actually went somewhere - find where
      const targetVisit = allVisits.find(visit => visit.actorId === targetId);
      
      if (targetVisit && targetVisit.targetId) {
        const destination = idMap.get(targetVisit.targetId);
        actor.nightAction.results.push(`track:${target.name} → ${destination?.name || '?'}`);
        console.log(`    👣 ${actor.name} tracked ${target.name} → ${destination?.name}`);
      } else {
        // Target had no action or is Citizen
        actor.nightAction.results.push(`track:${target.name} nikam nešel`);
        console.log(`    👣 ${actor.name} tracked ${target.name} - stayed home (no action)`);
      }
    }
  }

  // PHASE 4: Inform targets about home invasions
  console.log('📬 [NightResolver] Phase 4: Informing targets about home invasions...');
  for (const [targetId, visitors] of visitsByTarget.entries()) {
    const target = idMap.get(targetId);
    if (!target) continue;

    const homeInvaders = [];
    
    for (const visitorName of visitors) {
      if (visitorName === target.name) continue;
      
      const visitorAction = allVisits.find(v => {
        const actor = idMap.get(v.actorId);
        return actor && actor.name === visitorName && v.targetId === targetId;
      });
      
      if (visitorAction) {
        const actor = idMap.get(visitorAction.actorId);
        const roleData = ROLES[actor.role];
        
        if (roleData?.visitsTarget === true) {
          homeInvaders.push(visitorName);
        }
      }
    }

    if (homeInvaders.length > 0) {
      if (!target.nightAction) {
        target.nightAction = { targetId: null, action: null, results: [] };
      }
      
      const isBlocked = hasEffect(target, 'blocked');
      const onlyJailer = homeInvaders.length === 1 && homeInvaders.some(name => {
        const p = Array.from(idMap.values()).find(pl => pl.name === name);
        return p && p.role === 'Jailer';
      });
      
      if (isBlocked && onlyJailer) {
        console.log(`  🔒 ${target.name} was blocked by Jailer only, skipping visited notification`);
        continue;
      }
      
      target.nightAction.results.push(`visited:${homeInvaders.join(', ')}`);
      console.log(`  👤 ${target.name} was home-invaded by: ${homeInvaders.join(', ')}`);
    }
  }

    // PHASE 5: Resolve kills and Doctor feedback
  console.log('💀 [NightResolver] Phase 5: Resolving kills and Doctor feedback...');

  // Track which players Doctors protected
  const doctorProtections = new Map(); // doctorId -> targetId

  // First, find all Doctor protections
  for (const visit of allVisits) {
    if (visit.action === 'protect') {
      const doctor = idMap.get(visit.actorId);
      const target = idMap.get(visit.targetId);
      if (doctor && target) {
        doctorProtections.set(visit.actorId, visit.targetId);
      }
    }
  }

  // Resolve kills
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
      // Player died
      p.alive = false;
      p.nightAction.results.push('killed:Byl jsi zavražděn');
      toSave.add(p._id.toString());
      console.log(`  ☠️ ${p.name} was killed`);
    } else {
      // Player was saved
      p.nightAction.results.push('attacked:Na tebe byl proveden útok');
      p.nightAction.results.push('healed:Doktor tě zachránil!');
      console.log(`  💚 ${p.name} was attacked but saved`);
    }

    removeEffects(p, e => e.type === 'pendingKill');
    toSave.add(p._id.toString());
  }

  // Give Doctors feedback
  console.log('💉 [NightResolver] Phase 5b: Doctor feedback...');
  for (const [doctorId, targetId] of doctorProtections.entries()) {
    const doctor = idMap.get(doctorId);
    const target = idMap.get(targetId);
    if (!doctor || !target) continue;

    // Check if target was attacked
    const targetWasAttacked = !target.alive || 
      (target.nightAction?.results || []).some(r => 
        r.startsWith('attacked:') || r.startsWith('healed:')
      );

    if (targetWasAttacked) {
      // Doctor saved someone!
      doctor.nightAction.results.push(`success:Zachránil jsi ${target.name} před smrtí!`);
      console.log(`  💉 ${doctor.name}: Successfully saved ${target.name}`);
    } else {
      // Target wasn't attacked
      doctor.nightAction.results.push(`protect:Chránil jsi ${target.name} - nebyl napaden`);
      console.log(`  💉 ${doctor.name}: Protected ${target.name} (no attack)`);
    }
  }


  // PHASE 6: Default messages
  console.log('📝 [NightResolver] Phase 6: Adding default messages...');
  for (const p of players) {
    if (!p.alive) continue;
    
    if (!p.nightAction) {
      p.nightAction = { targetId: null, action: null, results: [] };
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
