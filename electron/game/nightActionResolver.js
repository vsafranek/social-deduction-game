// electron/game/night_actionResolver.js

const { ROLES } = require("../models/Role");

/**
 * Helper functions
 */
function hasEffect(player, effectType) {
  const now = new Date();
  return (player.effects || []).some(
    (e) => e.type === effectType && (!e.expiresAt || e.expiresAt > now)
  );
}

function addEffect(player, type, sourceId = null, expiresAt = null, meta = {}) {
  if (!player.effects) player.effects = [];
  player.effects.push({
    type,
    source: sourceId,
    addedAt: new Date(),
    expiresAt,
    meta,
  });
}

function getRandomPlayerNames(players, excludeId, count = 1) {
  const candidates = players.filter(
    (p) => p.alive && p.id.toString() !== excludeId
  );

  const shuffled = candidates.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((p) => p.name);
}

function removeEffects(player, predicate) {
  if (!player.effects) return;
  player.effects = player.effects.filter((e) => !predicate(e));
}

function clearExpiredEffects(players) {
  const now = new Date();
  for (const p of players) {
    if (!p.effects) continue;
    p.effects = p.effects.filter((e) => !e.expiresAt || e.expiresAt > now);
  }
}

/**
 * Generate fake success message for drunk player based on action type
 * Generates random results instead of fixed values
 */
function generateDrunkFakeMessage(action, targetName, players = []) {
  // Get all available roles for random selection
  const allRoles = Object.keys(ROLES);
  const goodRoles = allRoles.filter((r) => ROLES[r].team === "good");
  const evilRoles = allRoles.filter((r) => ROLES[r].team === "evil");
  const neutralRoles = allRoles.filter((r) => ROLES[r].team === "neutral");

  // Helper to get random role from array
  const getRandomRole = (roleArray) => {
    if (roleArray.length === 0) return "Citizen";
    return roleArray[Math.floor(Math.random() * roleArray.length)];
  };

  // Helper to get random player names
  const getRandomPlayerNames = (count = 1) => {
    const alivePlayers = players.filter(
      (p) => p.alive && p.name !== targetName
    );
    if (alivePlayers.length === 0) return [];
    const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((p) => p.name);
  };

  switch (action) {
    case "protect":
      return `success:Chráníš ${targetName}`;

    case "block":
      return `success:Uzamkl jsi ${targetName}`;

    case "investigate": {
      // Random two roles (one good, one evil/neutral)
      const role1 = getRandomRole(goodRoles);
      const role2 = getRandomRole([...evilRoles, ...neutralRoles]);
      const roles = Math.random() < 0.5 ? [role1, role2] : [role2, role1];
      return `investigate:${targetName} = ${roles.join(" / ")}`;
    }

    case "autopsy": {
      // Random role
      const randomRole = getRandomRole(allRoles);
      return `autopsy:${targetName} = ${randomRole}`;
    }

    case "watch": {
      // Random visitors or quiet night - use new lookout result types
      const visitorCount = Math.floor(Math.random() * 4);
      if (visitorCount === 0) {
        return `lookout_quiet:U ${targetName} nikdo nebyl`;
      }
      const visitors = getRandomPlayerNames(visitorCount);
      if (visitors.length === 0) {
        return `lookout_quiet:U ${targetName} nikdo nebyl`;
      }
      return `lookout_visitors:U ${targetName} navštívili: ${visitors.join(
        ", "
      )}`;
    }

    case "track": {
      // Random target went somewhere or stayed home - use new tracker result types
      if (Math.random() < 0.5) {
        return `tracker_stayed:${targetName} zůstal doma`;
      }
      const trackedTargets = getRandomPlayerNames(1);
      if (trackedTargets.length === 0) {
        return `tracker_stayed:${targetName} zůstal doma`;
      }
      return `tracker_followed:${targetName} navštívil ${trackedTargets[0]}`;
    }

    case "kill":
    case "clean_kill":
      return `success:Zaútočil jsi na ${targetName}`;

    case "frame":
      return `success:Obvinil jsi ${targetName}`;

    case "infect":
      return `success:Nakazil jsi ${targetName}`;

    case "guard":
      return `success:Nastavil jsi stráž u ${targetName}`;

    case "witch_control":
      return `success:Ovladla jsi hráče, aby cílil na ${targetName}`;

    default:
      return `success:Akce provedena`;
  }
}

/**
 * Main night action resolver with priority ordering
 */
