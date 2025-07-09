-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS response_evaluations CASCADE;
DROP TABLE IF EXISTS user_responses CASCADE;
DROP VIEW IF EXISTS interview_sessions;

-- Create user_responses table
CREATE TABLE user_responses (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'mcq', 'short', 'long'
    user_answer TEXT NOT NULL,
    time_spent INTEGER NOT NULL,
    is_pro_user BOOLEAN DEFAULT FALSE,
    resume_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_responses_session_id ON user_responses(session_id);
CREATE INDEX idx_user_responses_tech_stack ON user_responses(tech_stack);
CREATE INDEX idx_user_responses_created_at ON user_responses(created_at);

-- Create response_evaluations table for storing Mistral LLM evaluation results
CREATE TABLE response_evaluations (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    evaluation_data JSONB NOT NULL, -- Stores the complete evaluation response from Mistral
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for response_evaluations
CREATE INDEX idx_response_evaluations_session_id ON response_evaluations(session_id);
CREATE INDEX idx_response_evaluations_tech_stack ON response_evaluations(tech_stack);
CREATE INDEX idx_response_evaluations_created_at ON response_evaluations(created_at);

-- Create a view for easy access to responses with their evaluations
CREATE VIEW interview_sessions AS
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

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE response_evaluations ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON user_responses TO anon, authenticated;
GRANT ALL ON response_evaluations TO anon, authenticated;
GRANT ALL ON interview_sessions TO anon, authenticated;
GRANT USAGE ON SEQUENCE user_responses_id_seq TO anon, authenticated;
GRANT USAGE ON SEQUENCE response_evaluations_id_seq TO anon, authenticated; 