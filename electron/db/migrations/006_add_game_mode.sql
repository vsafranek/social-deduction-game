-- Add mode column to games table
-- Mode: 'party' (moderator only) or 'classic' (host can also play)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'party' 
CHECK (mode IN ('party', 'classic'));

-- Update existing games to have 'party' mode (backward compatibility)
UPDATE games SET mode = 'party' WHERE mode IS NULL;
