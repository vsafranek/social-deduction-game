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

function getRandomPlayerNames(players, excludeId, count = 1) {
  const candidates = players.filter(p => 
    p.alive && p._id.toString() !== excludeId
  );
  
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(p => p.name);
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
    'autopsy': `autopsy:${targetName} = Citizen`,
    'watch': `watch:U ${targetName} nikdo nebyl`,
    'track': `track:${targetName} nikam nešel`,
    'kill': `success:Zaútočil jsi na ${targetName}`,
    'clean_kill': `success:Zaútočil jsi na ${targetName}`,
    'frame': `success:Obvinil jsi ${targetName}`,
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
  const jailTargets = new Map(); 
  const hunterKills = new Map(); 
  const janitorTargets = new Set(); 

  // ✅ Clear ALL temporary effects from previous night
  // NOTE: marked_for_cleaning should persist across nights until player dies
  for (const p of players) {
    removeEffects(p, e => 
      e.type === 'blocked' || 
      e.type === 'trapped' || 
      e.type === 'protected' ||
      e.type === 'trap'
      // marked_for_cleaning is NOT removed here - it persists until player dies
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
    if (!target) {
      console.log(`  ⚠️ ${actor.name}: Invalid target`);
      continue;
    }
    
    // Most actions require alive target, but some actions need to validate dead targets themselves
    // autopsy and clean_role can target dead players
    // investigate and consig_investigate need to validate dead targets and provide user feedback
    if (action !== 'autopsy' && action !== 'clean_role' && action !== 'investigate' && action !== 'consig_investigate' && !target.alive) {
      console.log(`  ⚠️ ${actor.name}: Target must be alive for action ${action}`);
      continue;
    }

    // Get priority from role
    const roleData = ROLES[actor.role];
    let priority = roleData?.nightPriority || 5;
    
    // Adjust priority for specific actions that need to happen before investigation
    // Accuser's frame action must happen before Investigator (priority 5)
    if (actor.role === 'Accuser' && action === 'frame') {
      priority = 4; // Higher priority than Investigator (5)
    }

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
    // ✅ SerialKiller cannot be stopped by Drunk modifier - he always acts
    if (actor.modifier === 'Drunk' && actor.role !== 'SerialKiller') {
      drunkPlayers.add(actorId);
      const fakeMessage = generateDrunkFakeMessage(action, target.name);
      actor.nightAction.results.push(fakeMessage);
      console.log(`  🍺 ${actor.name}: Too drunk - stayed home (fake: ${action} → ${target.name})`);
      continue;
    }

    // Check if actor is blocked
    // ✅ SerialKiller cannot be blocked - he always goes first and cannot be stopped
    if (hasEffect(actor, 'blocked') && actor.role !== 'SerialKiller') {
      if (!blocked.has(actorId)) {
        blocked.add(actorId);
        actor.nightAction.results.push('blocked:Byl jsi uzamčen - tvá akce selhala');
        console.log(`  🔒 ${actor.name}: Blocked`);
      }
      continue;
    }

    // Check for trap
    // ✅ SerialKiller cannot be trapped - he always goes first and cannot be stopped
    if (hasEffect(target, 'trap') && actor.role !== 'SerialKiller') {
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
        // ✅ SerialKiller cannot be blocked - remove blocked effect if target is SerialKiller
        if (target.role === 'SerialKiller') {
          console.log(`  👮 [P${actionData.priority}] ${actor.name} tried to jail ${target.name} (SerialKiller) - FAILED (SerialKiller cannot be blocked)`);
          actor.nightAction.results.push(`failed:${target.name} je SerialKiller - nemůže být zablokován`);
          break;
        }
        
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
        // Investigator can only investigate alive players
        // If target is dead and role is hidden (cleaned), investigation fails
        if (!target.alive && target.roleHidden) {
          actor.nightAction.results.push(
            `failed:Nemůžeš vyšetřit ${target.name} - role byla vyčištěna`
          );
          console.log(`  🔍 [P${actionData.priority}] ${actor.name} cannot investigate ${target.name} - role hidden`);
          break;
        }
        
        // Investigator only works on alive players
        if (!target.alive) {
          actor.nightAction.results.push(
            `failed:Nemůžeš vyšetřit mrtvého hráče - použij Coroner`
          );
          console.log(`  🔍 [P${actionData.priority}] ${actor.name} cannot investigate dead player ${target.name}`);
          break;
        }
        
        const trueRole = target.role;
        const allRoles = Object.keys(ROLES);
        
        // ✅ Check if target is marked for cleaning - show completely fake results
        if (hasEffect(target, 'marked_for_cleaning')) {
          // Both roles are fake (random) - MUST exclude true role
          const fakeRoles = allRoles.filter(r => r !== trueRole);
          
          if (fakeRoles.length === 0) {
            // Edge case: only one role exists (shouldn't happen in normal game)
            actor.nightAction.results.push(
              `investigate:${target.name} = Unknown / Unknown`
            );
            console.log(`  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: Unknown / Unknown (FAKE - marked for cleaning, true: ${trueRole}, no fake roles available)`);
            break;
          }
          
          const fakeRole1 = fakeRoles[Math.floor(Math.random() * fakeRoles.length)];
          const otherFakeRoles = fakeRoles.filter(r => r !== fakeRole1);
          
          // If only one fake role available, use it twice to avoid revealing true role
          const fakeRole2 = otherFakeRoles.length > 0 
            ? otherFakeRoles[Math.floor(Math.random() * otherFakeRoles.length)]
            : fakeRole1; // Reuse fakeRole1 instead of falling back to 'Citizen'
          
          const possibleRoles = Math.random() < 0.5 
            ? [fakeRole1, fakeRole2]
            : [fakeRole2, fakeRole1];
          
          actor.nightAction.results.push(
            `investigate:${target.name} = ${possibleRoles.join(' / ')}`
          );
          
          console.log(
            `  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: ` +
            `${possibleRoles.join(' / ')} (FAKE - marked for cleaning, true: ${trueRole})`
          );
          break;
        }
        
        // Normal investigation logic
        const otherRoles = allRoles.filter(r => r !== trueRole);
        const fakeRole = otherRoles.length > 0 
          ? otherRoles[Math.floor(Math.random() * otherRoles.length)]
          : 'Citizen';
        
        // ✅ Check Shady modifier - appear as evil
        // ✅ Check framed effect - show evil role instead of true role
        let investigatedRole = trueRole;
        if (target.modifier === 'Shady') {
          // Pick a random evil role
          const evilRoles = Object.keys(ROLES).filter(r => ROLES[r].team === 'evil');
          investigatedRole = evilRoles[Math.floor(Math.random() * evilRoles.length)] || 'Killer';
        } else if (hasEffect(target, 'framed')) {
          // Get the fake evil role from framed effect meta
          const framedEffect = target.effects.find(e => e.type === 'framed');
          investigatedRole = framedEffect?.meta?.fakeEvilRole || 'Killer';
        }
        
        const possibleRoles = Math.random() < 0.5 
          ? [investigatedRole, fakeRole]
          : [fakeRole, investigatedRole];
        
        actor.nightAction.results.push(
          `investigate:${target.name} = ${possibleRoles.join(' / ')}`
        );
        
        const modifiers = [];
        if (target.modifier === 'Shady') modifiers.push('Shady');
        if (hasEffect(target, 'framed')) modifiers.push('framed');
        
        console.log(
          `  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: ` +
          `${possibleRoles.join(' / ')} (true: ${trueRole}${modifiers.length > 0 ? ' [' + modifiers.join(', ') + ']' : ''})`
        );
        break;
      }
      
      case 'autopsy': {
        // Coroner can only investigate dead players
        if (target.alive) {
          actor.nightAction.results.push(
            `failed:Nemůžeš provést pitvu na živém hráči - ${target.name} je stále naživu`
          );
          console.log(`  🔬 [P${actionData.priority}] ${actor.name} cannot autopsy alive player ${target.name}`);
          break;
        }
        
        // If role is hidden (cleaned), Coroner gets "Unknown" result
        if (target.roleHidden) {
          actor.nightAction.results.push(
            `autopsy:${target.name} = Unknown (role byla vyčištěna)`
          );
          console.log(`  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: Unknown (role hidden)`);
          break;
        }
        
        // Check if player was framed - show the fake evil role that Investigator saw
        let exactRole = target.role || 'Unknown';
        if (hasEffect(target, 'framed')) {
          const framedEffect = target.effects.find(e => e.type === 'framed');
          exactRole = framedEffect?.meta?.fakeEvilRole || 'Killer';
          console.log(`  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: ${exactRole} (framed evil role, true: ${target.role})`);
        } else {
          console.log(`  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: ${exactRole}`);
        }
        
        actor.nightAction.results.push(
          `autopsy:${target.name} = ${exactRole}`
        );
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

      case 'kill': {
        addEffect(target, 'pendingKill', actor._id, null, {});
        toSave.add(targetId);
        actor.nightAction.results.push(`success:Zaútočil jsi na ${target.name}`);
        console.log(`  🔪 [P${actionData.priority}] ${actor.name} killed ${target.name}`);
        break;
      }

      case 'clean_role': {
        // Cleaner can mark players for cleaning
        // If target is alive: Investigator will see fake results
        // If target is dead: role will be hidden
        if (!actor.roleData) actor.roleData = {};
        const usesLeft = actor.roleData.usesRemaining || 0;
        
        if (usesLeft > 0) {
          // Decrement uses first, then show message with correct remaining count
          actor.roleData.usesRemaining = usesLeft - 1;
          toSave.add(actorId);
          
          if (target.alive) {
            // Mark alive player - Investigator will see fake investigation results
            addEffect(target, 'marked_for_cleaning', actor._id, null, {});
            toSave.add(targetId);
            actor.nightAction.results.push(
              `success:Označil jsi ${target.name} - Investigator uvidí falešný výsledek (zbývá ${actor.roleData.usesRemaining})`
            );
            console.log(`  🧹 [P${actionData.priority}] ${actor.name} marked ${target.name} for cleaning (alive)`);
          } else {
            // Mark dead player - role will be hidden
            janitorTargets.add(targetId);
            actor.nightAction.results.push(
              `success:Vyčistíš ${target.name} - role bude skryta (zbývá ${actor.roleData.usesRemaining})`
            );
            console.log(`  🧹 [P${actionData.priority}] ${actor.name} will clean ${target.name} (dead)`);
          }
        } else {
          actor.nightAction.results.push('failed:Už nemáš žádná použití!');
        }
        break;
      }

      case 'frame': {
        if (!actor.roleData) actor.roleData = {};
        const usesLeft = actor.roleData.usesRemaining || 0;
        
        if (usesLeft > 0) {
          // Pick a random evil role to show instead of true role
          const evilRoles = Object.keys(ROLES).filter(r => ROLES[r].team === 'evil');
          const fakeEvilRole = evilRoles.length > 0 
            ? evilRoles[Math.floor(Math.random() * evilRoles.length)]
            : 'Killer';
          
          // Store the fake evil role in the effect meta
          addEffect(target, 'framed', actor._id, null, { fakeEvilRole });
          toSave.add(targetId);
          actor.roleData.usesRemaining = usesLeft - 1;
          toSave.add(actorId);
          actor.nightAction.results.push(
            `success:Obvinil jsi ${target.name} - bude vypadat jako zločinec při vyšetřování (zbývá ${actor.roleData.usesRemaining})`
          );
          console.log(`  👉 [P${actionData.priority}] ${actor.name} accused ${target.name} (framed, will show as: ${fakeEvilRole})`);
        } else {
          actor.nightAction.results.push('failed:Už nemáš žádná použití!');
        }
        break;
      }

      case 'consig_investigate': {
        // Consigliere can only investigate alive players
        if (!target.alive) {
          actor.nightAction.results.push(
            `failed:Nemůžeš vyšetřit mrtvého hráče - ${target.name} je mrtvý`
          );
          console.log(`  🕵️ [P${actionData.priority}] ${actor.name} cannot investigate dead player ${target.name}`);
          break;
        }
        
        if (!actor.roleData) actor.roleData = {};
        const usesLeft = actor.roleData.usesRemaining || 0;
        
        if (usesLeft > 0) {
          // Consigliere always sees the true role (not affected by cleaning or framing)
          const exactRole = target.role;
          
          actor.roleData.usesRemaining = usesLeft - 1;
          toSave.add(actorId);
          actor.nightAction.results.push(
            `consig:${target.name} je ${exactRole} (zbývá ${actor.roleData.usesRemaining})`
          );
          console.log(`  🕵️ [P${actionData.priority}] ${actor.name} investigated ${target.name}: ${exactRole} (true role)`);
        } else {
          actor.nightAction.results.push('failed:Už nemáš žádná použití!');
        }
        break;
      }

      case 'protect': {
        addEffect(target, 'protected', actor._id, null, {});
        toSave.add(targetId);
        console.log(`  💉 [P${actionData.priority}] ${actor.name} protecting ${target.name}...`);
        break;
      }

      case 'hunter_kill': {
        // Hunter připraví kill (zkontroluje se po smrti)
        addEffect(target, 'pendingKill', actor._id, null, { hunter: true });
        toSave.add(targetId);
        hunterKills.set(actorId, targetId);
        actor.nightAction.results.push(`success:Zaútočil jsi na ${target.name}`);
        console.log(`  🏹 [P${actionData.priority}] ${actor.name} hunted ${target.name}`);
        break;
      }


      case 'janitor_clean': {
        // Janitor může cílit na MRTVÉ hráče
        // Musíme implementovat výběr mrtvého hráče v UI
        // Pro teď: cílí na živého, ale vyčistí ho pokud zemře
        
        // Check if Janitor has uses left
        if (!actor.roleData) actor.roleData = {};
        if (!actor.roleData.janitorUses) actor.roleData.janitorUses = 3;
        
        if (actor.roleData.janitorUses > 0) {
          janitorTargets.add(targetId);
          actor.roleData.janitorUses -= 1;
          toSave.add(actorId);
          actor.nightAction.results.push(
            `success:Vyčistíš ${target.name} pokud zemře (zbývá ${actor.roleData.janitorUses} použití)`
          );
          console.log(`  🧼 [P${actionData.priority}] ${actor.name} will clean ${target.name} if dead`);
        } else {
          actor.nightAction.results.push('failed:Už nemáš žádná použití!');
          console.log(`  🧼 [P${actionData.priority}] ${actor.name} has no uses left`);
        }
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

  // PHASE 4: Inform targets about home invasions + Paranoid + Insomniac
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
      
      console.log(`  👤 ${target.name} was home-invaded by: ${homeInvaders.join(', ')}`);
    }
  }

  // ✅ PARANOID - Add fake visitors
  console.log('😱 [NightResolver] Phase 4b: Paranoid modifier...');
  for (const p of players) {
    if (!p.alive || p.modifier !== 'Paranoid') continue;
    
    // 50% chance to see fake visitor
    if (Math.random() < 0.5) {
      const fakeVisitors = getRandomPlayerNames(players, p._id.toString(), 1);
      
      if (!p.nightAction) {
        p.nightAction = { targetId: null, action: null, results: [] };
      }
      

      const hasVisited = p.nightAction.results.some(r => r.startsWith('visited:'));
      
      if (hasVisited) {
        // Add to existing visitors
        const visitedIdx = p.nightAction.results.findIndex(r => r.startsWith('visited:'));
        const existing = p.nightAction.results[visitedIdx].replace('visited:', '');
        p.nightAction.results[visitedIdx] = `visited:${existing}, ${fakeVisitors.join(', ')}`;
      } else {
        // Add new visited result
        p.nightAction.results.push(`visited:${fakeVisitors.join(', ')}`);
      }
      
      console.log(`  😱 ${p.name} (Paranoid) sees fake visitor: ${fakeVisitors.join(', ')}`);
    }
  }

  console.log('😵 [NightResolver] Phase 4c: Insomniac modifier...');
  for (const [targetId, visitors] of visitsByTarget.entries()) {
    const target = idMap.get(targetId);
    if (!target || !target.alive || target.modifier !== 'Insomniac') continue;
    
    // Get all successful visitors (same logic as Lookout)
    const successfulVisitors = allVisits
      .filter(visit => {
        if (visit.targetId !== targetId) return false;
        
        const visitorId = visit.actorId;
        const visitor = idMap.get(visitorId);
        if (!visitor) return false;
        
        if (visitorId === target._id.toString()) return false;
        
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
      if (!target.nightAction) {
        target.nightAction = { targetId: null, action: null, results: [] };
      }
      
      target.nightAction.results.push(`visited:${successfulVisitors.join(', ')}`);
      console.log(`  😵 ${target.name} (Insomniac) heard: ${successfulVisitors.join(', ')}`);
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
      
      // Check if mayor died - remove mayor status
      if (game.mayor && game.mayor.toString() === p._id.toString()) {
        p.voteWeight = 1; // Remove mayor vote weight
        game.mayor = null; // No new mayor can be elected
        toSave.add(p._id.toString());
        console.log(`  🏛️ Mayor ${p.name} was killed - mayor status removed`);
        // Note: game.save() will be called by the route handler after night resolution
      }
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

  console.log('🏹 [NightResolver] Phase 5b: Hunter penalty check...');
  for (const [hunterId, targetId] of hunterKills.entries()) {
    const hunter = idMap.get(hunterId);
    const target = idMap.get(targetId);
    
    if (!hunter || !hunter.alive) continue; // Hunter already dead
    if (!target) continue;
    
    // Check if target died and was innocent (good)
    if (!target.alive) {
      const targetTeam = ROLES[target.role]?.team;
      
      // If killed good player, Hunter dies
      if (targetTeam === 'good') {
        hunter.alive = false;
        if (!hunter.nightAction) {
          hunter.nightAction = { targetId: null, action: null, results: [] };
        }
        hunter.nightAction.results.push('hunter_guilt:Zabil jsi nevinného - umíráš výčitkami!');
        toSave.add(hunterId);
        console.log(`  💀 ${hunter.name} died from guilt (killed innocent ${target.name})`);
      } else {
        // Killed evil/neutral - success
        hunter.nightAction.results.push(`hunter_success:Úspěšně jsi zabil ${target.name}!`);
        console.log(`  ✅ ${hunter.name} successfully killed ${target.name} (${targetTeam})`);
      }
    }
  }

  console.log('🧼 [NightResolver] Phase 5c: Janitor cleaning...');
  // Clean roles for players directly targeted by clean_role (dead players)
  for (const playerId of janitorTargets) {
    const player = idMap.get(playerId);
    if (!player || player.alive) continue; // Only clean if dead
    
    // Hide role from everyone
    player.roleHidden = true;
    toSave.add(playerId);
    console.log(`  🧼 ${player.name}'s role has been cleaned (hidden)`);
  }
  
  // Also clean roles for players who were marked_for_cleaning while alive and died this night
  for (const player of players) {
    if (!player || player.alive) continue; // Only process dead players
    
    if (hasEffect(player, 'marked_for_cleaning')) {
      // Hide role from everyone
      player.roleHidden = true;
      // Remove the effect since the role is now hidden (effect no longer needed)
      removeEffects(player, e => e.type === 'marked_for_cleaning');
      toSave.add(player._id.toString());
      console.log(`  🧼 ${player.name}'s role has been cleaned (was marked for cleaning, now dead)`);
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
