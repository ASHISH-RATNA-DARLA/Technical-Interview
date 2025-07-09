-- Create user_responses table
CREATE TABLE IF NOT EXISTS user_responses (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'mcq', 'short', 'long'
    user_answer TEXT NOT NULL,
    time_spent INTEGER NOT NULL,
    is_pro_user BOOLEAN DEFAULT FALSE,
    resume_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for better query performance
    INDEX idx_session_id (session_id),
    INDEX idx_tech_stack (tech_stack),
    INDEX idx_created_at (created_at)
);

-- Create response_evaluations table for storing Mistral LLM evaluation results
CREATE TABLE IF NOT EXISTS response_evaluations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    tech_stack VARCHAR(100) NOT NULL,
    evaluation_data JSONB NOT NULL, -- Stores the complete evaluation response from Mistral
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_eval_session_id (session_id),
    INDEX idx_eval_tech_stack (tech_stack),
    INDEX idx_eval_created_at (created_at)
);

-- Create a view for easy access to responses with their evaluations
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

-- Add some helpful comments
COMMENT ON TABLE user_responses IS 'Stores individual user responses to interview questions';
COMMENT ON TABLE response_evaluations IS 'Stores AI evaluation results from Mistral LLM';
COMMENT ON VIEW interview_sessions IS 'Aggregated view of interview sessions with evaluations'; 

-- Create resumes table for storing uploaded resumes (Pro users only)
CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255), -- nullable, if you want to associate with a user
    session_id VARCHAR(255), -- link to interview session if needed
    file_name VARCHAR(255) NOT NULL,
    extracted_text TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_session_id ON resumes(session_id);
CREATE INDEX IF NOT EXISTS idx_resume_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_uploaded_at ON resumes(uploaded_at); 