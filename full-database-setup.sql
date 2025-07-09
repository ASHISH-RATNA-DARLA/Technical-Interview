-- Full Database Setup & Migration Script for Technical Interview Simulator
-- This script ensures all required tables, columns, indexes, views, and permissions exist.

-- Ensure user_responses table exists with all required columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_responses') THEN
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
    ELSE
        -- Add is_pro_user column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_responses' AND column_name = 'is_pro_user'
        ) THEN
            ALTER TABLE user_responses ADD COLUMN is_pro_user BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;
END $$;

-- Create indexes for user_responses
CREATE INDEX IF NOT EXISTS idx_user_responses_session_id ON user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_tech_stack ON user_responses(tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_responses_created_at ON user_responses(created_at);

-- Ensure response_evaluations table exists
CREATE TABLE IF NOT EXISTS response_evaluations (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    evaluation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for response_evaluations
CREATE INDEX IF NOT EXISTS idx_response_evaluations_session_id ON response_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_tech_stack ON response_evaluations(tech_stack);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_created_at ON response_evaluations(created_at);

-- Create or replace the interview_sessions view
CREATE OR REPLACE VIEW interview_sessions AS
SELECT 
    ur.session_id,
    ur.tech_stack,
    ur.is_pro_user,
    ur.created_at as interview_date,
    COUNT(ur.id) as total_questions,
    AVG(ur.time_spent) as avg_time_per_question,
    re.evaluation_data,
    re.created_at as evaluation_date
FROM user_responses ur
LEFT JOIN response_evaluations re ON ur.session_id = re.session_id
GROUP BY ur.session_id, ur.tech_stack, ur.is_pro_user, ur.created_at, re.evaluation_data, re.created_at;

-- Table for storing only long and short answers, with session management
CREATE TABLE IF NOT EXISTS user_responses (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'short' or 'long'
    user_answer TEXT NOT NULL,
    time_spent INTEGER NOT NULL,
    is_pro_user BOOLEAN DEFAULT FALSE,
    resume_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_responses_session_id ON user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_tech_stack ON user_responses(tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_responses_created_at ON user_responses(created_at);

-- Table for storing the final report (MCQ marks + long/short evaluation), with session management
CREATE TABLE IF NOT EXISTS final_reports (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    mcq_marks INTEGER NOT NULL,
    long_short_evaluation JSONB NOT NULL, -- Feedback/results for long/short answers
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_final_reports_session_id ON final_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_final_reports_tech_stack ON final_reports(tech_stack);
CREATE INDEX IF NOT EXISTS idx_final_reports_created_at ON final_reports(created_at);

-- Permissions (Supabase)
GRANT ALL ON user_responses TO anon, authenticated;
GRANT ALL ON final_reports TO anon, authenticated;
GRANT USAGE ON SEQUENCE user_responses_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE final_reports_id_seq TO anon, authenticated; 

-- Table for queueing Mistral API jobs for non-Pro users
CREATE TABLE IF NOT EXISTS mistral_queue (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    long_short_answers JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'done', 'error'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
); 