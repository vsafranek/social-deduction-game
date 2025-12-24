-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  modifier VARCHAR(50),
  alive BOOLEAN NOT NULL DEFAULT true,
  has_voted BOOLEAN NOT NULL DEFAULT false,
  vote_for_id UUID REFERENCES players(id) ON DELETE SET NULL,
  vote_weight INTEGER NOT NULL DEFAULT 1,
  avatar VARCHAR(255),
  affiliations VARCHAR(50)[] DEFAULT '{}',
  victory_conditions JSONB DEFAULT '{"canWinWithTeams": [], "soloWin": false, "customRules": []}'::jsonb,
  effects JSONB DEFAULT '[]'::jsonb,
  night_action JSONB DEFAULT '{"targetId": null, "action": null, "puppetId": null, "results": []}'::jsonb,
  role_data JSONB DEFAULT '{}'::jsonb,
  role_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_players_game_id_session_id ON players(game_id, session_id);

