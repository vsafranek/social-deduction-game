const { getSupabase } = require("../database");
const { randomUUID: uuidv4 } = require("crypto");

// Helper to validate UUID
function ensureUUID(id) {
  if (!id) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.toString());
}

// Normalize input data to PostgreSQL format (accept both camelCase and snake_case)
function normalizeToPostgres(obj) {
  if (!obj) return null;
  const result = { ...obj };

  // Convert common MongoDB-style fields to PostgreSQL if present
  if (result._id !== undefined) {
    result.id = result._id;
    delete result._id;
  }
  if (result.gameId !== undefined) {
    result.game_id = result.gameId;
    delete result.gameId;
  }
  if (result.sessionId !== undefined) {
    result.session_id = result.sessionId;
    delete result.sessionId;
  }
  if (result.hasVoted !== undefined) {
    result.has_voted = result.hasVoted;
    delete result.hasVoted;
  }
  if (result.voteFor !== undefined) {
    result.vote_for_id = result.voteFor;
    delete result.voteFor;
  }
  if (result.voteWeight !== undefined) {
    result.vote_weight = result.voteWeight;
    delete result.voteWeight;
  }
  if (result.roleData !== undefined) {
    result.role_data = result.roleData;
    delete result.roleData;
  }
  if (result.roleHidden !== undefined) {
    result.role_hidden = result.roleHidden;
    delete result.roleHidden;
  }
  if (result.nightAction !== undefined) {
    result.night_action = result.nightAction;
    delete result.nightAction;
  }
  if (result.victoryConditions !== undefined) {
    result.victory_conditions = result.victoryConditions;
    delete result.victoryConditions;
  }
  if (result.roomCode !== undefined) {
    result.room_code = result.roomCode;
    delete result.roomCode;
  }
  if (result.mayor !== undefined) {
    result.mayor_id = result.mayor;
    delete result.mayor;
  }
  if (result.timerState !== undefined) {
    result.timer_state = result.timerState;
    delete result.timerState;
  }
  if (result.winnerPlayerIds !== undefined) {
    result.winner_player_ids = result.winnerPlayerIds;
    delete result.winnerPlayerIds;
  }
  if (result.modifierConfiguration !== undefined) {
    result.modifier_configuration = result.modifierConfiguration;
    delete result.modifierConfiguration;
  }
  if (result.roleConfiguration !== undefined) {
    result.role_configuration = result.roleConfiguration;
    delete result.roleConfiguration;
  }
  if (result.createdAt !== undefined) {
    delete result.createdAt; // Don't allow updating created_at
  }
  if (result.updatedAt !== undefined) {
    delete result.updatedAt; // Don't allow updating updated_at
  }

  return result;
}

// Convert PostgreSQL format to resolver-compatible format (temporary bridge for resolvers)
// This allows resolvers to continue using camelCase/_id until they're refactored
function convertForResolvers(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    return obj.map(convertForResolvers);
  }
  return {
    ...obj,
    _id: obj.id,
    gameId: obj.game_id,
    sessionId: obj.session_id,
    hasVoted: obj.has_voted,
    voteFor: obj.vote_for_id,
    voteWeight: obj.vote_weight,
    roleData: obj.role_data,
    roleHidden: obj.role_hidden,
    nightAction: obj.night_action,
    victoryConditions: obj.victory_conditions,
    roomCode: obj.room_code,
    mayor: obj.mayor_id,
    timerState: obj.timer_state,
    winnerPlayerIds: obj.winner_player_ids,
    modifierConfiguration: obj.modifier_configuration,
    roleConfiguration: obj.role_configuration,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
  };
}

// Helper to handle Supabase errors
function handleSupabaseError(error, operation) {
  if (error) {
    console.error(`❌ ${operation} error:`, error.message);
    throw new Error(`${operation} failed: ${error.message}`);
  }
}

// ===== GAMES =====

async function findGameById(id, fields = "*") {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select(fields)
    .eq("id", id)
    .single();

  handleSupabaseError(error, "findGameById");
  return data || null;
}

async function findGameByRoomCode(roomCode, fields = "*") {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select(fields)
    .eq("room_code", roomCode)
    .single();

  handleSupabaseError(error, "findGameByRoomCode");
  return data || null;
}

async function createGame(gameData) {
  const supabase = getSupabase();
  const normalizedData = normalizeToPostgres({
    ...gameData,
    id: gameData.id || gameData._id || uuidv4(),
  });

  const { data, error } = await supabase
    .from("games")
    .insert(normalizedData)
    .select()
    .single();

  handleSupabaseError(error, "createGame");
  return data;
}

