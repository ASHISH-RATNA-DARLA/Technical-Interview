-- Debug script to check and fix database issues
-- Run this in Supabase SQL Editor

-- 1. Check if the table exists
SELECT 'Table exists' as status, table_name 
FROM information_schema.tables 
WHERE table_name = 'user_responses';

-- 2. Check all columns in the table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_responses'
ORDER BY ordinal_position;

-- 3. Drop and recreate the table if needed
DROP TABLE IF EXISTS response_evaluations CASCADE;
DROP TABLE IF EXISTS user_responses CASCADE;

-- 4. Create the table with the correct schema
CREATE TABLE user_responses (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    user_answer TEXT NOT NULL,
    time_spent INTEGER NOT NULL,
    is_pro_user BOOLEAN DEFAULT FALSE,
    resume_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create response_evaluations table
CREATE TABLE response_evaluations (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    evaluation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes
CREATE INDEX idx_user_responses_session_id ON user_responses(session_id);
CREATE INDEX idx_user_responses_tech_stack ON user_responses(tech_stack);
CREATE INDEX idx_user_responses_created_at ON user_responses(created_at);

CREATE INDEX idx_response_evaluations_session_id ON response_evaluations(session_id);
CREATE INDEX idx_response_evaluations_tech_stack ON response_evaluations(tech_stack);
CREATE INDEX idx_response_evaluations_created_at ON response_evaluations(created_at);

-- 7. Grant permissions
GRANT ALL ON user_responses TO anon, authenticated;
GRANT ALL ON response_evaluations TO anon, authenticated;
GRANT USAGE ON SEQUENCE user_responses_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE response_evaluations_id_seq TO anon, authenticated;

-- 8. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 9. Verify the table structure
SELECT 'Final verification' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_responses' 
ORDER BY ordinal_position; 