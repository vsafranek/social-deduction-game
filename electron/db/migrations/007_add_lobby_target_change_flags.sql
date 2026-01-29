-- Add lobby target-change flags to games table
-- When true, players can change vote / night action target after confirming
ALTER TABLE games
ADD COLUMN IF NOT EXISTS allow_change_vote_target BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS allow_change_night_action_target BOOLEAN NOT NULL DEFAULT false;
