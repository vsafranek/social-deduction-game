-- Add performance indexes for frequently used queries
-- This migration adds composite indexes and indexes on commonly filtered columns

-- Composite index for filtering alive players by game_id (used in voting, victory checks)
CREATE INDEX IF NOT EXISTS idx_players_game_id_alive ON players(game_id, alive) WHERE alive = true;

-- Index for filtering players by game_id and alive status (alternative for dead players)
CREATE INDEX IF NOT EXISTS idx_players_game_id_alive_false ON players(game_id, alive) WHERE alive = false;

-- Index for room_code lookups (already exists, but ensuring it's there)
-- CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code); -- Already in 001

-- Index for phase-based queries (already exists, but ensuring it's there)
-- CREATE INDEX IF NOT EXISTS idx_games_phase ON games(phase); -- Already in 001

-- Composite index for game_logs queries by game_id and created_at (for ordered log retrieval)
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id_created_at ON game_logs(game_id, created_at DESC);

-- Index for players lookup by vote_for_id (used in voting resolution)
CREATE INDEX IF NOT EXISTS idx_players_vote_for_id ON players(vote_for_id) WHERE vote_for_id IS NOT NULL;

-- Index for players lookup by role (used in role-based queries)
CREATE INDEX IF NOT EXISTS idx_players_role ON players(role) WHERE role IS NOT NULL;

-- Index for players lookup by modifier (used in modifier-based queries)
CREATE INDEX IF NOT EXISTS idx_players_modifier ON players(modifier) WHERE modifier IS NOT NULL;

-- Note: Foreign key indexes are automatically created by PostgreSQL for foreign keys,
-- but we're adding explicit indexes for better query planning

