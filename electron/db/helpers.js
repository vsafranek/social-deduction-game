const { getSupabase } = require("../database");
const { randomUUID: uuidv4 } = require("crypto");

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

async function findGameById(id, fields = "*") {
  if (!ensureUUID(id)) {
    throw new Error("Invalid game ID format");
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select(fields)
    .eq("id", id)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle cases where no row or multiple rows exist

  // Handle specific error: if multiple rows exist, that's a data integrity issue
  if (error && error.code === "PGRST116") {
    // No rows found - this is OK, return null
    return null;
  }

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

  const results = await Promise.all(updatePromises);
  return results;
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
};
