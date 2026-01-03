// electron/routes/gameRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const gameStateEmitter = require("./gameStateEmitter");

const {
  ensureUUID,
  findGameById,
  findGameByRoomCode,
  createGame,
  updateGame,
  deleteGame,
  findGameWithPlayers,
  getGameStateComplete,
  findPlayerById,
  findPlayersByGameId,
  findPlayerByGameAndSession,
  createPlayer,
  updatePlayer,
  deletePlayer,
  deletePlayersByGameId,
  updatePlayersByGameId,
  updatePlayersBatch,
  createGameLog,
  findGameLogsByGameId,
  deleteGameLogsByGameId,
} = require("../db/helpers");
const { ROLES, MODIFIERS } = require("../models/Role");
const { resolveNightActions } = require("../game/nightActionResolver");
const { evaluateVictory } = require("../game/victoryEvaluator");
const { resolveDayVoting } = require("../game/votingResolver");

// -----------------------------
// Helpers: validation & utils
// -----------------------------

function nowMs() {
  return Date.now();
}

function endInMs(sec) {
  return new Date(nowMs() + sec * 1000);
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeChance(val, def) {
  if (val === undefined || val === null) return def;
  const n = Number(val);
  if (Number.isNaN(n)) return def;
  return n > 1
    ? Math.min(100, Math.max(0, n)) / 100
    : Math.min(1, Math.max(0, n));
}

function hasEffect(p, effectType) {
  const now = new Date();
  return (p.effects || []).some(
    (e) => e.type === effectType && (!e.expiresAt || e.expiresAt > now)
  );
}

function addEffect(target, type, sourceId = null, expiresAt = null, meta = {}) {
  target.effects = target.effects || [];
  target.effects.push({
    type,
    source: sourceId,
    addedAt: new Date(),
    expiresAt,
    meta,
  });
}

function removeEffects(target, predicate) {
  target.effects = (target.effects || []).filter((e) => !predicate(e));
}

function clearExpiredEffects(players) {
  const now = new Date();
  for (const p of players) {
    p.effects = (p.effects || []).filter(
      (e) => !e.expiresAt || e.expiresAt > now
    );
  }
}

// -----------------------------
// ROUTES
// -----------------------------

// Create game
router.post("/create", async (req, res) => {
  try {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const { ip, port } = req.body || {};

    const game = await createGame({
      room_code: roomCode,
      ip,
      port,
      phase: "lobby",
      round: 0,
      timer_state: { phaseEndsAt: null },
    });

    await createGameLog({
      game_id: game.id,
      message: `Game created. Room: ${roomCode}`,
    });

    res.json({ success: true, gameId: game.id, roomCode });
  } catch (e) {
    console.error("create error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Helper function to get all available avatar files from filesystem
function getAllAvailableAvatars() {
  const avatars = [];

  // Get avatars ONLY from /avatars/ folder (public/avatars/)
  const avatarsDir = path.join(__dirname, "../../public/avatars");

  if (fs.existsSync(avatarsDir)) {
    const files = fs.readdirSync(avatarsDir);

    files.forEach((file) => {
      // Only include files that DON'T have "details" or "detail" in the name and are images
      const fileNameLower = file.toLowerCase();
      const hasDetail = fileNameLower.includes("detail");

      if (!hasDetail && /\.(png|jpg|jpeg|svg)$/i.test(file)) {
        avatars.push(`/avatars/${file}`);
      }
    });
  }

  return avatars;
}

// Helper function to assign random avatar - simplified to prevent database overload
// No database calls - just returns random avatar to prevent blocking
function assignRandomAvatar() {
  // Get all available avatars from filesystem
  const allAvatars = getAllAvailableAvatars();

  if (allAvatars.length === 0) {
    console.warn("⚠️ No avatars found in filesystem, returning null");
    return null;
  }

  // Simply return random avatar - duplicates are acceptable to prevent database overload
  const randomIndex = Math.floor(Math.random() * allAvatars.length);
  const selectedAvatar = allAvatars[randomIndex];
  console.log(`✅ Assigned random avatar: ${selectedAvatar}`);
  return selectedAvatar;
}

// Join by room code
router.post("/join", async (req, res) => {
  try {
    const { roomCode, name, sessionId } = req.body || {};

    const game = await findGameByRoomCode(roomCode);
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Normalize game.id to string (supports both id and _id for compatibility)
    const gameId = game.id || game._id;
    const gameIdStr =
      gameId && typeof gameId.toString === "function"
        ? gameId.toString()
        : gameId
        ? String(gameId)
        : null;

    if (!gameIdStr || !ensureUUID(gameIdStr)) {
      console.error("Invalid game ID format:", gameId, gameIdStr);
      return res.status(500).json({ error: "Invalid game ID format" });
    }

    let player = await findPlayerByGameAndSession(gameIdStr, sessionId);

    if (!player) {
      // Nový hráč - přiřaď unikátní náhodný avatar
      const avatar = assignRandomAvatar();
      player = await createPlayer({
        game_id: gameIdStr,
        session_id: sessionId,
        name,
        role: null,
        avatar,
      });

      // Validate player was created successfully
      if (!player || !player.id) {
        console.error("Failed to create player:", player);
        return res.status(500).json({ error: "Failed to create player" });
      }

      // Create game log asynchronously to not block join response
      createGameLog({ game_id: gameIdStr, message: `${name} joined.` }).catch(
        (err) => {
          console.error(`Error creating game log for join:`, err);
        }
      );
    } else {
      // Existující hráč - pokud nemá avatar, přiřaď mu náhodný volný
      if (!player.avatar || !player.avatar.trim()) {
        const avatar = assignRandomAvatar();
        player = await updatePlayer(player.id, { avatar });
        console.log(
          `✅ Assigned avatar to existing player ${player.name}: ${avatar}`
        );
      }
    }

    // Ensure both IDs are present and valid
    const playerId = player.id || player._id;
    const playerIdStr =
      playerId && typeof playerId.toString === "function"
        ? playerId.toString()
        : playerId
        ? String(playerId)
        : null;

    if (!gameIdStr || !playerIdStr) {
      console.error("Missing IDs:", {
        gameId: gameIdStr,
        playerId: playerIdStr,
      });
      return res.status(500).json({ error: "Failed to create/get player" });
    }

    // Emit game state update so all clients (moderator and players) see the new player
    // Use debounced update to batch rapid joins
    await emitGameStateUpdate(gameIdStr);

    res.json({ success: true, gameId: gameIdStr, playerId: playerIdStr });
  } catch (e) {
    console.error("join error:", e);
    res.status(500).json({ error: e.message });
  }
});

// End lobby - kick all players and delete game (moderator action)
// IMPORTANT: This route must come before GET routes with similar patterns
router.post("/:gameId/end-lobby", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });

    const game = await findGameById(gameId);
    if (!game) {
      // Idempotent: if game doesn't exist, return success
      return res.json({
        success: true,
        message: "Game already deleted or not found",
        playersKicked: 0,
      });
    }

    // Find all players in the game
    const players = await findPlayersByGameId(gameId);
    const playerCount = players.length;

    // Delete all players (kick them from lobby)
    await deletePlayersByGameId(gameId);

    // Delete all logs
    await deleteGameLogsByGameId(gameId);

    // Delete the game
    await deleteGame(gameId);

    console.log(
      `✅ Lobby ended: ${playerCount} players kicked, game ${gameId} deleted`
    );
    res.json({
      success: true,
      message: "Lobby ended successfully",
      playersKicked: playerCount,
    });
  } catch (e) {
    console.error("end-lobby error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Delete entire game (moderator action - deletes game, all players, and logs)
// IMPORTANT: This route must come before GET routes with similar patterns
router.delete("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });

    const game = await findGameById(gameId);
    if (!game) {
      // Idempotent: if game doesn't exist, return success
      return res.json({
        success: true,
        message: "Game already deleted or not found",
      });
    }

    // Delete all related data (cascade will handle players and logs)
    await deleteGame(gameId);

    console.log(
      `✅ Game ${gameId} deleted from database (including players and logs)`
    );
    res.json({ success: true, message: "Game deleted successfully" });
  } catch (e) {
    console.error("delete game error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Kick/remove player from game (moderator action - lobby only)
// IMPORTANT: This route must come before GET routes with similar patterns
router.delete("/:gameId/player/:playerId", async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    if (!ensureUUID(playerId))
      return res.status(400).json({ error: "Invalid player id" });

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Only allow kicking players in lobby phase
    if (game.phase !== "lobby") {
      return res
        .status(400)
        .json({ error: "Can only kick players in lobby phase" });
    }

    const player = await findPlayerById(playerId);
    if (!player || player.game_id?.toString() !== gameId)
      return res.status(404).json({ error: "Player not found" });

    const playerName = player.name;
    await deletePlayer(playerId);
    await createGameLog({
      game_id: gameId,
      message: `${playerName} was kicked from the game.`,
    });

    // Emit game state update to SSE clients so lobby reflects player removal
    await emitGameStateUpdate(gameId);

    res.json({
      success: true,
      message: `Player ${playerName} has been removed`,
    });
  } catch (e) {
    console.error("kick player error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Helper function to format game state for response
function formatGameStateResponse(game, players, logs) {
  const publicPlayers = players.map((p) => ({
    _id: p.id,
    name: p.name,
    role: p.role,
    alive: p.alive,
    hasVoted: p.has_voted,
    voteFor: p.vote_for_id,
    voteWeight: p.vote_weight || 1,
    avatar: p.avatar,
    nightResults: p.night_action?.results || [],
    roleData: p.role_data || {}, // Přidej roleData pro sledování navštívených hráčů (Infected)
  }));

  // Convert roleConfiguration (JSONB) to object for JSON response
  const roleConfigObj = game.role_configuration || game.roleConfiguration || {};
  // Extract roleMaxLimits, guaranteedRoles, and teamLimits from roleConfiguration
  // These are stored as _roleMaxLimits, _guaranteedRoles, _teamLimits within roleConfiguration
  const roleMaxLimitsObj =
    roleConfigObj._roleMaxLimits ||
    game.role_max_limits ||
    game.roleMaxLimits ||
    {};
  const guaranteedRolesArr =
    roleConfigObj._guaranteedRoles ||
    game.guaranteed_roles ||
    game.guaranteedRoles ||
    [];
  const teamLimitsObj = roleConfigObj._teamLimits ||
    game.team_limits ||
    game.teamLimits || { good: 2, evil: 1, neutral: 0 };

  // Remove internal keys from roleConfiguration for clean response
  const cleanRoleConfig = { ...roleConfigObj };
  delete cleanRoleConfig._roleMaxLimits;
  delete cleanRoleConfig._guaranteedRoles;
  delete cleanRoleConfig._teamLimits;

  // Convert modifierConfiguration (JSONB) to object for JSON response
  const modifierConfigObj =
    game.modifier_configuration || game.modifierConfiguration || {};

  return {
    game: {
      _id: game.id,
      roomCode: game.room_code,
      phase: game.phase,
      round: game.round,
      mayor: game.mayor_id,
      timers: game.timers,
      timerState: game.timer_state,
      winner: game.winner,
      winnerPlayerIds: game.winner_player_ids || game.winnerPlayerIds || [],
      roleConfiguration: cleanRoleConfig,
      modifierConfiguration: modifierConfigObj,
      roleMaxLimits: roleMaxLimitsObj,
      guaranteedRoles: guaranteedRolesArr,
      teamLimits: teamLimitsObj,
    },
    players: publicPlayers,
    logs: logs.map((l) => ({
      _id: l.id,
      message: l.message,
      createdAt: l.created_at || l.createdAt, // Support both snake_case (DB) and camelCase (legacy)
    })),
  };
}

// Debounce map for game state updates - prevents too many rapid updates
const gameStateUpdateDebounce = new Map();

// Helper function to emit game state update to SSE clients with debouncing
async function emitGameStateUpdate(gameId, immediate = false) {
  // If immediate, clear any pending debounce and emit right away
  if (immediate) {
    const timeout = gameStateUpdateDebounce.get(gameId);
    if (timeout) {
      clearTimeout(timeout);
      gameStateUpdateDebounce.delete(gameId);
    }
    await doEmitGameStateUpdate(gameId);
    return;
  }

  // Otherwise, use debouncing to batch rapid updates
  const existingTimeout = gameStateUpdateDebounce.get(gameId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const timeout = setTimeout(async () => {
    gameStateUpdateDebounce.delete(gameId);
    await doEmitGameStateUpdate(gameId);
  }, 200); // 200ms debounce - batches rapid updates

  gameStateUpdateDebounce.set(gameId, timeout);
}

// Actual implementation of game state update emission
async function doEmitGameStateUpdate(gameId) {
  try {
    const { game, players, logs } = await getGameStateComplete(gameId, 200);
    if (game) {
      console.log(
        `📤 Emitting game state for ${gameId}: phase=${game.phase}, players=${players.length}`
      );
      const gameState = formatGameStateResponse(game, players, logs);
      console.log(
        `📤 Formatted game state: ${gameState.players.length} players`
      );
      gameState.players.forEach((p) => {
        console.log(`  - ${p.name}: avatar=${p.avatar || "MISSING"}`);
      });
      gameStateEmitter.emitGameStateUpdate(gameId, gameState);
      console.log(`✅ Game state emitted to SSE clients`);
    } else {
      console.error(`❌ No game found for ${gameId}`);
    }
  } catch (err) {
    console.error(`Error emitting game state update for ${gameId}:`, err);
    console.error(err.stack);
  }
}

// Get public game state (no meta) - optimized with parallel queries
router.get("/:gameId/state", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });

    // Load game, players, and logs in parallel for optimal performance
    const { game, players, logs } = await getGameStateComplete(gameId, 200);

    if (!game) return res.status(404).json({ error: "Game not found" });

    const response = formatGameStateResponse(game, players, logs);
    res.json(response);
  } catch (e) {
    console.error("state error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Server-Sent Events endpoint for real-time game state updates
router.get("/:gameId/stream", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId)) {
      return res.status(400).json({ error: "Invalid game id" });
    }

    // Verify game exists (lightweight check)
    const game = await findGameById(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial game state
    const {
      game: initialGame,
      players,
      logs,
    } = await getGameStateComplete(gameId, 200);
    if (initialGame) {
      const initialState = formatGameStateResponse(initialGame, players, logs);
      res.write(`data: ${JSON.stringify(initialState)}\n\n`);
    }

    // Declare keepAliveInterval before subscription so it's available in unsubscribe callback
    let keepAliveInterval = null;

    // Subscribe to game state updates immediately after sending initial state
    // This prevents race condition where updates could be missed between initial state and subscription
    const unsubscribe = gameStateEmitter.subscribe(
      gameId,
      async (gameState) => {
        try {
          res.write(`data: ${JSON.stringify(gameState)}\n\n`);
        } catch (err) {
          console.error("Error writing SSE data:", err);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }
          unsubscribe();
          res.end();
        }
      }
    );

    // Send keepalive every 30 seconds
    keepAliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (err) {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
        unsubscribe();
        res.end();
      }
    }, 30000);

    // Handle client disconnect - single handler for cleanup
    req.on("close", () => {
      console.log(`SSE client disconnected for game ${gameId}`);
      clearInterval(keepAliveInterval);
      unsubscribe();
      res.end();
    });
  } catch (e) {
    console.error("SSE stream error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      res.end();
    }
  }
});

// Vote
// Vote endpoint with auto-shorten when all alive voted
router.post("/:gameId/vote", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId } = req.body || {};

    if (!ensureUUID(gameId) || !ensureUUID(playerId)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.phase !== "day")
      return res.status(400).json({ error: "Voting only during day" });

    const player = await findPlayerById(playerId, "*");
    if (!player || player.game_id?.toString() !== gameId) {
      return res.status(404).json({ error: "Player not found" });
    }
    if (!player.alive) {
      return res.status(400).json({ error: "Dead players cannot vote" });
    }

    // Zaznamenej hlas
    await updatePlayer(playerId, {
      has_voted: true,
      vote_for_id: targetId ? targetId : null,
    });
    player.has_voted = true;
    player.vote_for_id = targetId ? targetId : null;

    // Zaznamenej zprávu o hlasování
    if (targetId) {
      const target = await findPlayerById(targetId, "*");
      await createGameLog({
        game_id: gameId,
        message: `${player.name} voted for ${target?.name || "unknown"}.`,
      });
    } else {
      await createGameLog({
        game_id: gameId,
        message: `${player.name} skipped voting.`,
      });
    }

    // Zkontroluj, zda všichni živí odhlasovali
    const allPlayers = await findPlayersByGameId(gameId, "*");
    const alivePlayers = allPlayers.filter((p) => p.alive);
    const allVoted = alivePlayers.every((p) => p.has_voted);

    // Zkontroluj, zda všichni hlasovali skip (null)
    const allSkipped = allVoted && alivePlayers.every((p) => !p.vote_for_id);

    const timerState = game.timer_state || {};
    if (allVoted && timerState.phaseEndsAt) {
      const now = Date.now();
      const currentEnds = new Date(timerState.phaseEndsAt).getTime();

      if (allSkipped) {
        // Pokud všichni hlasovali skip, přeskoč čas (ukonči den okamžitě)
        await updateGame(gameId, {
          timer_state: { phaseEndsAt: new Date(now + 3 * 1000) },
        });
        await createGameLog({
          game_id: gameId,
          message: "⏱️ All players skipped voting, day ends in 3s",
        });
        console.log("⏱️ All alive players skipped voting, ending day in 3s");
      } else {
        // Normální zkrácení na 10 sekund
        const shortDeadline = now + 10 * 1000; // 10 sekund od teď

        // Zkrať pouze pokud by to bylo dřív než původní deadline
        if (shortDeadline < currentEnds) {
          await updateGame(gameId, {
            timer_state: { phaseEndsAt: new Date(shortDeadline) },
          });
          await createGameLog({
            game_id: gameId,
            message: "⏱️ All voted, day ends in 10s",
          });
          console.log("⏱️ All alive players voted, shortening day to 10s");
        }
      }
    }

    // Emit game state update to SSE clients so votes are visible
    await emitGameStateUpdate(gameId);

    res.json({ success: true });

    // Emit game state update to SSE clients
    await emitGameStateUpdate(gameId);
  } catch (e) {
    console.error("vote error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Update role configuration (lobby only) – optional if still used
router.post("/:gameId/start-config", async (req, res) => {
  try {
    const { gameId } = req.params;
    const {
      assignments,
      modifiers,
      timers,
      roleConfiguration,
      roleMaxLimits,
      guaranteedRoles,
      teamLimits,
    } = req.body || {};

    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.phase !== "lobby")
      return res.status(400).json({ error: "Game already started" });

    const players = await findPlayersByGameId(gameId);
    if (players.length < 3)
      return res.status(400).json({ error: "At least 3 players required" });

    let timerUpdates = {};
    if (timers) {
      const currentTimers = game.timers ?? {};
      const nextNight = clampNum(
        timers.nightSeconds,
        10,
        1800,
        currentTimers.nightSeconds ?? 90
      );
      const nextDay = clampNum(
        timers.daySeconds,
        10,
        1800,
        currentTimers.daySeconds ?? 150
      );
      timerUpdates = {
        timers: {
          ...currentTimers,
          nightSeconds: nextNight,
          daySeconds: nextDay,
        },
      };
    }

    // Assign roles and prepare batch updates
    console.log("📋 Assigning roles:", assignments);
    const roleUpdates = [];

    // Assign roles from assignments
    for (const [playerId, roleName] of Object.entries(assignments || {})) {
      const player = players.find((p) => p.id.toString() === playerId);
      if (player) {
        const role = roleName || "Citizen";
        console.log(`  ✓ ${player.name} ← ${role}`);
        player.role = role; // Update in memory
        roleUpdates.push({ id: player.id, updates: { role } });
      }
    }

    // Set default Citizen for players without role
    for (const p of players) {
      if (!p.role) {
        console.log(`  ✓ ${p.name} ← Citizen (default)`);
        p.role = "Citizen"; // Update in memory
        roleUpdates.push({ id: p.id, updates: { role: "Citizen" } });
      }
    }

    // Batch update all role assignments
    if (roleUpdates.length > 0) {
      await updatePlayersBatch(roleUpdates);
    }

    // Prepare affiliations and victory conditions updates
    const affiliationUpdates = [];
    for (const p of players) {
      const def = ROLES[p.role];
      p.affiliations = def?.defaultAffiliations || ["good"];
      p.victoryConditions = def?.defaultVictory || {
        canWinWithTeams: ["good"],
        soloWin: false,
        customRules: [],
      };
      affiliationUpdates.push({
        id: p.id,
        updates: {
          affiliations: p.affiliations,
          victory_conditions: p.victoryConditions,
        },
      });
    }

    // Batch update affiliations
    if (affiliationUpdates.length > 0) {
      await updatePlayersBatch(affiliationUpdates);
    }

    // Prepare roleData updates for limited-use roles
    const roleDataUpdates = [];
    for (const p of players) {
      const roleData = ROLES[p.role];
      const currentRoleData = p.role_data || {};

      // Pro dual role s hasLimitedUses - inicializuj usesRemaining pro sekundární akce
      if (roleData?.actionType === "dual" && roleData?.hasLimitedUses) {
        const usesRemaining = roleData.maxUses || 3;
        const updatedRoleData = { ...currentRoleData, usesRemaining };
        p.role_data = updatedRoleData;
        console.log(
          `  ✓ ${p.name} (${p.role}) initialized with ${usesRemaining} uses for secondary actions`
        );
        roleDataUpdates.push({
          id: p.id,
          updates: { role_data: updatedRoleData },
        });
      } else if (roleData?.hasLimitedUses) {
        const usesRemaining = roleData.maxUses || 3;
        const updatedRoleData = { ...currentRoleData, usesRemaining };
        p.role_data = updatedRoleData;
        console.log(
          `  ✓ ${p.name} (${p.role}) initialized with ${usesRemaining} uses`
        );
        roleDataUpdates.push({
          id: p.id,
          updates: { role_data: updatedRoleData },
        });
      }
    }

    // Batch update roleData
    if (roleDataUpdates.length > 0) {
      await updatePlayersBatch(roleDataUpdates);
    }

    // Keep reference to updated players (they're already updated in memory)
    const updatedPlayers = players;

    // ✅ Modifiers s allowedTeams kontrolou
    console.log("🎭 Assigning modifiers...");

    // Normalize chances
    const drunkChance = normalizeChance(
      modifiers?.drunkChance ?? modifiers?.opilýChance,
      0.2
    );
    const shadyChance = normalizeChance(
      modifiers?.shadyChance ??
        modifiers?.recluseChance ??
        modifiers?.poustevníkChance,
      0.15
    );
    const innocentChance = normalizeChance(modifiers?.innocentChance, 0.15);
    const paranoidChance = normalizeChance(modifiers?.paranoidChance, 0.1);

    const insomniacChance = normalizeChance(modifiers?.insomniacChance, 0.1);
    const sweetheartChance = normalizeChance(modifiers?.sweetheartChance, 0.1);

    // ✅ Check if MODIFIERS exists
    if (!MODIFIERS) {
      console.warn("⚠️ MODIFIERS not found, skipping modifier assignment");
    } else {
      // Build list of available modifiers per player based on their team
      for (const p of updatedPlayers) {
        const roleData = ROLES[p.role];
        const roleTeam = roleData?.team || "good";

        // Get all valid modifiers for this team
        const validModifiers = [];

        // ✅ Check each modifier with proper fallback
        if (MODIFIERS.Drunk && Array.isArray(MODIFIERS.Drunk.allowedTeams)) {
          if (MODIFIERS.Drunk.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: "Drunk", chance: drunkChance });
          }
        }

        if (MODIFIERS.Shady && Array.isArray(MODIFIERS.Shady.allowedTeams)) {
          if (MODIFIERS.Shady.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: "Shady", chance: shadyChance });
          }
        }

        // Innocent uses its own chance, for evil team
        if (
          MODIFIERS.Innocent &&
          Array.isArray(MODIFIERS.Innocent.allowedTeams)
        ) {
          if (MODIFIERS.Innocent.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: "Innocent", chance: innocentChance });
          }
        }

        if (
          MODIFIERS.Paranoid &&
          Array.isArray(MODIFIERS.Paranoid.allowedTeams)
        ) {
          if (MODIFIERS.Paranoid.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: "Paranoid", chance: paranoidChance });
          }
        }

        if (
          MODIFIERS.Insomniac &&
          Array.isArray(MODIFIERS.Insomniac.allowedTeams)
        ) {
          if (MODIFIERS.Insomniac.allowedTeams.includes(roleTeam)) {
            validModifiers.push({ name: "Insomniac", chance: insomniacChance });
          }
        }

        if (
          MODIFIERS.Sweetheart &&
          Array.isArray(MODIFIERS.Sweetheart.allowedTeams)
        ) {
          if (MODIFIERS.Sweetheart.allowedTeams.includes(roleTeam)) {
            validModifiers.push({
              name: "Sweetheart",
              chance: sweetheartChance,
            });
          }
        }

        // Roll for modifier (first match wins)
        p.modifier = null;
        const roll = Math.random();
        let cumulative = 0;

        for (const mod of validModifiers) {
          cumulative += mod.chance;
          if (roll < cumulative) {
            p.modifier = mod.name;
            console.log(`  🎭 ${p.name} (${p.role}/${roleTeam}) ← ${mod.name}`);
            break;
          }
        }

        // Track modifier history for initial assignment
        const playerRoleData = p.role_data || {};
        if (!playerRoleData.modifierHistory) {
          playerRoleData.modifierHistory = [];
        }
        if (p.modifier) {
          playerRoleData.modifierHistory.push({
            modifier: p.modifier,
            round: 0,
            reason: "Game start",
          });
        }
        p.role_data = playerRoleData;

        if (!p.modifier) {
          console.log(`  ✓ ${p.name} (${p.role}/${roleTeam}) ← No modifier`);
        }
      }

      // Batch update all modifiers
      const modifierUpdates = updatedPlayers.map((p) => ({
        id: p.id,
        updates: {
          modifier: p.modifier,
          role_data: p.role_data || {},
        },
      }));
      if (modifierUpdates.length > 0) {
        await updatePlayersBatch(modifierUpdates);
      }
    }

    // Save roleConfiguration and related settings if provided
    const gameUpdates = { ...timerUpdates };
    if (roleConfiguration) {
      // Store roleMaxLimits, guaranteedRoles, and teamLimits within roleConfiguration JSONB
      const enhancedRoleConfig = {
        ...roleConfiguration,
        _roleMaxLimits: roleMaxLimits || {},
        _guaranteedRoles: guaranteedRoles || [],
        _teamLimits: teamLimits || { good: 2, evil: 1, neutral: 0 },
      };
      gameUpdates.role_configuration = enhancedRoleConfig;
    } else if (roleMaxLimits || guaranteedRoles || teamLimits) {
      // If only limits are provided without roleConfiguration, merge with existing
      const existingConfig = game.role_configuration || {};
      const enhancedRoleConfig = {
        ...existingConfig,
        _roleMaxLimits: roleMaxLimits || existingConfig._roleMaxLimits || {},
        _guaranteedRoles:
          guaranteedRoles || existingConfig._guaranteedRoles || [],
        _teamLimits: teamLimits ||
          existingConfig._teamLimits || { good: 2, evil: 1, neutral: 0 },
      };
      gameUpdates.role_configuration = enhancedRoleConfig;
    }

    // Save modifierConfiguration if provided
    if (modifiers) {
      // Normalize chances to 0-1 range for storage (backend expects 0-1, frontend sends 0-100)
      const modifierConfig = {
        drunkChance: normalizeChance(
          modifiers?.drunkChance ?? modifiers?.opilýChance,
          0.2
        ),
        shadyChance: normalizeChance(
          modifiers?.shadyChance ??
            modifiers?.recluseChance ??
            modifiers?.poustevníkChance,
          0.15
        ),
        innocentChance: normalizeChance(modifiers?.innocentChance, 0.15),
        paranoidChance: normalizeChance(modifiers?.paranoidChance, 0.1),
        insomniacChance: normalizeChance(modifiers?.insomniacChance, 0.1),
        sweetheartChance: normalizeChance(modifiers?.sweetheartChance, 0.1),
        amnesiacChance: normalizeChance(modifiers?.amnesiacChance, 0),
      };
      gameUpdates.modifier_configuration = modifierConfig;
    }

    // Start by DAY with timer
    // Use new timer values from gameUpdates if available, otherwise fall back to existing game.timers
    const daySec = Number(
      (gameUpdates.timers || game.timers || {}).daySeconds ?? 150
    );
    gameUpdates.phase = "day";
    gameUpdates.round = 1;
    gameUpdates.timer_state = { phaseEndsAt: endInMs(daySec) };
    await updateGame(gameId, gameUpdates);
    const updatedGame = await findGameById(gameId);

    await createGameLog({ game_id: gameId, message: "--- GAME START ---" });
    await createGameLog({
      game_id: gameId,
      message: `Round ${updatedGame.round} - DAY (⏱ ${daySec}s)`,
    });

    console.log("✅ Game started with role assignments and modifiers");

    // Ensure we have fresh data before emitting - reload game state to get all players with avatars
    console.log("🔄 Reloading game state after start...");
    const {
      game: finalGame,
      players: finalPlayers,
      logs: finalLogs,
    } = await getGameStateComplete(gameId, 200);
    console.log(`📊 Loaded ${finalPlayers.length} players after start`);
    finalPlayers.forEach((p) => {
      console.log(
        `  - ${p.name}: avatar=${p.avatar || "MISSING"}, role=${
          p.role || "MISSING"
        }`
      );
    });

    // Emit game state update to SSE clients so players transition from lobby to game
    // Use immediate=true for important phase transitions
    console.log("📡 Emitting game state update...");
    await emitGameStateUpdate(gameId, true);
    console.log("✅ Game state update emitted");

    res.json({ success: true });
  } catch (e) {
    console.error("start-config error:", e);
    console.error("Stack:", e.stack);
    res.status(500).json({ error: e.message });
  }
});

