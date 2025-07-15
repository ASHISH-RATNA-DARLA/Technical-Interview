-- Fix Database Schema to Match Expected Flow
-- Execute this SQL to ensure your schema perfectly matches the expected flow

-- 1. Ensure final_reports table allows NULL for long_short_evaluation initially
ALTER TABLE final_reports ALTER COLUMN long_short_evaluation DROP NOT NULL;

-- 2. Add indexes for better performance following the expected flow
CREATE INDEX IF NOT EXISTS idx_user_responses_session_tech ON user_responses(session_id, tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_responses_question_type ON user_responses(question_type);
CREATE INDEX IF NOT EXISTS idx_user_responses_is_pro ON user_responses(is_pro_user);

CREATE INDEX IF NOT EXISTS idx_final_reports_session_tech ON final_reports(session_id, tech_stack);
CREATE INDEX IF NOT EXISTS idx_final_reports_mcq_marks ON final_reports(mcq_marks);

CREATE INDEX IF NOT EXISTS idx_response_evaluations_session_tech ON response_evaluations(session_id, tech_stack);

CREATE INDEX IF NOT EXISTS idx_mistral_queue_status ON mistral_queue(status);
CREATE INDEX IF NOT EXISTS idx_mistral_queue_created_at ON mistral_queue(created_at);

-- 3. Add helpful views for the expected flow
CREATE OR REPLACE VIEW interview_flow_status AS
WITH session_stats AS (
    SELECT 
        session_id,
        tech_stack,
        is_pro_user,
        MIN(created_at) as interview_date,
        COUNT(*) as total_questions,
        COUNT(CASE WHEN question_type = 'mcq' THEN 1 END) as mcq_count,
        COUNT(CASE WHEN question_type IN ('short_answer', 'long_answer') THEN 1 END) as subjective_count
    FROM user_responses
    GROUP BY session_id, tech_stack, is_pro_user
),
evaluation_status AS (
    SELECT 
        ss.session_id,
        ss.tech_stack,
        ss.is_pro_user,
        ss.interview_date,
        ss.total_questions,
        ss.mcq_count,
        ss.subjective_count,
        fr.mcq_marks,
        CASE 
            WHEN fr.long_short_evaluation IS NOT NULL THEN 'completed'
            WHEN mq.status = 'pending' THEN 'queued'
            WHEN mq.status = 'processing' THEN 'processing'
            WHEN mq.status = 'error' THEN 'failed'
            ELSE 'pending'
        END as evaluation_status,
        re.created_at as evaluation_completed_at
    FROM session_stats ss
    LEFT JOIN final_reports fr ON ss.session_id = fr.session_id
    LEFT JOIN mistral_queue mq ON ss.session_id = mq.session_id
    LEFT JOIN response_evaluations re ON ss.session_id = re.session_id
)
SELECT * FROM evaluation_status;

-- 4. Add a trigger to ensure data consistency
CREATE OR REPLACE FUNCTION validate_final_report_flow()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure mcq_marks is calculated correctly
    IF NEW.mcq_marks IS NULL THEN
        NEW.mcq_marks := 0;
    END IF;
    
    -- Ensure long_short_evaluation starts as NULL
    IF TG_OP = 'INSERT' AND NEW.long_short_evaluation IS NULL THEN
        NEW.long_short_evaluation := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_final_report_flow
    BEFORE INSERT OR UPDATE ON final_reports
    FOR EACH ROW
    EXECUTE FUNCTION validate_final_report_flow();

-- 5. Add comments to document the expected flow
COMMENT ON TABLE user_responses IS 'STEP 1: Stores all user responses (MCQ + Long/Short answers)';
COMMENT ON TABLE final_reports IS 'STEP 2: MCQ marks calculated first, then STEP 7: long_short_evaluation updated';
COMMENT ON TABLE response_evaluations IS 'STEP 6: Stores detailed AI evaluation results';
COMMENT ON TABLE mistral_queue IS 'STEP 5B: Queue for non-pro users awaiting AI evaluation';

COMMENT ON COLUMN final_reports.mcq_marks IS 'STEP 2: Calculated immediately after response submission';
COMMENT ON COLUMN final_reports.long_short_evaluation IS 'STEP 7: Updated after AI evaluation (Pro: immediate, Non-Pro: queued)';
COMMENT ON COLUMN response_evaluations.evaluation_data IS 'STEP 6: Detailed AI evaluation stored here first';
COMMENT ON COLUMN mistral_queue.status IS 'STEP 5B: pending -> processing -> done/error';