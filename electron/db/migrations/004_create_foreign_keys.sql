-- Add foreign key constraints after all tables are created

-- Add foreign key constraint for games.mayor_id -> players.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'games_mayor_id_fkey' 
        AND conrelid = 'games'::regclass
    ) THEN
        ALTER TABLE games 
        ADD CONSTRAINT games_mayor_id_fkey 
        FOREIGN KEY (mayor_id) REFERENCES players(id) ON DELETE SET NULL;
    END IF;
END $$;

