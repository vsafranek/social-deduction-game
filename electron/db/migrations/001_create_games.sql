-- Create games table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) UNIQUE NOT NULL,
  phase VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'night', 'day', 'end')),
  round INTEGER NOT NULL DEFAULT 0,
  mayor_id UUID,
  winner VARCHAR(20) CHECK (winner IN ('good', 'evil', 'solo', 'custom')),
  ip VARCHAR(255),
  port INTEGER,
  timers JSONB DEFAULT '{"nightSeconds": 30, "daySeconds": 30}'::jsonb,
  timer_state JSONB DEFAULT '{"phaseEndsAt": null}'::jsonb,
  role_configuration JSONB DEFAULT '{"Doctor": 1, "Police": 1, "Investigator": 1, "Lookout": 1, "Guardian": 1, "Tracker": 1, "Citizen": 1, "Cleaner": 0, "Falšovač": 0}'::jsonb,
  modifier_configuration JSONB DEFAULT '{"drunkChance": 0.2, "shadyChance": 0.15}'::jsonb,
  winner_player_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_phase ON games(phase);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

