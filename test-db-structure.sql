-- Test Database Structure
-- Run this to verify your tables are set up correctly

-- 1. Check table structure
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name IN ('technical_questions', 'user_responses', 'final_reports', 'response_evaluations', 'mistral_queue', 'resumes')
ORDER BY table_name, ordinal_position;

-- 2. Check indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes 
WHERE tablename IN ('user_responses', 'final_reports', 'response_evaluations', 'mistral_queue')
ORDER BY tablename, indexname;

-- 3. Check if views exist
SELECT viewname FROM pg_views WHERE viewname = 'session_summary';

-- 4. Sample data check
SELECT 'technical_questions' as table_name, COUNT(*) as row_count FROM technical_questions
UNION ALL
SELECT 'user_responses', COUNT(*) FROM user_responses  
UNION ALL
SELECT 'final_reports', COUNT(*) FROM final_reports
UNION ALL
SELECT 'response_evaluations', COUNT(*) FROM response_evaluations
UNION ALL
SELECT 'mistral_queue', COUNT(*) FROM mistral_queue;