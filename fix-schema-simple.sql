-- Simple Database Schema Fix (Alternative if the main one fails)
-- Execute this SQL for basic fixes without complex views

-- 1. Ensure final_reports table allows NULL for long_short_evaluation initially
ALTER TABLE final_reports ALTER COLUMN long_short_evaluation DROP NOT NULL;

-- 2. Add basic indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_responses_session_tech ON user_responses(session_id, tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_responses_question_type ON user_responses(question_type);
CREATE INDEX IF NOT EXISTS idx_user_responses_is_pro ON user_responses(is_pro_user);

CREATE INDEX IF NOT EXISTS idx_final_reports_session_tech ON final_reports(session_id, tech_stack);
CREATE INDEX IF NOT EXISTS idx_final_reports_mcq_marks ON final_reports(mcq_marks);

CREATE INDEX IF NOT EXISTS idx_response_evaluations_session_tech ON response_evaluations(session_id, tech_stack);

CREATE INDEX IF NOT EXISTS idx_mistral_queue_status ON mistral_queue(status);
CREATE INDEX IF NOT EXISTS idx_mistral_queue_created_at ON mistral_queue(created_at);

-- 3. Simple view for session summary (no complex joins)
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    session_id,
    tech_stack,
    is_pro_user,
    MIN(created_at) as interview_date,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN question_type = 'mcq' THEN 1 END) as mcq_count,
    COUNT(CASE WHEN question_type IN ('short_answer', 'long_answer') THEN 1 END) as subjective_count
FROM user_responses
GROUP BY session_id, tech_stack, is_pro_user;

-- 4. Add helpful comments
COMMENT ON TABLE user_responses IS 'STEP 1: Stores all user responses (MCQ + Long/Short answers)';
COMMENT ON TABLE final_reports IS 'STEP 2: MCQ marks calculated first, then STEP 7: long_short_evaluation updated';
COMMENT ON TABLE response_evaluations IS 'STEP 6: Stores detailed AI evaluation results';
COMMENT ON TABLE mistral_queue IS 'STEP 5B: Queue for non-pro users awaiting AI evaluation';

COMMENT ON COLUMN final_reports.mcq_marks IS 'STEP 2: Calculated immediately after response submission';
COMMENT ON COLUMN final_reports.long_short_evaluation IS 'STEP 7: Updated after AI evaluation (Pro: immediate, Non-Pro: queued)';
COMMENT ON COLUMN response_evaluations.evaluation_data IS 'STEP 6: Detailed AI evaluation stored here first';
COMMENT ON COLUMN mistral_queue.status IS 'STEP 5B: pending -> processing -> done/error';