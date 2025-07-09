-- Quick fix: Add missing column if table exists
-- Run this in Supabase SQL editor if you get the "is_pro_user column not found" error

-- Check if the table exists and add the missing column
DO $$
BEGIN
    -- Check if user_responses table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_responses') THEN
        -- Check if is_pro_user column exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_responses' AND column_name = 'is_pro_user'
        ) THEN
            -- Add the missing column
            ALTER TABLE user_responses ADD COLUMN is_pro_user BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Added is_pro_user column to user_responses table';
        ELSE
            RAISE NOTICE 'is_pro_user column already exists in user_responses table';
        END IF;
    ELSE
        RAISE NOTICE 'user_responses table does not exist. Please run the full migration first.';
    END IF;
END $$;

-- Check if response_evaluations table exists, if not create it
CREATE TABLE IF NOT EXISTS response_evaluations (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    evaluation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_responses_session_id ON user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_tech_stack ON user_responses(tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_responses_created_at ON user_responses(created_at);

CREATE INDEX IF NOT EXISTS idx_response_evaluations_session_id ON response_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_tech_stack ON response_evaluations(tech_stack);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_created_at ON response_evaluations(created_at);

-- Grant permissions
GRANT ALL ON user_responses TO anon, authenticated;
GRANT ALL ON response_evaluations TO anon, authenticated;
GRANT USAGE ON SEQUENCE user_responses_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE response_evaluations_id_seq TO anon, authenticated; 