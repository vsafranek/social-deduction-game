const { getSupabase } = require("../database");
const { randomUUID: uuidv4 } = require("crypto");
const { cache, cacheHelpers } = require("./cache");

// Helper to validate UUID
function ensureUUID(id) {
  if (!id) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.toString());
}

// Helper to handle Supabase errors
function handleSupabaseError(error, operation) {
  if (error) {
    console.error(`❌ ${operation} error:`, error.message);
    throw new Error(`${operation} failed: ${error.message}`);
  }
}

// ===== GAMES =====

async function findGameById(id, fields = "*", useCache = true) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }

  // Try cache first (only for default fields)
  if (useCache && fields === "*") {
    const cached = await cacheHelpers.getOrFetchGame(
      id,
      async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("games")
          .select(fields)
          .eq("id", id)
          .maybeSingle();

        if (error && error.code === "PGRST116") {
          return null;
        }

        handleSupabaseError(error, "findGameById");
        return data || null;
      },
      1000 // 1 second TTL
    );
    return cached;
  }

  // Direct query for custom fields or when cache is disabled
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select(fields)
    .eq("id", id)
    .maybeSingle();

  if (error && error.code === "PGRST116") {
    return null;
  }

  handleSupabaseError(error, "findGameById");
  return data || null;
}

async function findGameByRoomCode(roomCode, fields = "*") {
  const key = cacheHelpers.keys.gameByRoomCode(roomCode);
  const cached = cache.get(key);
  // Check for undefined to distinguish "key not in cache" from "cached value is null"
  // cache.get() returns null for non-existent keys, but we need to check if key exists
  // We'll use a special marker object to cache null values
  if (cached !== null && fields === "*") {
    // If cached is a special marker, return null; otherwise return cached value
    if (cached === cacheHelpers.NULL_MARKER) {
      return null;
    }
    return cached;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select(fields)
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error && error.code === "PGRST116") {
    return null;
  }

  handleSupabaseError(error, "findGameByRoomCode");
  const result = data || null;
  
  // Cache the result, even if it's null (use special marker to distinguish from "key not in cache")
  if (fields === "*") {
    const valueToCache = result === null ? cacheHelpers.NULL_MARKER : result;
    cache.set(key, valueToCache, 2000); // 2 second TTL for room code lookups
  }
  
  return result;
}

async function createGame(gameData) {
  const supabase = getSupabase();
  const dataToInsert = {
    ...gameData,
    id: gameData.id || uuidv4(),
  };

  const { data, error } = await supabase
    .from("games")
    .insert(dataToInsert)
    .select()
    .single();

  handleSupabaseError(error, "createGame");
  return data;
}

async function updateGame(id, updateData) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  
  // Get current game data to retrieve room_code for cache invalidation
  // Use cache disabled to ensure we get fresh data
  const currentGame = await findGameById(id, "room_code", false);
  const roomCode = currentGame?.room_code || updateData.room_code;
  
  const supabase = getSupabase();
  const dataToUpdate = { ...updateData };
  delete dataToUpdate.id; // Don't allow updating id
  delete dataToUpdate._id;

  const { data, error } = await supabase
    .from("games")
    .update(dataToUpdate)
    .eq("id", id)
    .select()
    .single();

  handleSupabaseError(error, "updateGame");
  
  // Invalidate cache after update
  if (data) {
    cache.invalidateGame(id);
    // Invalidate old room code cache if it exists
    if (roomCode) {
      const oldRoomCodeKey = cacheHelpers.keys.gameByRoomCode(roomCode);
      cache.delete(oldRoomCodeKey);
    }
    // If room_code was updated, also invalidate the new room code cache
    if (data.room_code && roomCode && data.room_code !== roomCode) {
      const newRoomCodeKey = cacheHelpers.keys.gameByRoomCode(data.room_code);
      cache.delete(newRoomCodeKey);
    }
    // If room_code exists but we didn't have old roomCode, invalidate it anyway
    if (data.room_code && !roomCode) {
      const roomCodeKey = cacheHelpers.keys.gameByRoomCode(data.room_code);
      cache.delete(roomCodeKey);
    }
  }
  
  return data;
}

async function deleteGame(id) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  
  // Get current game data to retrieve room_code for cache invalidation
  // Use cache disabled to ensure we get fresh data
  const currentGame = await findGameById(id, "room_code", false);
  const roomCode = currentGame?.room_code;
  
  const supabase = getSupabase();
  const { error } = await supabase.from("games").delete().eq("id", id);

  handleSupabaseError(error, "deleteGame");
  
  // Invalidate cache after delete
  cache.invalidateGame(id);
  // Also invalidate room code cache if the game had a room code
  if (roomCode) {
    const roomCodeKey = cacheHelpers.keys.gameByRoomCode(roomCode);
    cache.delete(roomCodeKey);
  }
  
  return true;
}