async function resolveNightActions(game, players) {
  console.log("🌙 [NightResolver] Starting night action resolution...");

  // Create idMap and update players array reference
  const idMap = new Map(players.map((p) => [p.id.toString(), p]));

  // Helper to update both idMap and players array
  const updatePlayerInMemory = (player) => {
    const playerIdStr = player.id.toString();
    idMap.set(playerIdStr, player);
    const index = players.findIndex((p) => p.id.toString() === playerIdStr);
    if (index !== -1) {
      players[index] = player;
    }
  };

  // Initialize tracking sets and maps
  const blocked = new Set();
  const guarded = new Set();
  const allVisits = [];
  const drunkPlayers = new Set();
  const jailTargets = new Map();
  const guardTargets = new Map(); // Track Guardian targets for feedback
  const watchTargets = new Map(); // Track Lookout targets for feedback
  const trackTargets = new Map(); // Track Tracker targets for feedback
  const hunterKills = new Map();
  const janitorTargets = new Set();

  // ✅ Clear ALL temporary effects from previous night
  // NOTE: marked_for_cleaning should persist across nights until player dies
  for (const p of players) {
    removeEffects(
      p,
      (e) =>
        e.type === "blocked" ||
        e.type === "guarded" ||
        e.type === "protected" ||
        e.type === "guard"
      // marked_for_cleaning is NOT removed here - it persists until player dies
    );
  }

  // Clear previous results
  for (const p of players) {
    if (!p.night_action) {
      p.night_action = { targetId: null, action: null, results: [] };
    }
    p.night_action.results = [];
  }

  clearExpiredEffects(players);

  // PHASE 0: Handle Witch control - must happen BEFORE collecting other actions
  // Witch controls other players by overriding their target
  console.log("🧙‍♀️ [NightResolver] Phase 0: Witch control...");
  const witchControls = [];
  for (const actor of players) {
    if (!actor.alive || actor.role !== "Witch") continue;

    const action = actor.night_action?.action;
    const targetId = actor.night_action?.targetId?.toString();
    const puppetId = actor.night_action?.puppetId?.toString();

    if (action !== "witch_control" || !targetId || !puppetId) {
      if (actor.role === "Witch" && (!action || action !== "witch_control")) {
        console.log(`  ⚠️ ${actor.name} (Witch) has no valid control action`);
      }
      continue;
    }

    const puppet = idMap.get(puppetId);
    const controlledTarget = idMap.get(targetId);

    if (!puppet || !puppet.alive) {
      console.log(`  ⚠️ ${actor.name}: Puppet not found or dead`);
      actor.night_action.results.push(
        "failed:Loutka není naživu nebo neexistuje"
      );
      continue;
    }

    if (!controlledTarget || !controlledTarget.alive) {
      console.log(`  ⚠️ ${actor.name}: Controlled target not found or dead`);
      actor.night_action.results.push("failed:Cíl není naživu nebo neexistuje");
      continue;
    }

    // Puppet must have a night action
    if (!puppet.role || puppet.role === "Citizen" || puppet.role === "Jester") {
      console.log(
        `  ⚠️ ${actor.name}: Puppet (${puppet.name}) has no night action`
      );
      actor.night_action.results.push(`failed:${puppet.name} nemá noční akci`);
      continue;
    }

    const puppetRoleData = ROLES[puppet.role];
    if (
      !puppetRoleData ||
      !puppetRoleData.actionType ||
      puppetRoleData.actionType === "none"
    ) {
      console.log(
        `  ⚠️ ${actor.name}: Puppet (${puppet.name}) has no valid night action`
      );
      actor.night_action.results.push(
        `failed:${puppet.name} nemá platnou noční akci`
      );
      continue;
    }

    // Store witch control info
    witchControls.push({
      witchId: actor.id.toString(),
      puppetId,
      controlledTargetId: targetId,
      witchName: actor.name,
      puppetName: puppet.name,
      controlledTargetName: controlledTarget.name,
    });

    console.log(
      `  🧙‍♀️ ${actor.name} controlling ${puppet.name} to target ${controlledTarget.name}`
    );

    // Override puppet's action target
    // Save original target for results
    if (!puppet.role_data) puppet.role_data = {};
    puppet.role_data.originalTargetId = puppet.night_action?.targetId || null;
    puppet.role_data.originalAction = puppet.night_action?.action || null;
    puppet.role_data.controlledByWitch = true;
    puppet.role_data.witchId = actor.id;

    // Set puppet's action to controlled target
    if (!puppet.night_action) {
      puppet.night_action = { targetId: null, action: null, results: [] };
    }

    // Determine puppet's action type based on their role
    // If puppet already has an action set, use it (for dual roles)
    // Otherwise, determine action from role definition
    let puppetAction = puppet.night_action.action;

    if (!puppetAction) {
      // Puppet hasn't set their action yet - determine from role
      const puppetRoleData = ROLES[puppet.role];
      if (puppetRoleData?.actionType === "dual") {
        // For dual roles, default to 'kill' (the always-available action)
        puppetAction = "kill";
      } else {
        // Use the role's action type
        puppetAction = puppetRoleData?.actionType || null;
      }
    }

    // Override puppet's action target AND ensure action is set
    puppet.night_action.targetId = controlledTarget.id;
    puppet.night_action.action = puppetAction;

    // Changes will be saved by route handler via batch update

    // Update both idMap and players array with modified puppet
    updatePlayerInMemory(puppet);

    console.log(
      `  🧙‍♀️ ${puppet.name} action overridden: ${puppetAction} → ${controlledTarget.name} (saved)`
    );
    console.log(
      `    Puppet night_action:`,
      JSON.stringify(puppet.night_action, null, 2)
    );

    // Witch only gets success message - she doesn't see puppet's action results
    actor.night_action.results.push(
      `success:Ovladla jsi ${puppet.name}, aby použil svou schopnost na ${controlledTarget.name}`
    );
  }

  // PHASE 1: Collect and validate all actions
  console.log("📋 [NightResolver] Phase 1: Collecting actions...");
  const actionsToResolve = [];

  for (const actor of players) {
    if (!actor.alive) continue;

    const action = actor.night_action?.action;
    const targetId = actor.night_action?.targetId?.toString();

    if (!action || !targetId) continue;

    const target = idMap.get(targetId);
    if (!target) {
      console.log(`  ⚠️ ${actor.name}: Invalid target`);
      continue;
    }

    // Most actions require alive target, but some actions need to validate dead targets themselves
    // autopsy and clean_role can target dead players
    // investigate, consig_investigate, and infect need to validate dead targets and provide user feedback
    if (
      action !== "autopsy" &&
      action !== "clean_role" &&
      action !== "investigate" &&
      action !== "consig_investigate" &&
      action !== "infect" &&
      action !== "witch_control" &&
      !target.alive
    ) {
      console.log(
        `  ⚠️ ${actor.name}: Target must be alive for action ${action}`
      );
      continue;
    }

    // Get priority from role
    const role_data = ROLES[actor.role];
    let priority = role_data?.nightPriority || 5;

    // Adjust priority for specific actions that need to happen before investigation
    // Accuser's frame action must happen before Investigator (priority 5)
    if (actor.role === "Accuser" && action === "frame") {
      priority = 4; // Higher priority than Investigator (5)
    }

    // Skip witch_control actions from being resolved normally (already handled in Phase 0)
    if (action === "witch_control") {
      continue;
    }

    actionsToResolve.push({
      actorId: actor.id.toString(),
      targetId,
      action,
      priority,
      actorName: actor.name,
      targetName: target.name,
      controlledByWitch: actor.role_data?.controlledByWitch || false,
    });
  }

  // Sort by priority (lower number = earlier)
  actionsToResolve.sort((a, b) => a.priority - b.priority);

  console.log("🔢 [NightResolver] Action order by priority:");
  actionsToResolve.forEach((a, idx) => {
    console.log(
      `  ${idx + 1}. [P${a.priority}] ${a.actorName} → ${a.action} → ${
        a.targetName
      }`
    );
  });

  // PHASE 2: Process actions in priority order
  console.log("⚡ [NightResolver] Phase 2: Processing actions by priority...");
  const visitsByTarget = new Map();

  for (const actionData of actionsToResolve) {
    const { actorId, targetId, action } = actionData;
    const actor = idMap.get(actorId);
    const target = idMap.get(targetId);

    if (!actor || !target) continue;

    // Check drunk FIRST
    // ✅ SerialKiller cannot be stopped by Drunk modifier - he always acts
    if (actor.modifier === "Drunk" && actor.role !== "SerialKiller") {
      drunkPlayers.add(actorId);
      const fakeMessage = generateDrunkFakeMessage(
        action,
        target.name,
        players
      );
      actor.night_action.results.push(fakeMessage);
      console.log(
        `  🍺 ${actor.name}: Too drunk - stayed home (fake: ${action} → ${target.name})`
      );
      continue;
    }

    // Check if actor is blocked
    // ✅ SerialKiller cannot be blocked - he always goes first and cannot be stopped
    if (hasEffect(actor, "blocked") && actor.role !== "SerialKiller") {
      if (!blocked.has(actorId)) {
        blocked.add(actorId);
        // Jailer-specific feedback for blocked target
        actor.night_action.results.push(
          "jailer_prevented:Pokusil jsi se odejít, ale byl jsi zadržen"
        );
        console.log(`  🔒 ${actor.name}: Blocked by Jailer`);
      }
      continue;
    }

    // Check for guard
    // ✅ SerialKiller cannot be guarded - he always goes first and cannot be stopped
    if (hasEffect(target, "guard") && actor.role !== "SerialKiller") {
      if (!guarded.has(actorId)) {
        guarded.add(actorId);
        addEffect(actor, "guarded", null, null, {});
        actor.night_action.results.push("guardian_prevented:Stráž");
        console.log(`  🛡️ ${actor.name}: Guarded by ${target.name}`);
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
      case "block": {
        // ✅ SerialKiller cannot be blocked - remove blocked effect if target is SerialKiller
        if (target.role === "SerialKiller") {
          console.log(
            `  👮 [P${actionData.priority}] ${actor.name} tried to jail ${target.name} (SerialKiller) - FAILED (SerialKiller cannot be blocked)`
          );
          actor.night_action.results.push(
            `failed:${target.name} je SerialKiller - nemůže být zablokován`
          );
          break;
        }

        addEffect(target, "blocked", actor.id, null, {});

        // ✅ Track this jail for later feedback
        jailTargets.set(actorId, targetId);

        // Don't give success message yet - will do it in PHASE 3
        console.log(
          `  👮 [P${actionData.priority}] ${actor.name} jailing ${target.name}...`
        );
        break;
      }

      case "guard": {
        // Guardian nastaví stráž u cílového hráče, ne u sebe
        addEffect(target, "guard", actor.id, null, {});

        // ✅ Track this guard for later feedback
        guardTargets.set(actorId, targetId);

        // Don't give success message yet - will do it in PHASE 3
        console.log(
          `  🛡️ [P${actionData.priority}] ${actor.name} set a guard on ${target.name}'s house`
        );
        break;
      }

      case "watch": {
        // ✅ Track this watch for later feedback
        watchTargets.set(actorId, targetId);
        console.log(
          `  👁️ [P${actionData.priority}] ${actor.name} watching ${target.name}`
        );
        break;
      }

      case "track": {
        // ✅ Track this track for later feedback
        trackTargets.set(actorId, targetId);
        console.log(
          `  👣 [P${actionData.priority}] ${actor.name} tracking ${target.name}`
        );
        break;
      }

      case "investigate": {
        // Investigator can only investigate alive players
        // If target is dead and role is hidden (cleaned), investigation fails
        if (!target.alive && target.role_hidden) {
          actor.night_action.results.push(
            `failed:Nemůžeš vyšetřit ${target.name} - role byla vyčištěna`
          );
          console.log(
            `  🔍 [P${actionData.priority}] ${actor.name} cannot investigate ${target.name} - role hidden`
          );
          break;
        }

        // Investigator only works on alive players
        if (!target.alive) {
          actor.night_action.results.push(
            `failed:Nemůžeš vyšetřit mrtvého hráče - použij Coroner`
          );
          console.log(
            `  🔍 [P${actionData.priority}] ${actor.name} cannot investigate dead player ${target.name}`
          );
          break;
        }

        const trueRole = target.role;
        const allRoles = Object.keys(ROLES);

        // ✅ Check if target is marked for cleaning - show completely fake results
        if (hasEffect(target, "marked_for_cleaning")) {
          // Both roles are fake (random) - MUST exclude true role
          const fakeRoles = allRoles.filter((r) => r !== trueRole);

          if (fakeRoles.length === 0) {
            // Edge case: only one role exists (shouldn't happen in normal game)
            actor.night_action.results.push(
              `investigate:${target.name} = Unknown / Unknown`
            );
            console.log(
              `  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: Unknown / Unknown (FAKE - marked for cleaning, true: ${trueRole}, no fake roles available)`
            );
            break;
          }

          const fakeRole1 =
            fakeRoles[Math.floor(Math.random() * fakeRoles.length)];
          const otherFakeRoles = fakeRoles.filter((r) => r !== fakeRole1);

          // If only one fake role available, use it twice to avoid revealing true role
          const fakeRole2 =
            otherFakeRoles.length > 0
              ? otherFakeRoles[
                  Math.floor(Math.random() * otherFakeRoles.length)
                ]
              : fakeRole1; // Reuse fakeRole1 instead of falling back to 'Citizen'

          const possibleRoles =
            Math.random() < 0.5
              ? [fakeRole1, fakeRole2]
              : [fakeRole2, fakeRole1];

          actor.night_action.results.push(
            `investigate:${target.name} = ${possibleRoles.join(" / ")}`
          );

          // Store investigation history (even for fake results)
          if (!actor.role_data) actor.role_data = {};
          if (!actor.role_data.investigationHistory)
            actor.role_data.investigationHistory = {};

          actor.role_data.investigationHistory[targetId] = {
            type: "investigate",
            roles: possibleRoles.join(" / "),
            detail: `${target.name} = ${possibleRoles.join(" / ")}`,
            round: game.round,
          };
          console.log(
            `  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: ` +
              `${possibleRoles.join(
                " / "
              )} (FAKE - marked for cleaning, true: ${trueRole})`
          );
          break;
        }

        // ✅ Check Shady modifier - show true role + evil role
        // ✅ Check Innocent modifier - appear as good or neutral
        // ✅ Check framed effect - show evil role instead of true role
        let possibleRoles;

        if (target.modifier === "Shady") {
          // Shady: show true role + one evil role
          const evilRoles = Object.keys(ROLES).filter(
            (r) => ROLES[r].team === "evil"
          );
          const evilRole =
            evilRoles[Math.floor(Math.random() * evilRoles.length)] ||
            "Cleaner";
          possibleRoles =
            Math.random() < 0.5 ? [trueRole, evilRole] : [evilRole, trueRole];
        } else if (target.modifier === "Innocent") {
          // Innocent: show good/neutral role instead of true role
          const goodOrNeutralRoles = Object.keys(ROLES).filter(
            (r) => ROLES[r].team === "good" || ROLES[r].team === "neutral"
          );
          const fakeGoodOrNeutral =
            goodOrNeutralRoles[
              Math.floor(Math.random() * goodOrNeutralRoles.length)
            ] || "Citizen";
          const otherRoles = allRoles.filter(
            (r) => r !== trueRole && r !== fakeGoodOrNeutral
          );
          const fakeRole =
            otherRoles.length > 0
              ? otherRoles[Math.floor(Math.random() * otherRoles.length)]
              : "Citizen";
          possibleRoles =
            Math.random() < 0.5
              ? [fakeGoodOrNeutral, fakeRole]
              : [fakeRole, fakeGoodOrNeutral];
        } else if (hasEffect(target, "framed")) {
          // Framed: show evil role instead of true role
          const framedEffect = target.effects.find((e) => e.type === "framed");
          const fakeEvilRole = framedEffect?.meta?.fakeEvilRole || "Cleaner";
          const otherRoles = allRoles.filter(
            (r) => r !== trueRole && r !== fakeEvilRole
          );
          const fakeRole =
            otherRoles.length > 0
              ? otherRoles[Math.floor(Math.random() * otherRoles.length)]
              : "Citizen";
          possibleRoles =
            Math.random() < 0.5
              ? [fakeEvilRole, fakeRole]
              : [fakeRole, fakeEvilRole];
        } else {
          // Normal investigation: show true role + one random other role
          const otherRoles = allRoles.filter((r) => r !== trueRole);
          const fakeRole =
            otherRoles.length > 0
              ? otherRoles[Math.floor(Math.random() * otherRoles.length)]
              : "Citizen";
          possibleRoles =
            Math.random() < 0.5 ? [trueRole, fakeRole] : [fakeRole, trueRole];
        }

        actor.night_action.results.push(
          `investigate:${target.name} = ${possibleRoles.join(" / ")}`
        );

        // Store investigation history in role_data (similar to Infected visitedPlayers)
        if (!actor.role_data) actor.role_data = {};
        if (!actor.role_data.investigationHistory)
          actor.role_data.investigationHistory = {};

        actor.role_data.investigationHistory[targetId] = {
          type: "investigate",
          roles: possibleRoles.join(" / "),
          detail: `${target.name} = ${possibleRoles.join(" / ")}`,
          round: game.round,
        };
        const modifiers = [];
        if (target.modifier === "Shady") modifiers.push("Shady");
        if (target.modifier === "Innocent") modifiers.push("Innocent");
        if (hasEffect(target, "framed")) modifiers.push("framed");

        console.log(
          `  🔍 [P${actionData.priority}] ${actor.name} investigated ${target.name}: ` +
            `${possibleRoles.join(" / ")} (true: ${trueRole}${
              modifiers.length > 0 ? " [" + modifiers.join(", ") + "]" : ""
            })`
        );
        break;
      }

      case "autopsy": {
        // Coroner can only investigate dead players
        if (target.alive) {
          actor.night_action.results.push(
            `failed:Nemůžeš provést pitvu na živém hráči - ${target.name} je stále naživu`
          );
          console.log(
            `  🔬 [P${actionData.priority}] ${actor.name} cannot autopsy alive player ${target.name}`
          );
          break;
        }

        // If role is hidden (cleaned), Coroner gets "Unknown" result
        if (target.role_hidden) {
          actor.night_action.results.push(
            `autopsy:${target.name} = Unknown (role byla vyčištěna)`
          );
          console.log(
            `  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: Unknown (role hidden)`
          );
          break;
        }

        // Check if player was framed - show the fake evil role that Investigator saw
        let exactRole = target.role || "Unknown";
        if (hasEffect(target, "framed")) {
          const framedEffect = target.effects.find((e) => e.type === "framed");
          exactRole = framedEffect?.meta?.fakeEvilRole || "Cleaner";
          console.log(
            `  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: ${exactRole} (framed evil role, true: ${target.role})`
          );
        } else {
          console.log(
            `  🔬 [P${actionData.priority}] ${actor.name} autopsied ${target.name}: ${exactRole}`
          );
        }

        actor.night_action.results.push(
          `autopsy:${target.name} = ${exactRole}`
        );

        // Store autopsy history in role_data (similar to Infected visitedPlayers)
        if (!actor.role_data) actor.role_data = {};
        if (!actor.role_data.investigationHistory)
          actor.role_data.investigationHistory = {};

        actor.role_data.investigationHistory[targetId] = {
          type: "autopsy",
          roles: exactRole,
          detail: `${target.name} = ${exactRole}`,
          round: game.round,
        };
        break;
      }

      case "infect": {
        // Infected can only infect alive players
        if (!target.alive) {
          actor.night_action.results.push(
            `failed:Nemůžeš nakazit mrtvého hráče - ${target.name} je mrtvý`
          );
          console.log(
            `  🦠 [P${actionData.priority}] ${actor.name} cannot infect dead player ${target.name}`
          );
          break;
        }

        if (!hasEffect(target, "infected")) {
          addEffect(target, "infected", actor.id, null, {});
          actor.night_action.results.push(`success:Nakazil ${target.name}`);
          console.log(
            `  🦠 [P${actionData.priority}] ${actor.name} infected ${target.name}`
          );
        }

        // Sleduj navštívené hráče pro Infected roli
        if (!actor.role_data) actor.role_data = {};
        if (!actor.role_data.visitedPlayers)
          actor.role_data.visitedPlayers = [];

        // Přidej cílového hráče do seznamu navštívených (pokud tam ještě není)
        // Použij bezpečný pattern s optional chaining a filter (stejně jako v victoryEvaluator.js)
        const visitedIds = actor.role_data.visitedPlayers
          .map((id) => id?.toString())
          .filter(Boolean);
        if (!visitedIds.includes(targetId)) {
          actor.role_data.visitedPlayers.push(target.id);
          console.log(
            `  📝 ${actor.name} visited ${target.name} (total visited: ${actor.role_data.visitedPlayers.length})`
          );
        }
        break;
      }

      case "kill": {
        addEffect(target, "pendingKill", actor.id, null, {});
        actor.night_action.results.push(`success:Zaútočil ${target.name}`);
        console.log(
          `  🔪 [P${actionData.priority}] ${actor.name} killed ${target.name}`
        );
        break;
      }

      case "clean_role": {
        // Cleaner can mark players for cleaning
        // If target is alive: Investigator will see fake results
        // If target is dead: role will be hidden
        if (!actor.role_data) actor.role_data = {};
        const usesLeft = actor.role_data.usesRemaining || 0;

        if (usesLeft > 0) {
          // Decrement uses first, then show message with correct remaining count
          actor.role_data.usesRemaining = usesLeft - 1;

          if (target.alive) {
            // Mark alive player - Investigator will see fake investigation results
            addEffect(target, "marked_for_cleaning", actor.id, null, {});
            actor.night_action.results.push(
              `success:Označil ${target.name} (${actor.role_data.usesRemaining})`
            );
            console.log(
              `  🧹 [P${actionData.priority}] ${actor.name} marked ${target.name} for cleaning (alive)`
            );
          } else {
            // Mark dead player - role will be hidden
            janitorTargets.add(targetId);
            actor.night_action.results.push(
              `success:Vyčistíš ${target.name} (${actor.role_data.usesRemaining})`
            );
            console.log(
              `  🧹 [P${actionData.priority}] ${actor.name} will clean ${target.name} (dead)`
            );
          }
        } else {
          actor.night_action.results.push("failed:Žádná použití");
        }
        break;
      }

      case "frame": {
        if (!actor.role_data) actor.role_data = {};
        const usesLeft = actor.role_data.usesRemaining || 0;

        if (usesLeft > 0) {
          // Pick a random evil role to show instead of true role
          const evilRoles = Object.keys(ROLES).filter(
            (r) => ROLES[r].team === "evil"
          );
          const fakeEvilRole =
            evilRoles.length > 0
              ? evilRoles[Math.floor(Math.random() * evilRoles.length)]
              : "Cleaner";

          // Store the fake evil role in the effect meta
          addEffect(target, "framed", actor.id, null, { fakeEvilRole });
          actor.role_data.usesRemaining = usesLeft - 1;
          actor.night_action.results.push(
            `success:Obvinil ${target.name} (${actor.role_data.usesRemaining})`
          );
          console.log(
            `  👉 [P${actionData.priority}] ${actor.name} accused ${target.name} (framed, will show as: ${fakeEvilRole})`
          );
        } else {
          actor.night_action.results.push("failed:Žádná použití");
        }
        break;
      }

      case "consig_investigate": {
        // Consigliere can only investigate alive players
        if (!target.alive) {
          actor.night_action.results.push(
            `failed:Nemůžeš vyšetřit mrtvého hráče - ${target.name} je mrtvý`
          );
          console.log(
            `  🕵️ [P${actionData.priority}] ${actor.name} cannot investigate dead player ${target.name}`
          );
          break;
        }

        if (!actor.role_data) actor.role_data = {};
        const usesLeft = actor.role_data.usesRemaining || 0;

        if (usesLeft > 0) {
          // Consigliere always sees the true role (not affected by cleaning or framing)
          const exactRole = target.role;

          actor.role_data.usesRemaining = usesLeft - 1;
          actor.night_action.results.push(
            `consig:${target.name} = ${exactRole} (${actor.role_data.usesRemaining})`
          );

          // Store investigation history in role_data (similar to Infected visitedPlayers)
          if (!actor.role_data) actor.role_data = {};
          if (!actor.role_data.investigationHistory)
            actor.role_data.investigationHistory = {};

          actor.role_data.investigationHistory[targetId] = {
            type: "consig",
            roles: exactRole,
            detail: `${target.name} = ${exactRole}`,
            round: game.round,
          };

          console.log(
            `  🕵️ [P${actionData.priority}] ${actor.name} investigated ${target.name}: ${exactRole} (true role)`
          );
        } else {
          actor.night_action.results.push("failed:Žádná použití");
        }
        break;
      }

      case "protect": {
        addEffect(target, "protected", actor.id, null, {});
        console.log(
          `  💉 [P${actionData.priority}] ${actor.name} protecting ${target.name}...`
        );
        break;
      }

      case "poison": {
        // Regular poison - victim dies next day, can be healed by Doctor
        addEffect(target, "poisoned", actor.id, null, { round: game.round });
        actor.night_action.results.push(`success:Otrávil ${target.name}`);
        console.log(
          `  ☠️ [P${actionData.priority}] ${actor.name} poisoned ${target.name} (will die next day if not cured)`
        );
        break;
      }

      case "strong_poison": {
        // Strong poison - one-time use, activates after Doctor visit, cannot be healed
        if (!actor.role_data) actor.role_data = {};
        const usesLeft =
          actor.role_data.usesRemaining !== undefined
            ? actor.role_data.usesRemaining
            : 1;

        if (usesLeft > 0) {
          actor.role_data.usesRemaining = usesLeft - 1;

          addEffect(target, "strong_poisoned", actor.id, null, {
            round: game.round,
            activated: false,
          });
          actor.night_action.results.push(
            `success:Použil silný jed na ${target.name} (${actor.role_data.usesRemaining} použití zbývá)`
          );
          console.log(
            `  💀 [P${actionData.priority}] ${actor.name} used strong poison on ${target.name} (will activate after Doctor visit)`
          );
        } else {
          actor.night_action.results.push("failed:Žádná použití silného jedu");
          console.log(
            `  ⚠️ [P${actionData.priority}] ${actor.name} tried to use strong poison but has no uses left`
          );
        }
        break;
      }

      case "hunter_kill": {
        // Hunter připraví kill (zkontroluje se po smrti)
        addEffect(target, "pendingKill", actor.id, null, { hunter: true });
        hunterKills.set(actorId, targetId);
        actor.night_action.results.push(`success:Zaútočil ${target.name}`);
        console.log(
          `  🏹 [P${actionData.priority}] ${actor.name} hunted ${target.name}`
        );
        break;
      }

      case "janitor_clean": {
        // Janitor může cílit na MRTVÉ hráče
        // Musíme implementovat výběr mrtvého hráče v UI
        // Pro teď: cílí na živého, ale vyčistí ho pokud zemře

        // Check if Janitor has uses left
        if (!actor.role_data) actor.role_data = {};
        if (!actor.role_data.janitorUses) actor.role_data.janitorUses = 3;

        if (actor.role_data.janitorUses > 0) {
          janitorTargets.add(targetId);
          actor.role_data.janitorUses -= 1;
          actor.night_action.results.push(
            `success:Vyčistíš ${target.name} (${actor.role_data.janitorUses})`
          );
          console.log(
            `  🧼 [P${actionData.priority}] ${actor.name} will clean ${target.name} if dead`
          );
        } else {
          actor.night_action.results.push("failed:Žádná použití");
          console.log(
            `  🧼 [P${actionData.priority}] ${actor.name} has no uses left`
          );
        }
        break;
      }

      default:
        console.log(`  ❓ Unknown action: ${action}`);
        break;
    }
  }

  // PHASE 3: Complete watch/track and Jailer/Guardian feedback
  console.log(
    "👁️ [NightResolver] Phase 3: Completing observations and Jailer/Guardian feedback..."
  );

  // ✅ Jailer feedback - check if target tried to leave
  for (const [jailerId, targetId] of jailTargets.entries()) {
    const jailer = idMap.get(jailerId);
    const target = idMap.get(targetId);
    if (!jailer || !target) continue;

    // Check if target tried to perform an action
    const targetTriedToAct = actionsToResolve.some(
      (a) => a.actorId === targetId && !drunkPlayers.has(targetId)
    );

    if (targetTriedToAct) {
      // Target tried to leave but was blocked by Jailer
      jailer.night_action.results.push(
        `jailer_blocked:Zadržel ${target.name} - pokusil se odejít`
      );
      console.log(
        `  👮 ${jailer.name}: ${target.name} tried to leave but was prevented`
      );
    } else {
      // Target stayed home (no action attempted) - Jailer still blocked them, but they didn't try to leave
      jailer.night_action.results.push(
        `jailer_home:Zadržel ${target.name} - zůstal doma`
      );
      // Target doesn't get a blocked message since they didn't try to do anything
      console.log(`  👮 ${jailer.name}: ${target.name} stayed home`);
    }
  }

  // ✅ Guardian feedback - check if anyone tried to visit the guarded target
  for (const [guardianId, targetId] of guardTargets.entries()) {
    const guardian = idMap.get(guardianId);
    const target = idMap.get(targetId);
    if (!guardian || !target) continue;

    // Check if anyone tried to visit the target and was stopped by guard
    // Look in actionsToResolve for actions targeting this guarded target
    // and check if the actor was added to guarded set (stopped by guard)
    const someoneWasStopped = actionsToResolve.some((actionData) => {
      if (actionData.targetId !== targetId) return false;
      const visitorId = actionData.actorId;
      // Skip if visitor was drunk (they didn't actually try to visit)
      if (drunkPlayers.has(visitorId)) return false;
      // Check if this visitor was guarded (stopped by guard)
      return guarded.has(visitorId);
    });

    if (someoneWasStopped) {
      // Someone tried to visit but was stopped by guard
      guardian.night_action.results.push(
        `guardian_stopped:Zastavil jsi návštěvníka u ${target.name}`
      );
      console.log(
        `  🛡️ ${guardian.name}: Someone was stopped at ${target.name}'s house`
      );
    } else {
      // No one tried to visit (or no one was stopped)
      guardian.night_action.results.push(
        `guardian_quiet:Nikdo nepřišel k ${target.name}`
      );
      console.log(
        `  🛡️ ${guardian.name}: No one came to ${target.name}'s house`
      );
    }
  }

  // ✅ Lookout feedback - check if anyone visited the watched target
  for (const [lookoutId, targetId] of watchTargets.entries()) {
    const lookout = idMap.get(lookoutId);
    const target = idMap.get(targetId);
    if (!lookout || !target) continue;

    // Get ONLY visitors who actually made it to the target
    // (not blocked, not drunk, not guarded)
    const successfulVisitors = allVisits
      .filter((visit) => {
        // Visit to this target
        if (visit.targetId !== targetId) return false;

        const visitorId = visit.actorId;
        const visitor = idMap.get(visitorId);
        if (!visitor) return false;

        // Skip self (lookout)
        if (visitorId === lookoutId) return false;

        // Check if visitor was blocked/drunk/guarded
        if (drunkPlayers.has(visitorId)) return false;
        if (blocked.has(visitorId)) return false;
        if (guarded.has(visitorId)) return false;

        return true;
      })
      .map((visit) => {
        const visitor = idMap.get(visit.actorId);
        return visitor?.name;
      })
      .filter(Boolean);

    if (successfulVisitors.length > 0) {
      // Someone visited the target
      lookout.night_action.results.push(
        `lookout_visitors:U ${
          target.name
        } navštívili: ${successfulVisitors.join(", ")}`
      );
      console.log(
        `  👁️ ${lookout.name} watched ${target.name}: ${successfulVisitors.join(
          ", "
        )}`
      );
    } else {
      // No one visited
      lookout.night_action.results.push(
        `lookout_quiet:U ${target.name} nikdo nebyl`
      );
      console.log(`  👁️ ${lookout.name} watched ${target.name}: nobody`);
    }
  }

  // ✅ Tracker feedback - check if target went somewhere or stayed home
  for (const [trackerId, targetId] of trackTargets.entries()) {
    const tracker = idMap.get(trackerId);
    const target = idMap.get(targetId);
    if (!tracker || !target) continue;

    // Check if target was drunk/blocked/guarded - stayed home
    if (
      drunkPlayers.has(targetId) ||
      blocked.has(targetId) ||
      guarded.has(targetId)
    ) {
      tracker.night_action.results.push(
        `tracker_stayed:${target.name} zůstal doma`
      );
      console.log(`  👣 ${tracker.name} tracked ${target.name} - stayed home`);
      continue;
    }

    // Target actually went somewhere - find where
    const targetVisit = allVisits.find((visit) => visit.actorId === targetId);

    if (targetVisit && targetVisit.targetId) {
      const destination = idMap.get(targetVisit.targetId);
      tracker.night_action.results.push(
        `tracker_followed:${target.name} navštívil ${destination?.name || "?"}`
      );
      console.log(
        `  👣 ${tracker.name} tracked ${target.name} → ${destination?.name}`
      );
    } else {
      // Target had no action or is Citizen
      tracker.night_action.results.push(
        `tracker_stayed:${target.name} zůstal doma`
      );
      console.log(
        `  👣 ${tracker.name} tracked ${target.name} - stayed home (no action)`
      );
    }
  }

  // PHASE 4: Inform targets about home invasions + Paranoid + Insomniac
  console.log(
    "📬 [NightResolver] Phase 4: Informing targets about home invasions..."
  );
  for (const [targetId, visitors] of visitsByTarget.entries()) {
    const target = idMap.get(targetId);
    if (!target) continue;

    const homeInvaders = [];

    for (const visitorName of visitors) {
      if (visitorName === target.name) continue;

      const visitorAction = allVisits.find((v) => {
        const actor = idMap.get(v.actorId);
        return actor && actor.name === visitorName && v.targetId === targetId;
      });

      if (visitorAction) {
        const actor = idMap.get(visitorAction.actorId);
        const role_data = ROLES[actor.role];

        if (role_data?.visitsTarget === true) {
          homeInvaders.push(visitorName);
        }
      }
    }

    if (homeInvaders.length > 0) {
      if (!target.night_action) {
        target.night_action = { targetId: null, action: null, results: [] };
      }

      const isBlocked = hasEffect(target, "blocked");
      const onlyJailer =
        homeInvaders.length === 1 &&
        homeInvaders.some((name) => {
          const p = Array.from(idMap.values()).find((pl) => pl.name === name);
          return p && p.role === "Jailer";
        });

      if (isBlocked && onlyJailer) {
        console.log(
          `  🔒 ${target.name} was blocked by Jailer only, skipping visited notification`
        );
        continue;
      }

      // Přidej informaci o návštěvě do výsledků cíle
      target.night_action.results.push(`visited:${homeInvaders.join(", ")}`);
      console.log(
        `  👤 ${target.name} was home-invaded by: ${homeInvaders.join(", ")}`
      );
    }
  }

  // ✅ PARANOID - Add fake visitors
  console.log("😱 [NightResolver] Phase 4b: Paranoid modifier...");
  for (const p of players) {
    if (!p.alive || p.modifier !== "Paranoid") continue;

    // 50% chance to see fake visitor
    if (Math.random() < 0.5) {
      const fakeVisitors = getRandomPlayerNames(players, p.id.toString(), 1);

      if (!p.night_action) {
        p.night_action = { targetId: null, action: null, results: [] };
      }

      const hasVisited = p.night_action.results.some((r) =>
        r.startsWith("visited:")
      );

      if (hasVisited) {
        // Add to existing visitors
        const visitedIdx = p.night_action.results.findIndex((r) =>
          r.startsWith("visited:")
        );
        const existing = p.night_action.results[visitedIdx].replace(
          "visited:",
          ""
        );
        p.night_action.results[
          visitedIdx
        ] = `visited:${existing}, ${fakeVisitors.join(", ")}`;
      } else {
        // Add new visited result
        p.night_action.results.push(`visited:${fakeVisitors.join(", ")}`);
      }

      console.log(
        `  😱 ${p.name} (Paranoid) sees fake visitor: ${fakeVisitors.join(
          ", "
        )}`
      );
    }
  }

  console.log("😵 [NightResolver] Phase 4c: Insomniac modifier...");
  for (const [targetId, visitors] of visitsByTarget.entries()) {
    const target = idMap.get(targetId);
    if (!target || !target.alive || target.modifier !== "Insomniac") continue;

    // Get all successful visitors (same logic as Lookout)
    const successfulVisitors = allVisits
      .filter((visit) => {
        if (visit.targetId !== targetId) return false;

        const visitorId = visit.actorId;
        const visitor = idMap.get(visitorId);
        if (!visitor) return false;

        if (visitorId === target.id.toString()) return false;

        if (drunkPlayers.has(visitorId)) return false;
        if (blocked.has(visitorId)) return false;
        if (guarded.has(visitorId)) return false;

        return true;
      })
      .map((visit) => {
        const visitor = idMap.get(visit.actorId);
        return visitor?.name;
      })
      .filter(Boolean);

    if (successfulVisitors.length > 0) {
      if (!target.night_action) {
        target.night_action = { targetId: null, action: null, results: [] };
      }

      target.night_action.results.push(
        `visited:${successfulVisitors.join(", ")}`
      );
      console.log(
        `  😵 ${target.name} (Insomniac) heard: ${successfulVisitors.join(
          ", "
        )}`
      );
    }
  }

  // PHASE 5: Resolve kills and Doctor feedback
  console.log(
    "💀 [NightResolver] Phase 5: Resolving kills and Doctor feedback..."
  );

  // Track which players Doctors protected
  const doctorProtections = new Map(); // doctorId -> targetId

  // First, find all Doctor protections
  for (const visit of allVisits) {
    if (visit.action === "protect") {
      const doctor = idMap.get(visit.actorId);
      const target = idMap.get(visit.targetId);
      if (doctor && target) {
        doctorProtections.set(visit.actorId, visit.targetId);
      }
    }
  }

  // Track processed Sweethearts to avoid duplicate effects
  const processedSweethearts = new Set();

  // Track who killed whom (for Hunter penalty check)
  const killSources = new Map(); // targetId -> { sourceId, wasHunterKill }

  // PHASE 5a: Process poison effects (regular and strong)
  console.log("☠️ [NightResolver] Phase 5a: Processing poison effects...");

  // Process regular poison effects
  for (const p of players) {
    if (!p.alive) continue;

    const poisonedEffects = (p.effects || []).filter(
      (e) => e.type === "poisoned"
    );
    if (poisonedEffects.length === 0) continue;

    // Check if poison was applied in previous round (not current round)
    // Poison kills the next day, so we check if it was applied before current round
    const poisonFromPreviousRound = poisonedEffects.some((e) => {
      const poisonRound = e.meta?.round || 0;
      return poisonRound < game.round;
    });

    if (poisonFromPreviousRound) {
      const isProtected = hasEffect(p, "protected");

      if (!p.night_action) {
        p.night_action = { targetId: null, action: null, results: [] };
      }
      if (!p.night_action.results) {
        p.night_action.results = [];
      }

      if (isProtected) {
        // Doctor cured the poison
        removeEffects(p, (e) => e.type === "poisoned");
        p.night_action.results.push("healed:Vyléčen z otravy");
        console.log(`  💚 ${p.name} was cured from poison by Doctor`);
      } else {
        // Poison kills - apply pendingKill with poisoned flag
        addEffect(p, "pendingKill", poisonedEffects[0].source, null, {
          poisoned: true,
        });
        console.log(`  ☠️ ${p.name} dies from poison (not protected)`);
      }
    }
  }

  // Process strong poison activation (activates after Doctor visit)
  for (const p of players) {
    if (!p.alive) continue;

    const strongPoisonedEffects = (p.effects || []).filter(
      (e) => e.type === "strong_poisoned"
    );
    if (strongPoisonedEffects.length === 0) continue;

    // Check if strong poison is not yet activated
    const unactivatedPoison = strongPoisonedEffects.find(
      (e) => !e.meta?.activated
    );
    if (!unactivatedPoison) continue;

    // Check if Doctor visited this night using doctorProtections map
    const playerId = p.id.toString();
    let doctorVisitedThisNight = false;
    for (const [doctorId, targetId] of doctorProtections.entries()) {
      if (targetId === playerId) {
        const doctor = idMap.get(doctorId);
        if (doctor && doctor.role === "Doctor") {
          doctorVisitedThisNight = true;
          break;
        }
      }
    }

    if (doctorVisitedThisNight) {
      // Doctor visited this night - activate strong poison (cannot be healed)
      unactivatedPoison.meta.activated = true;
      unactivatedPoison.meta.unhealable = true;

      // Apply pendingKill with unhealable and poisoned flags
      addEffect(p, "pendingKill", unactivatedPoison.source, null, {
        unhealable: true,
        poisoned: true,
      });

      if (!p.night_action) {
        p.night_action = { targetId: null, action: null, results: [] };
      }
      if (!p.night_action.results) {
        p.night_action.results = [];
      }

      console.log(
        `  💀 ${p.name} - strong poison activated after Doctor visit (cannot be healed)`
      );
    }
    // If Doctor didn't visit this night, keep the effect for next round
  }

  // Resolve kills
  for (const p of players) {
    if (!p.alive) continue;

    const pending = (p.effects || []).filter((e) => e.type === "pendingKill");
    if (!pending.length) continue;

    if (!p.night_action) {
      p.night_action = { targetId: null, action: null, results: [] };
    }
    if (!p.night_action.results) {
      p.night_action.results = [];
    }

    // Check if kill is unhealable (from strong poison)
    const unhealableKill = pending.some((e) => e.meta?.unhealable === true);
    const isProtected = hasEffect(p, "protected") && !unhealableKill;

    if (!isProtected) {
      // Player died
      p.alive = false;

      // Check if death was from poison
      const wasPoisoned = pending.some((e) => e.meta?.poisoned === true);
      if (wasPoisoned) {
        p.night_action.results.push("poisoned_killed:Zemřel na otravu");
      } else {
        p.night_action.results.push("killed:Zavražděn");
      }

      // Track kill source for Hunter penalty check
      const killSource = pending.find((e) => e.source);
      const wasHunterKill = pending.some((e) => e.meta?.hunter === true);
      if (killSource) {
        // Normalize sourceId to string for consistent comparison
        const sourceIdStr =
          killSource.source?.toString?.() || killSource.source;
        killSources.set(p.id.toString(), {
          sourceId: sourceIdStr,
          wasHunterKill: wasHunterKill,
        });
      }

      console.log(
        `  ☠️ ${p.name} was killed${
          unhealableKill ? " (unhealable - strong poison)" : ""
        }${wasHunterKill ? " (by Hunter)" : ""}`
      );

      // ✅ Sweetheart death effect (only process once per Sweetheart)
      if (
        p.modifier === "Sweetheart" &&
        !processedSweethearts.has(p.id.toString())
      ) {
        processedSweethearts.add(p.id.toString());
        const candidates = players.filter(
          (pl) =>
            pl.alive &&
            pl.modifier !== "Drunk" &&
            pl.modifier !== "Sweetheart" &&
            pl.id.toString() !== p.id.toString()
        );
        if (candidates.length > 0) {
          const victim =
            candidates[Math.floor(Math.random() * candidates.length)];
          victim.modifier = "Drunk";
          console.log(
            `  🍺 Sweetheart ${p.name} died... ${victim.name} became Drunk!`
          );
        }
      }

      // Check if mayor died - remove mayor status
      const currentMayorId = game.mayor_id || game.mayor;
      if (currentMayorId && currentMayorId.toString() === p.id.toString()) {
        p.vote_weight = 1; // Remove mayor vote weight
        game.mayor_id = null; // No new mayor can be elected
        game.mayor = null; // Also set for compatibility
        console.log(`  🏛️ Mayor ${p.name} was killed - mayor status removed`);
        // Note: game updates will be applied by the route handler after night resolution
      }
    } else {
      // Player was saved
      // Check if attack was from Hunter or from killer (evil role)
      const wasHunterAttack = pending.some((e) => e.meta?.hunter === true);
      if (wasHunterAttack) {
        p.night_action.results.push("attacked_hunter:Napaden lovcem");
      } else {
        p.night_action.results.push("attacked_killer:Napaden vrahem");
      }
      p.night_action.results.push("healed:Zachráněn");
      console.log(
        `  💚 ${p.name} was attacked but saved${
          wasHunterAttack ? " (by Hunter)" : " (by killer)"
        }`
      );
    }

    removeEffects(p, (e) => e.type === "pendingKill");
  }

  // PHASE 6: Give controlled puppets their results (as if they chose the target themselves)
  console.log(
    "🧙‍♀️ [NightResolver] Phase 6: Witch control results for puppets..."
  );
  for (const control of witchControls) {
    const puppet = idMap.get(control.puppetId);
    if (!puppet || !puppet.alive) continue;

    // Puppet should get normal results for their action on the controlled target
    // Results are already generated in Phase 2, but we need to ensure puppet sees them correctly
    // The puppet's results should show as if they chose the target themselves
    // (Results are already in puppet.night_action.results from Phase 2)

    console.log(
      `  🧙‍♀️ ${control.witchName} controlled ${control.puppetName} - puppet got normal results`
    );
  }

  // Give Doctors feedback
  console.log("💉 [NightResolver] Phase 5b: Doctor feedback...");
  for (const [doctorId, targetId] of doctorProtections.entries()) {
    const doctor = idMap.get(doctorId);
    const target = idMap.get(targetId);
    if (!doctor || !target) continue;

    // Check if target was attacked and saved (has 'attacked_killer:' or 'attacked_hunter:' and 'healed:' results)
    // or was poisoned and cured (has 'healed:Vyléčen z otravy' result)
    const targetResults = target.night_action?.results || [];
    const wasAttackedAndSaved =
      (targetResults.some((r) => r.startsWith("attacked_killer:")) ||
        targetResults.some((r) => r.startsWith("attacked_hunter:"))) &&
      targetResults.some((r) => r.startsWith("healed:"));
    const wasPoisonedAndCured = targetResults.some(
      (r) => r === "healed:Vyléčen z otravy"
    );

    if (wasAttackedAndSaved || wasPoisonedAndCured) {
      // Doctor saved someone or cured poison!
      doctor.night_action.results.push(
        `doctor_saved:Úspěšně jsi zachránil ${target.name}`
      );
      console.log(`  💉 ${doctor.name}: Successfully saved ${target.name}`);
    } else {
      // Target wasn't attacked - Doctor's services weren't needed
      doctor.night_action.results.push(
        `doctor_quiet:Chránil jsi ${target.name}, ale služby nebyly potřeba`
      );
      console.log(`  💉 ${doctor.name}: Protected ${target.name} (no attack)`);
    }
  }

  console.log("🏹 [NightResolver] Phase 5b: Hunter penalty check...");
  for (const [hunterId, targetId] of hunterKills.entries()) {
    const hunter = idMap.get(hunterId);
    const target = idMap.get(targetId);

    if (!hunter || !hunter.alive) continue; // Hunter already dead
    if (!target) continue;

    const targetTeam = ROLES[target.role]?.team;
    const killInfo = killSources.get(targetId);

    // Normalize IDs to strings for comparison
    const killSourceId = killInfo?.sourceId?.toString();
    const normalizedHunterId = hunterId.toString();
    const wasKilledByThisHunter =
      killInfo && killSourceId === normalizedHunterId && killInfo.wasHunterKill;

    // Check if target was attacked but saved (has attacked_killer/attacked_hunter AND healed results)
    // Must have BOTH attack result AND heal result (not just either one)
    const targetResults = target.night_action?.results || [];
    const wasAttackedButSaved =
      target.alive &&
      (targetResults.some((r) => r.startsWith("attacked_killer:")) ||
        targetResults.some((r) => r.startsWith("attacked_hunter:"))) &&
      targetResults.some((r) => r.startsWith("healed:"));

    if (wasKilledByThisHunter && !target.alive) {
      // Target died from this Hunter's attack
      // First, add story about killing the target (regardless of team)
      if (!hunter.night_action) {
        hunter.night_action = { targetId: null, action: null, results: [] };
      }
      // Remove the generic success message
      hunter.night_action.results = hunter.night_action.results.filter(
        (r) => !r.includes(`Zaútočil ${target.name}`)
      );
      // Add story about killing the target
      hunter.night_action.results.push(`hunter_kill:Zabil ${target.name}`);

      // If killed good player, Hunter dies - add guilt story after kill story
      if (targetTeam === "good") {
        hunter.alive = false;
        hunter.night_action.results.push(
          "hunter_guilt:Zabil nevinného a zemřel z viny"
        );
        console.log(
          `  💀 ${hunter.name} died from guilt (killed innocent ${target.name}, team: ${targetTeam})`
        );
      } else {
        // Killed evil/neutral - success
        hunter.night_action.results.push(
          `hunter_success:Úspěšně jsi zabil ${target.name}`
        );
        console.log(
          `  ✅ ${hunter.name} successfully killed ${target.name} (${targetTeam})`
        );
      }
    } else if (wasAttackedButSaved) {
      // Target was attacked but saved by Doctor - no penalty
      if (!hunter.night_action) {
        hunter.night_action = { targetId: null, action: null, results: [] };
      }
      // Remove the generic success message
      hunter.night_action.results = hunter.night_action.results.filter(
        (r) => !r.includes(`Zaútočil ${target.name}`)
      );
      hunter.night_action.results.push(
        `hunter_kill:Zaútočil na ${target.name}, ale byl zachráněn`
      );
      console.log(
        `  🛡️ ${hunter.name} attacked ${target.name} but target was saved`
      );
    } else if (!target.alive && !wasKilledByThisHunter) {
      // Target died but not from this Hunter (maybe from another source)
      // No action needed - Hunter didn't kill them
      console.log(
        `  ℹ️ ${hunter.name} attacked ${target.name} but target died from another cause`
      );
    } else {
      // Target is still alive and wasn't attacked - this shouldn't happen normally
      // But handle gracefully - maybe target was blocked or something else happened
      console.log(
        `  ⚠️ ${hunter.name} attacked ${
          target.name
        } but target status unclear (alive: ${
          target.alive
        }, wasKilledByThisHunter: ${wasKilledByThisHunter}, killInfo: ${JSON.stringify(
          killInfo
        )})`
      );
    }
  }

  console.log("🧼 [NightResolver] Phase 5c: Janitor cleaning...");
  // Clean roles for players directly targeted by clean_role (dead players)
  for (const playerId of janitorTargets) {
    const player = idMap.get(playerId);
    if (!player || player.alive) continue; // Only clean if dead

    // Hide role from everyone
    player.role_hidden = true;
    console.log(`  🧼 ${player.name}'s role has been cleaned (hidden)`);
  }

  // Also clean roles for players who were marked_for_cleaning while alive and died this night
  for (const player of players) {
    if (!player || player.alive) continue; // Only process dead players

    if (hasEffect(player, "marked_for_cleaning")) {
      // Hide role from everyone
      player.role_hidden = true;
      // Remove the effect since the role is now hidden (effect no longer needed)
      removeEffects(player, (e) => e.type === "marked_for_cleaning");
      console.log(
        `  🧼 ${player.name}'s role has been cleaned (was marked for cleaning, now dead)`
      );
    }
  }

  // PHASE 6: Default messages
  console.log("📝 [NightResolver] Phase 6: Adding default messages...");
  for (const p of players) {
    if (!p.alive) continue;

    if (!p.night_action) {
      p.night_action = { targetId: null, action: null, results: [] };
    }

    // Skip default message for Witch - she already has her success message
    if (p.role === "Witch" && p.night_action.results.length > 0) {
      continue;
    }

    if (p.night_action.results.length === 0) {
      p.night_action.results.push("safe:V noci se ti nic nestalo");
    }
  }

  // PHASE 7: Players will be saved by route handler
  console.log(
    "💾 [NightResolver] Phase 7: Players modified (will be saved by route handler)..."
  );
  for (const p of players) {
    console.log(
      `  ✓ ${p.name}: ${p.night_action?.results?.length || 0} results`
    );
  }

  console.log("✅ [NightResolver] Night action resolution complete!");
}

module.exports = { resolveNightActions };