async function updateGame(id, updateData) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const normalizedData = normalizeToPostgres(updateData);
  delete normalizedData.id; // Don't allow updating id
  delete normalizedData._id;

  const { data, error } = await supabase
    .from("games")
    .update(normalizedData)
    .eq("id", id)
    .select()
    .single();

  handleSupabaseError(error, "updateGame");
  return data;
}

async function deleteGame(id) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { error } = await supabase.from("games").delete().eq("id", id);

  handleSupabaseError(error, "deleteGame");
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

// ===== PLAYERS =====

async function findPlayerById(id, fields = "*") {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("players")
    .select(fields)
    .eq("id", id)
    .single();

  handleSupabaseError(error, "findPlayerById");
  return data || null;
}

async function findPlayersByGameId(gameId, fields = "*") {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
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
  const normalizedData = normalizeToPostgres({
    ...playerData,
    id: playerData.id || playerData._id || uuidv4(),
    game_id: playerData.game_id || playerData.gameId,
  });
  delete normalizedData.gameId; // Ensure only game_id is present

  const { data, error } = await supabase
    .from("players")
    .insert(normalizedData)
    .select()
    .single();

  handleSupabaseError(error, "createPlayer");
  return data;
}

async function updatePlayer(id, updateData) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }
  const supabase = getSupabase();
  const normalizedData = normalizeToPostgres(updateData);

  // Remove fields that shouldn't be updated directly
  delete normalizedData._id;
  delete normalizedData.id;
  delete normalizedData.gameId;
  delete normalizedData.game_id; // Don't allow changing game_id
  delete normalizedData.created_at; // Don't allow updating created_at

  const { data, error } = await supabase
    .from("players")
    .update(normalizedData)
    .eq("id", id)
    .select()
    .single();

  handleSupabaseError(error, "updatePlayer");
  return data;
}

async function deletePlayer(id) {
  if (!ensureUUID(id)) {
    throw new Error("Invalid player ID format");
  }
  const supabase = getSupabase();
  const { error } = await supabase.from("players").delete().eq("id", id);

  handleSupabaseError(error, "deletePlayer");
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
  return true;
}

// Batch update all players in a game with the same updates
async function updatePlayersByGameId(gameId, updateData) {
  if (!ensureUUID(gameId)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const normalizedData = normalizeToPostgres(updateData);

  // Remove fields that shouldn't be updated directly
  delete normalizedData._id;
  delete normalizedData.id;
  delete normalizedData.gameId;
  delete normalizedData.game_id; // Don't allow changing game_id
  delete normalizedData.created_at; // Don't allow updating created_at

  const { data, error } = await supabase
    .from("players")
    .update(normalizedData)
    .eq("game_id", gameId)
    .select();

  handleSupabaseError(error, "updatePlayersByGameId");
  return data || [];
}

// Batch update multiple players with different update data
// updates is an array of { id, updates } objects
async function updatePlayersBatch(updates) {
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

  // Use Promise.all for parallel updates (Supabase doesn't support batch updates with different values)
  // This is still more efficient than sequential updates
  const updatePromises = updates.map(async ({ id, updates: updateData }) => {
    const normalizedData = normalizeToPostgres(updateData);

    // Remove fields that shouldn't be updated directly
    delete normalizedData._id;
    delete normalizedData.id;
    delete normalizedData.gameId;
    delete normalizedData.game_id; // Don't allow changing game_id
    delete normalizedData.created_at; // Don't allow updating created_at

    const { data, error } = await supabase
      .from("players")
      .update(normalizedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update player ${id}: ${error.message}`);
    }

    return data;
  });

  const results = await Promise.all(updatePromises);
  return results;
}

// ===== GAME LOGS =====

async function createGameLog(logData) {
  const supabase = getSupabase();
  // Extract game_id before normalization to ensure it's preserved
  const gameId = logData.game_id || logData.gameId;
  if (!gameId) {
    throw new Error("game_id or gameId is required for createGameLog");
  }

  const normalizedData = normalizeToPostgres({
    ...logData,
    id: logData.id || logData._id || uuidv4(),
  });

  // Ensure game_id is set (normalizeToPostgres converts gameId to game_id, but we want to be explicit)
  normalizedData.game_id = gameId;
  delete normalizedData.gameId; // Ensure only game_id is present

  const { data, error } = await supabase
    .from("game_logs")
    .insert(normalizedData)
    .select()
    .single();

  handleSupabaseError(error, "createGameLog");
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
  convertForResolvers,
};