// Optional endpoints to end phases manually (for admin/debug)
router.post("/:gameId/end-night", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (game.phase !== "night")
      return res.status(400).json({ error: "Not in night phase" });

    let players = await findPlayersByGameId(gameId);
    // Resolvers now use PostgreSQL format directly
    await resolveNightActions(game, players);

    // Batch save all players after night actions (resolver modifies them in memory)
    const playerUpdates = players.map((p) => ({
      id: p.id,
      updates: {
        alive: p.alive,
        effects: p.effects,
        night_action: p.night_action,
        role_data: p.role_data,
        modifier: p.modifier,
        vote_weight: p.vote_weight,
      },
    }));

    if (playerUpdates.length > 0) {
      await updatePlayersBatch(playerUpdates);
    }

    // Save game changes (e.g. if mayor was killed)
    if (game.mayor_id !== undefined) {
      await updateGame(gameId, {
        mayor_id: game.mayor_id || null,
      });
    }

    // Load game and players in parallel
    const [updatedGame, updatedPlayers] = await Promise.all([
      findGameById(gameId),
      findPlayersByGameId(gameId),
    ]);
    players = updatedPlayers;

    // evaluateVictory now uses PostgreSQL format directly
    const win = evaluateVictory(players);
    if (win) {
      // win.players contains id from PostgreSQL format
      const winnerIds = (win.players || []).map((id) => {
        // If id is an object with toString, use toString, otherwise use as is
        return id?.toString ? id.toString() : id;
      });
      await updateGame(gameId, {
        phase: "end",
        winner: win.winner,
        winner_player_ids: winnerIds,
      });
      await createGameLog({
        game_id: gameId,
        message: `🏁 Victory: ${win.winner}`,
      });

      // Emit game state update to SSE clients so players see end screen
      await emitGameStateUpdate(gameId);

      return res.json({
        success: true,
        phase: "end",
        winner: win.winner,
        winners: win.players,
      });
    }

    const timers = updatedGame.timers || game.timers || {};
    const daySec = Number(timers.daySeconds ?? 150);
    await updateGame(gameId, {
      phase: "day",
      timer_state: { phaseEndsAt: endInMs(daySec) },
    });

    // ✅ RESET hlasování pro nový den - batch update
    console.log("🧹 Resetting votes for new day...");
    await updatePlayersByGameId(gameId, {
      has_voted: false,
      vote_for_id: null,
    });
    console.log("✅ Votes reset complete");

    // Reload game for final state
    const finalGame = await findGameById(gameId);
    updatedGame = finalGame;
    await createGameLog({
      game_id: gameId,
      message: `Round ${updatedGame.round} - DAY (⏱ ${daySec}s)`,
    });

    res.json({ success: true });

    // Emit game state update to SSE clients
    await emitGameStateUpdate(gameId);
  } catch (e) {
    console.error("end-night error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/:gameId/voting-reveal-to-night", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (game.phase !== "voting_reveal")
      return res.status(400).json({ error: "Not in voting_reveal phase" });

    const nightSec = Number(game.timers?.nightSeconds ?? 90);
    // Noc má stejné číslo jako poslední den - kolo se nezvyšuje
    const currentRound = game.round || 0;
    await updateGame(gameId, {
      phase: "night",
      round: currentRound,
      timer_state: { phaseEndsAt: endInMs(nightSec) },
    });
    await createGameLog({
      game_id: gameId,
      message: `Round ${currentRound} - NIGHT (⏱ ${nightSec}s)`,
    });

    res.json({ success: true });
  } catch (e) {
    console.error("voting-reveal-to-night error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/:gameId/end-day", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (game.phase !== "day")
      return res.status(400).json({ error: "Not in day phase" });

    let players = await findPlayersByGameId(gameId);
    // Resolvers now use PostgreSQL format directly
    const votingResult = await resolveDayVoting(game, players, createGameLog);

    // Apply updates from voting resolver - use batch update for players
    if (votingResult.updates) {
      if (
        votingResult.updates.players &&
        votingResult.updates.players.length > 0
      ) {
        console.log(
          "📝 Applying player updates:",
          votingResult.updates.players.length
        );
        const batchUpdates = votingResult.updates.players.map((pu) => ({
          id: pu.id,
          updates: pu.updates,
        }));
        console.log("📝 Batch updates:", JSON.stringify(batchUpdates, null, 2));
        await updatePlayersBatch(batchUpdates);
        console.log("✅ Player updates applied");
      }
      if (votingResult.updates.game) {
        console.log(
          "📝 Applying game updates:",
          JSON.stringify(votingResult.updates.game.updates, null, 2)
        );
        const updatedGame = await updateGame(
          votingResult.updates.game.id,
          votingResult.updates.game.updates
        );
        console.log("✅ Game updates applied");
        console.log("📊 Updated game mayor_id:", updatedGame?.mayor_id);
      }
    }

    players = await findPlayersByGameId(gameId);
    console.log(
      "📊 Players after update:",
      players.map((p) => ({
        name: p.name,
        alive: p.alive,
        id: p.id,
        vote_weight: p.vote_weight,
        modifier: p.modifier,
      }))
    );

    // Verify mayor was set correctly
    if (votingResult.mayorElected && votingResult.mayorId) {
      const mayorId = votingResult.mayorId?.toString
        ? votingResult.mayorId.toString()
        : votingResult.mayorId;
      const mayorPlayer = players.find((p) => p.id.toString() === mayorId);
      const updatedGame = await findGameById(gameId);
      console.log("🔍 Checking mayor election:");
      console.log("  Mayor ID from result:", mayorId);
      console.log(
        "  Mayor player found:",
        mayorPlayer ? mayorPlayer.name : "NOT FOUND"
      );
      console.log("  Mayor vote_weight:", mayorPlayer?.vote_weight);
      console.log("  Game mayor_id:", updatedGame?.mayor_id);
      console.log(
        "  Game mayor_id matches:",
        updatedGame?.mayor_id?.toString() === mayorId
      );
    }

    // Verify execution was applied correctly
    if (votingResult.executed) {
      const executedId = votingResult.executed?.toString
        ? votingResult.executed.toString()
        : votingResult.executed;
      const executedPlayer = players.find(
        (p) => p.id.toString() === executedId
      );
      console.log("🔍 Checking executed player:", {
        executedId,
        found: !!executedPlayer,
        alive: executedPlayer?.alive,
      });
      if (executedPlayer && executedPlayer.alive) {
        console.error(
          "⚠️ Executed player is still alive! Force updating...",
          executedPlayer
        );
        // Force update
        await updatePlayer(executedPlayer.id, { alive: false });
        players = await findPlayersByGameId(gameId);
        console.log("✅ Force updated executed player");
      }
    }

    // ✅ Check if Jester won (was executed)
    console.log("🔍 Voting result:", JSON.stringify(votingResult, null, 2));
    if (votingResult && votingResult.jesterWin === true) {
      console.log("🎭 Jester win detected!");
      const jester = players.find((p) => p.role === "Jester" && !p.alive);
      console.log("🎭 Found Jester:", jester ? jester.name : "not found");
      await updateGame(gameId, {
        phase: "end",
        winner: "custom",
        winner_player_ids: jester ? [jester.id] : [],
      });
      await createGameLog({
        game_id: gameId,
        message: `🏁 Victory: Jester ${jester?.name || "unknown"} wins!`,
      });
      console.log("🎭 Game ended - Jester wins!");

      // Emit game state update to SSE clients so players see end screen
      await emitGameStateUpdate(gameId);

      return res.json({
        success: true,
        phase: "end",
        winner: "custom",
        winners: jester ? [jester.id] : [],
      });
    }

    // evaluateVictory now uses PostgreSQL format directly
    const win = evaluateVictory(players);
    if (win) {
      game.phase = "end";
      game.winner = win.winner;
      game.winner_player_ids = win.players || [];
      await updateGame(gameId, {
        phase: "end",
        winner: win.winner,
        winner_player_ids: win.players || [],
      });
      await createGameLog({
        game_id: gameId,
        message: `🏁 Victory: ${win.winner}`,
      });

      // Emit game state update to SSE clients so players see end screen
      await emitGameStateUpdate(gameId);

      return res.json({
        success: true,
        phase: "end",
        winner: win.winner,
        winners: win.players,
      });
    }

    // Go directly to night (voting_reveal was removed)
    const nightSec = Number(game.timers?.nightSeconds ?? 90);
    // Noc má stejné číslo jako poslední den - kolo se nezvyšuje
    const currentRound = game.round || 0;
    await updateGame(gameId, {
      phase: "night",
      round: currentRound,
      timer_state: { phaseEndsAt: endInMs(nightSec) },
    });
    await createGameLog({
      game_id: gameId,
      message: `Round ${currentRound} - NIGHT (⏱ ${nightSec}s)`,
    });
    res.json({ success: true, phase: "night" });

    // Emit game state update to SSE clients
    // Use immediate=true for important phase transitions
    await emitGameStateUpdate(gameId, true);
  } catch (e) {
    console.error("end-day error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/game/:gameId/reset-to-lobby
router.post("/:gameId/reset-to-lobby", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Preserve timers, role_configuration, and modifier_config
    // Only reset game state fields, not configuration
    await updateGame(gameId, {
      phase: "lobby",
      round: 0,
      mayor_id: null,
      timer_state: { phaseEndsAt: null },
      winner: null,
      winner_player_ids: [],
      // timers, role_configuration, and modifier_config are preserved (not reset)
    });

    // Batch reset all players to lobby state
    await updatePlayersByGameId(gameId, {
      alive: true,
      role: null,
      modifier: null,
      affiliations: [],
      victory_conditions: {
        canWinWithTeams: [],
        soloWin: false,
        customRules: [],
      },
      effects: [],
      has_voted: false,
      vote_for_id: null,
      vote_weight: 1,
      night_action: { targetId: null, action: null, results: [] },
      role_data: {}, // Clear role_data to remove investigation history and other role-specific data
    });

    await createGameLog({
      game_id: gameId,
      message: "🔄 Game reset to lobby by moderator",
    });
    console.log("✅ Game reset to lobby");

    // Emit game state update to SSE clients so players return to lobby
    await emitGameStateUpdate(gameId);

    res.json({ success: true });
  } catch (e) {
    console.error("reset-to-lobby error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/game/:gameId/end-phase
router.post("/:gameId/end-phase", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!ensureUUID(gameId)) {
      return res.status(400).json({ error: "Invalid game id" });
    }

    const game = await findGameById(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    const currentPhase = game.phase;
    console.log(`🔄 [END-PHASE] Current phase: ${currentPhase}`);

    if (currentPhase === "day") {
      // Day → Night: process voting + RESET night actions
      console.log("📋 Processing day voting...");

      let players = await findPlayersByGameId(gameId);
      // Resolvers now use PostgreSQL format directly
      const votingResult = await resolveDayVoting(game, players, createGameLog);

      // Apply updates from voting resolver - use batch update for players
      if (votingResult.updates) {
        if (
          votingResult.updates.players &&
          votingResult.updates.players.length > 0
        ) {
          console.log(
            "📝 Applying player updates:",
            votingResult.updates.players.length
          );
          const batchUpdates = votingResult.updates.players.map((pu) => ({
            id: pu.id,
            updates: pu.updates,
          }));
          console.log(
            "📝 Batch updates:",
            JSON.stringify(batchUpdates, null, 2)
          );
          await updatePlayersBatch(batchUpdates);
          console.log("✅ Player updates applied");
        }
        if (votingResult.updates.game) {
          console.log(
            "📝 Applying game updates:",
            JSON.stringify(votingResult.updates.game.updates, null, 2)
          );
          const updatedGame = await updateGame(
            votingResult.updates.game.id,
            votingResult.updates.game.updates
          );
          console.log("✅ Game updates applied");
          console.log("📊 Updated game mayor_id:", updatedGame?.mayor_id);
          // Reload game object to ensure we have the latest state
          const reloadedGame = await findGameById(gameId, "*");
          if (reloadedGame) {
            Object.assign(game, reloadedGame);
          }
        }
      }

      // Reload players after voting and applying updates
      players = await findPlayersByGameId(gameId, "*");
      console.log(
        "📊 Players after update:",
        players.map((p) => ({
          name: p.name,
          alive: p.alive,
          id: p.id,
          vote_weight: p.vote_weight,
          modifier: p.modifier,
        }))
      );

      // Verify mayor was set correctly
      if (votingResult.mayorElected && votingResult.mayorId) {
        const mayorId = votingResult.mayorId?.toString
          ? votingResult.mayorId.toString()
          : votingResult.mayorId;
        const mayorPlayer = players.find((p) => p.id.toString() === mayorId);
        const updatedGame = await findGameById(gameId);
        console.log("🔍 Checking mayor election:");
        console.log("  Mayor ID from result:", mayorId);
        console.log(
          "  Mayor player found:",
          mayorPlayer ? mayorPlayer.name : "NOT FOUND"
        );
        console.log("  Mayor vote_weight:", mayorPlayer?.vote_weight);
        console.log("  Game mayor_id:", updatedGame?.mayor_id);
        console.log(
          "  Game mayor_id matches:",
          updatedGame?.mayor_id?.toString() === mayorId
        );
      }

      // Verify execution was applied correctly
      if (votingResult.executed) {
        const executedId = votingResult.executed?.toString
          ? votingResult.executed.toString()
          : votingResult.executed;
        const executedPlayer = players.find(
          (p) => p.id.toString() === executedId
        );
        console.log("🔍 Checking executed player:", {
          executedId,
          found: !!executedPlayer,
          alive: executedPlayer?.alive,
        });
        if (executedPlayer && executedPlayer.alive) {
          console.error(
            "⚠️ Executed player is still alive! Force updating...",
            executedPlayer
          );
          // Force update
          await updatePlayer(executedPlayer.id, { alive: false });
          players = await findPlayersByGameId(gameId, "*");
          console.log("✅ Force updated executed player");
        }
      }

      // ✅ Check if Jester won (was executed)
      if (votingResult && votingResult.jesterWin === true) {
        console.log("🎭 Jester win detected in end-phase!");
        const jester = players.find((p) => p.role === "Jester" && !p.alive);
        console.log("🎭 Found Jester:", jester ? jester.name : "not found");
        game.phase = "end";
        game.winner = "custom";
        game.winner_player_ids = jester ? [jester.id] : [];
        await updateGame(gameId, {
          phase: "end",
          winner: "custom",
          winner_player_ids: jester ? [jester.id] : [],
        });
        await createGameLog({
          game_id: gameId,
          message: `🏁 Victory: Jester ${jester?.name || "unknown"} wins!`,
        });
        console.log("🎭 Game ended - Jester wins!");

        // Emit game state update to SSE clients so players see end screen
        await emitGameStateUpdate(gameId);

        return res.json({
          success: true,
          phase: "end",
          winner: "custom",
          winners: jester ? [jester.id] : [],
        });
      }

      // ✅ RESET nočních akcí pro novou noc - batch update
      console.log("🧹 Resetting night actions for new night...");
      await updatePlayersByGameId(gameId, {
        night_action: {
          targetId: null,
          action: null,
          results: [],
        },
      });
      console.log("✅ Night actions reset complete");

      // Check victory - convert to resolver format
      const win = evaluateVictory(players);
      if (win) {
        // Convert player IDs from resolver format (_id) to PostgreSQL format (id)
        const winnerIds = (win.players || []).map((id) => {
          return id?.toString ? id.toString() : id;
        });
        await updateGame(gameId, {
          phase: "end",
          winner: win.winner,
          winner_player_ids: winnerIds,
        });
        await createGameLog({
          game_id: gameId,
          message: `🏁 Victory: ${win.winner}`,
        });
        console.log(`✅ Victory: ${win.winner}`);

        // Emit game state update to SSE clients so players see end screen
        await emitGameStateUpdate(gameId);

        return res.json({
          success: true,
          phase: "end",
          winner: win.winner,
          winners: win.players,
        });
      }

      // Switch to night
      // Reload game to ensure we have the latest state (including mayor_id from voting)
      const currentGameState = await findGameById(gameId, "*");
      if (currentGameState) {
        Object.assign(game, currentGameState);
      }
      const nightSec = Number(game.timers?.nightSeconds ?? 90);
      // Noc má stejné číslo jako poslední den - kolo se nezvyšuje
      const currentRound = game.round || 0;
      game.phase = "night";
      game.round = currentRound;
      game.timer_state = {
        phaseEndsAt: new Date(Date.now() + nightSec * 1000),
      };
      await updateGame(gameId, {
        phase: "night",
        round: currentRound,
        timer_state: { phaseEndsAt: endInMs(nightSec) },
      });
      await createGameLog({
        game_id: gameId,
        message: `Round ${currentRound} - NIGHT (⏱ ${nightSec}s)`,
      });
      console.log(`✅ [END-PHASE] Day → Night (Round ${currentRound})`);
    } else if (currentPhase === "night") {
      // Night → Day: process night actions
      console.log("🌙 Processing night actions...");

      let players = await findPlayersByGameId(gameId, "*");
      // Resolvers now use PostgreSQL format directly
      await resolveNightActions(game, players);

      // Batch save all players after night actions (resolver modifies them in memory)
      const playerUpdates = players.map((p) => ({
        id: p.id,
        updates: {
          alive: p.alive,
          effects: p.effects,
          night_action: p.night_action,
          role_data: p.role_data,
          modifier: p.modifier,
          vote_weight: p.vote_weight,
        },
      }));

      if (playerUpdates.length > 0) {
        await updatePlayersBatch(playerUpdates);
      }

      // Save game changes (e.g. if mayor was killed)
      if (game.mayor_id !== undefined) {
        await updateGame(gameId, {
          mayor_id: game.mayor_id || null,
        });
      }

      // Reload players for victory check
      players = await findPlayersByGameId(gameId, "*");

      // Check victory - convert to resolver format
      const win = evaluateVictory(players);
      if (win) {
        // Convert player IDs from resolver format (_id) to PostgreSQL format (id)
        const winnerIds = (win.players || []).map((id) => {
          return id?.toString ? id.toString() : id;
        });
        await updateGame(gameId, {
          phase: "end",
          winner: win.winner,
          winner_player_ids: winnerIds,
        });
        await createGameLog({
          game_id: gameId,
          message: `🏁 Victory: ${win.winner}`,
        });
        console.log(`✅ Victory: ${win.winner}`);

        // Emit game state update to SSE clients so players see end screen
        await emitGameStateUpdate(gameId);

        return res.json({
          success: true,
          phase: "end",
          winner: win.winner,
          winners: win.players,
        });
      }

      // Switch to day
      const daySec = Number((game.timers || {}).daySeconds ?? 150);
      // Nový den = nové kolo - kolo se zvyšuje při přechodu night → day
      const newRound = (game.round || 0) + 1;
      await updateGame(gameId, {
        phase: "day",
        round: newRound,
        timer_state: { phaseEndsAt: endInMs(daySec) },
      });
      game.round = newRound;

      // ✅ RESET hlasování pro nový den - batch update
      console.log("🧹 Resetting votes for new day...");
      await updatePlayersByGameId(gameId, {
        has_voted: false,
        vote_for_id: null,
      });
      console.log("✅ Votes reset complete");

      await createGameLog({
        game_id: gameId,
        message: `Round ${newRound} - DAY (⏱ ${daySec}s)`,
      });
      console.log(`✅ [END-PHASE] Night → Day (Round ${newRound})`);
    }

    let finalGame = await findGameById(gameId);
    await createGameLog({
      game_id: gameId,
      message: `🔄 Phase ended: ${currentPhase} → ${finalGame.phase}`,
    });

    console.log(
      `✅ [END-PHASE] Phase changed: ${currentPhase} → ${game.phase}`
    );

    finalGame = await findGameById(gameId);

    // Emit game state update to SSE clients BEFORE sending response
    // Use immediate=true for important phase transitions
    console.log("📡 [END-PHASE] Emitting game state update...");
    await emitGameStateUpdate(gameId, true);
    console.log("✅ [END-PHASE] Game state update emitted");

    res.json({
      success: true,
      phase: finalGame.phase,
      round: finalGame.round,
      phaseEndsAt: finalGame.timer_state?.phaseEndsAt,
      winner: finalGame.winner || null,
    });
    await emitGameStateUpdate(gameId, true);
  } catch (e) {
    console.error("❌ end-phase error:", e);
    console.error("Stack:", e.stack);
    res.status(500).json({ error: e.message });
  }
});

// Set night action with mode selection
router.post("/:gameId/set-night-action", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, targetId, actionMode, puppetId } = req.body;

    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    if (!ensureUUID(playerId))
      return res.status(400).json({ error: "Invalid player id" });
    if (!ensureUUID(targetId))
      return res.status(400).json({ error: "Invalid target id" });

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.phase !== "night")
      return res.status(400).json({ error: "Not night phase" });

    const player = await findPlayerById(playerId);
    if (!player || !player.alive)
      return res.status(400).json({ error: "Player not found or dead" });

    const roleData = ROLES[player.role];

    // Check if role is Witch (requires puppetId)
    if (player.role === "Witch") {
      if (!puppetId || !ensureUUID(puppetId)) {
        return res.status(400).json({ error: "Witch requires puppetId" });
      }

      const puppet = await findPlayerById(puppetId);
      if (!puppet || !puppet.alive) {
        return res.status(400).json({ error: "Puppet not found or dead" });
      }

      // Puppet must have a night action (cannot be Citizen or Jester)
      if (
        !puppet.role ||
        puppet.role === "Citizen" ||
        puppet.role === "Jester"
      ) {
        return res
          .status(400)
          .json({ error: "Puppet must have a night action" });
      }

      await updatePlayer(playerId, {
        night_action: {
          targetId,
          action: "witch_control",
          puppetId,
          results: [],
        },
      });
    } else if (roleData?.actionType === "dual") {
      // Check if role has dual actions
      if (!actionMode)
        return res
          .status(400)
          .json({ error: "Action mode required for dual role" });

      // Check if special ability has uses left
      // For Poisoner: only strong_poison has limited uses, poison can be used unlimited
      // For other dual roles: first action (usually 'kill') is unlimited, second action has limited uses
      const firstAction = roleData.dualActions?.[0];
      const isLimitedAction = actionMode !== firstAction;

      if (isLimitedAction) {
        const roleDataObj = player.role_data || {};
        // Pokud není usesRemaining nastaveno, inicializuj ho z role definice
        if (
          roleDataObj.usesRemaining === undefined ||
          roleDataObj.usesRemaining === null
        ) {
          roleDataObj.usesRemaining = roleData.maxUses || 3;
        }
        const usesLeft = roleDataObj.usesRemaining;

        if (usesLeft <= 0) {
          return res
            .status(400)
            .json({ error: "No special ability uses remaining" });
        }

        // Decrement uses
        roleDataObj.usesRemaining = usesLeft - 1;
        await updatePlayer(playerId, {
          night_action: {
            targetId,
            action: actionMode,
            results: [],
          },
          role_data: roleDataObj,
        });
      } else {
        await updatePlayer(playerId, {
          night_action: {
            targetId,
            action: actionMode, // 'kill', 'clean_role', 'frame', 'consig_investigate'
            results: [],
          },
        });
      }
    } else {
      // Regular action
      await updatePlayer(playerId, {
        night_action: {
          targetId,
          action: roleData?.actionType || "none",
          results: [],
        },
      });
    }
    const updatedPlayer = await findPlayerById(playerId);
    const nightAction = updatedPlayer.night_action || {};
    console.log(
      `✓ ${updatedPlayer.name} set action: ${nightAction.action} → ${targetId}${
        puppetId ? ` (puppet: ${puppetId})` : ""
      }`
    );

    res.json({ success: true });
  } catch (e) {
    console.error("set-night-action error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Update player avatar (lobby only)
router.patch("/:gameId/player/:playerId/avatar", async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    const { avatar } = req.body || {};

    if (!ensureUUID(gameId))
      return res.status(400).json({ error: "Invalid game id" });
    if (!ensureUUID(playerId))
      return res.status(400).json({ error: "Invalid player id" });

    if (!avatar || typeof avatar !== "string") {
      return res.status(400).json({ error: "Avatar path is required" });
    }

    const game = await findGameById(gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Only allow changing avatar in lobby phase
    if (game.phase !== "lobby") {
      return res
        .status(400)
        .json({ error: "Can only change avatar in lobby phase" });
    }

    const player = await findPlayerById(playerId);
    if (!player || player.game_id?.toString() !== gameId) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Check if avatar is already used by another player
    const allPlayers = await findPlayersByGameId(gameId);
    const existingPlayer = allPlayers.find(
      (p) => p.avatar === avatar && p.id.toString() !== playerId
    );

    if (existingPlayer) {
      return res
        .status(400)
        .json({ error: "This avatar is already used by another player" });
    }

    // Update avatar
    const updatedPlayer = await updatePlayer(playerId, { avatar });

    // Emit game state update to SSE clients so lobby shows updated avatar
    await emitGameStateUpdate(gameId);

    res.json({ success: true, avatar: updatedPlayer.avatar });
  } catch (e) {
    console.error("update avatar error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get list of available avatars (without "details" or "detail" in name)
// Only from /avatars/ folder - role icons are NOT used as avatars
router.get("/avatars/available", async (req, res) => {
  try {
    const { gameId } = req.query;

    // Get all avatar paths from filesystem
    const allAvatarPaths = getAllAvailableAvatars();

    // Get used avatars if gameId is provided
    let usedAvatars = new Set();
    if (gameId && ensureUUID(gameId)) {
      const existingPlayers = await findPlayersByGameId(gameId);
      usedAvatars = new Set(
        existingPlayers.map((p) => p.avatar).filter(Boolean)
      );
    }

    // Convert to response format with availability info
    const avatars = allAvatarPaths.map((avatarPath) => {
      const fileName = path.basename(avatarPath);
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
      const isUsed = usedAvatars.has(avatarPath);

      return {
        path: avatarPath,
        name: nameWithoutExt,
        type: "generic",
        available: !isUsed,
      };
    });

    console.log(
      `🎨 Total avatars found: ${avatars.length} (${
        avatars.filter((a) => a.available).length
      } available)`
    );
    res.json({ success: true, avatars });
  } catch (e) {
    console.error("❌ get available avatars error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