// Load game and players together (parallel queries for better performance)
async function findGameWithPlayers(
  gameId,
  gameFields = "*",
  playerFields = "*"
) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }

  // Load game and players in parallel
  const [game, players] = await Promise.all([
    findGameById(gameId, gameFields),
    findPlayersByGameId(gameId, playerFields),
  ]);

  return { game, players };
}

// Load complete game state (game, players, logs) in parallel for optimal performance
async function getGameStateComplete(gameId, logLimit = 200, useCache = true) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }

  // Try cache first
  if (useCache) {
    const cached = await cacheHelpers.getOrFetchGameState(
      gameId,
      async () => {
        // Load game, players, and logs in parallel
        const [game, players, logs] = await Promise.all([
          findGameById(gameId, "*", false), // Disable cache to avoid double caching
          findPlayersByGameId(gameId, "*", false),
          findGameLogsByGameId(gameId, logLimit),
        ]);
        return { game, players, logs };
      },
      1000 // 1 second TTL
    );
    return cached;
  }

  // Load game, players, and logs in parallel without cache
  const [game, players, logs] = await Promise.all([
    findGameById(gameId, "*", false),
    findPlayersByGameId(gameId, "*", false),
    findGameLogsByGameId(gameId, logLimit),
  ]);

  return { game, players, logs };
}

// ===== PLAYERS =====

async function findPlayerById(id, fields = "*", useCache = true) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }

  // Try cache first (only for default fields)
  if (useCache && fields === "*") {
    const cached = await cacheHelpers.getOrFetchPlayer(
      id,
      async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("players")
          .select(fields)
          .eq("id", id)
          .maybeSingle();

        if (error && error.code === "PGRST116") {
          return null;
        }

        handleSupabaseError(error, "findPlayerById");
        return data || null;
      },
      1000 // 1 second TTL
    );
    return cached;
  }

  // Direct query for custom fields or when cache is disabled
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select(fields)
    .eq("id", id)
    .maybeSingle();

  if (error && error.code === "PGRST116") {
    return null;
  }

  handleSupabaseError(error, "findPlayerById");
  return data || null;
}

async function findPlayersByGameId(gameId, fields = "*", useCache = true) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }

  // Try cache first (only for default fields)
  if (useCache && fields === "*") {
    const cached = await cacheHelpers.getOrFetchPlayers(
      gameId,
      async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("players")
          .select(fields)
          .eq("game_id", gameId)
          .order("created_at", { ascending: true });

        handleSupabaseError(error, "findPlayersByGameId");
        return data || [];
      },
      1000 // 1 second TTL
    );
    return cached;
  }

  // Direct query for custom fields or when cache is disabled
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select(fields)
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  handleSupabaseError(error, "findPlayersByGameId");
  return data || [];
}

async function findPlayerByGameAndSession(gameId, sessionId, fields = "*") {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select(fields)
    .eq("game_id", gameId)
    .eq("session_id", sessionId)
    .single();

  // 404 is OK - player doesn't exist yet
  if (error && error.code !== "PGRST116") {
    handleSupabaseError(error, "findPlayerByGameAndSession");
  }

  return data || null;
}

async function createPlayer(playerData) {
  const supabase = getSupabase();
  const dataToInsert = {
    ...playerData,
    id: playerData.id || uuidv4(),
    game_id: playerData.game_id,
  };

  const { data, error } = await supabase
    .from("players")
    .insert(dataToInsert)
    .select()
    .single();

  handleSupabaseError(error, "createPlayer");
  
  // Invalidate cache after create
  if (data && data.game_id) {
    cache.invalidateGame(data.game_id);
  }
  
  return data;
}

async function updatePlayer(id, updateData) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }
  const supabase = getSupabase();
  const dataToUpdate = { ...updateData };

  // Remove fields that shouldn't be updated directly
  delete dataToUpdate._id;
  delete dataToUpdate.id;
  delete dataToUpdate.gameId;
  delete dataToUpdate.game_id; // Don't allow changing game_id
  delete dataToUpdate.created_at; // Don't allow updating created_at

  const { data, error } = await supabase
    .from("players")
    .update(dataToUpdate)
    .eq("id", id)
    .select()
    .single();

  handleSupabaseError(error, "updatePlayer");
  
  // Invalidate cache after update
  if (data) {
    cache.invalidatePlayer(id);
    if (data.game_id) {
      cache.invalidateGame(data.game_id);
    }
  }
  
  return data;
}

async function deletePlayer(id) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }
  
  // Get player first to know which game to invalidate
  const player = await findPlayerById(id, "game_id", false);
  const gameId = player?.game_id;
  
  const supabase = getSupabase();
  const { error } = await supabase.from("players").delete().eq("id", id);

  handleSupabaseError(error, "deletePlayer");
  
  // Invalidate cache after delete
  cache.invalidatePlayer(id);
  if (gameId) {
    cache.invalidateGame(gameId);
  }
  
  return true;
}

async function deletePlayersByGameId(gameId) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("game_id", gameId);

  handleSupabaseError(error, "deletePlayersByGameId");
  
  // Invalidate cache after delete
  cache.invalidateGame(gameId);
  
  return true;
}

// Batch update all players in a game with the same updates
async function updatePlayersByGameId(gameId, updateData) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const dataToUpdate = { ...updateData };

  // Remove fields that shouldn't be updated directly
  delete dataToUpdate._id;
  delete dataToUpdate.id;
  delete dataToUpdate.gameId;
  delete dataToUpdate.game_id; // Don't allow changing game_id
  delete dataToUpdate.created_at; // Don't allow updating created_at

  const { data, error } = await supabase
    .from("players")
    .update(dataToUpdate)
    .eq("game_id", gameId)
    .select();

  handleSupabaseError(error, "updatePlayersByGameId");
  
  // Invalidate cache after batch update
  cache.invalidateGame(gameId);
  
  return data || [];
}

// Batch update multiple players with different update data
// updates is an array of { id, updates } objects
// Optimized with batching and concurrency limit
async function updatePlayersBatch(updates, concurrencyLimit = 10) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return [];
  }

  const supabase = getSupabase();

  // Validate all IDs
  for (const update of updates) {
    if (!ensureUUID(update.id)) {
      throw new Error(`Invalid player ID format: ${update.id}`);
    }
  }

  // Helper function to process updates in batches
  // Uses Promise.allSettled to collect both successes and failures
  async function processBatch(batch) {
    const updatePromises = batch.map(async ({ id, updates: updateData }) => {
      const dataToUpdate = { ...updateData };

      // Remove fields that shouldn't be updated directly
      delete dataToUpdate._id;
      delete dataToUpdate.id;
      delete dataToUpdate.gameId;
      delete dataToUpdate.game_id; // Don't allow changing game_id
      delete dataToUpdate.created_at; // Don't allow updating created_at

      const { data, error } = await supabase
        .from("players")
        .update(dataToUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update player ${id}: ${error.message}`);
      }

      return data;
    });

    // Use allSettled to collect both successes and failures
    const settled = await Promise.allSettled(updatePromises);
    const results = [];
    const errors = [];
    
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        errors.push(outcome.reason);
      }
    }
    
    return { results, errors };
  }

  // Process updates in batches with concurrency limit
  const allResults = [];
  const allErrors = [];
  
  for (let i = 0; i < updates.length; i += concurrencyLimit) {
    const batch = updates.slice(i, i + concurrencyLimit);
    const { results, errors } = await processBatch(batch);
    allResults.push(...results);
    allErrors.push(...errors);
  }

  // Invalidate cache for all affected games from successfully updated players
  // This ensures cache is invalidated even if some updates failed
  const gameIds = new Set();
  for (const result of allResults) {
    if (result?.game_id) {
      gameIds.add(result.game_id);
    }
  }
  
  for (const gameId of gameIds) {
    cache.invalidateGame(gameId);
  }

  // Throw error if any updates failed
  if (allErrors.length > 0) {
    // Combine all errors into a single error message
    const errorMessages = allErrors.map(e => e.message).join('; ');
    throw new Error(`Some player updates failed: ${errorMessages}`);
  }

  return allResults;
}

// ===== GAME LOGS =====

async function createGameLog(logData) {
  const supabase = getSupabase();
  // Extract game_id from logData
  const gameId = logData.game_id;
  if (!gameId) {
    throw new Error("game_id is required for createGameLog");
  }

  const dataToInsert = {
    ...logData,
    id: logData.id || uuidv4(),
    game_id: gameId,
  };

  const { data, error } = await supabase
    .from("game_logs")
    .insert(dataToInsert)
    .select()
    .single();

  handleSupabaseError(error, "createGameLog");
  
  // Invalidate game state cache when new log is created
  if (data && gameId) {
    cache.delete(cacheHelpers.keys.logs(gameId));
    cache.delete(cacheHelpers.keys.gameState(gameId));
  }
  
  return data;
}

async function findGameLogsByGameId(gameId, limit = 200, fields = "*") {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("game_logs")
    .select(fields)
    .eq("game_id", gameId)
    .order("created_at", { ascending: true })
    .limit(limit);

  handleSupabaseError(error, "findGameLogsByGameId");
  return data || [];
}

async function deleteGameLogsByGameId(gameId) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from("game_logs")
    .delete()
    .eq("game_id", gameId);

  handleSupabaseError(error, "deleteGameLogsByGameId");
  return true;
}

module.exports = {
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
};
