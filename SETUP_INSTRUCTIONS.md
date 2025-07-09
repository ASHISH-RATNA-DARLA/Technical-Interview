# Technical Interview Simulator - Setup Instructions

## Database Setup

1. **Run the database migration** to create the required tables:
   ```sql
   -- Execute the contents of database-migration.sql in your Supabase SQL editor
   ```

2. **Tables created:**
   - `user_responses` - Stores individual user responses
   - `response_evaluations` - Stores AI evaluation results
   - `interview_sessions` - View for aggregated session data

## Environment Variables

Create a `.env.local` file in your project root with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Mistral AI Configuration (for Pro users)
MISTRAL_API_KEY=your_mistral_api_key_here
```

## Features Added

### 1. Response Storage
- All user responses (MCQ, short, and long answers) are now stored in the database
- Each response includes question details, user answer, time spent, and session info
- Pro users get additional resume text storage

### 2. AI Evaluation with Mistral
- Pro users automatically get their responses evaluated by Mistral LLM
- Evaluation includes:
  - Overall score (0-100)
  - Technical knowledge assessment
  - Communication skills
  - Problem-solving approach
  - Detailed feedback and recommendations

### 3. Enhanced Results Display
- Shows AI-powered evaluation results for Pro users
- Displays detailed feedback and recommendations
- Maintains fallback to mock data for free users

## API Endpoints

### POST /api/responses
Stores user responses and optionally evaluates them with Mistral AI.

**Request Body:**
```json
{
  "sessionId": "string",
  "techStack": "string", 
  "responses": [
    {
      "questionId": 1,
      "questionText": "string",
      "questionType": "mcq|short|long",
      "answer": "string",
      "timeSpent": 60
    }
  ],
  "resumeText": "string|null",
  "isPro": boolean,
  "evaluateWithMistral": boolean
}
```

### GET /api/responses?sessionId=string
Retrieves stored responses for a specific session.

## Database Schema

### user_responses table
- `id` - Primary key
- `session_id` - Unique session identifier
- `tech_stack` - Technology stack being tested
- `question_id` - Question ID from technical_questions table
- `question_text` - Full question text
- `question_type` - Type of question (mcq, short, long)
- `user_answer` - User's response
- `time_spent` - Time spent on question in seconds
- `is_pro_user` - Whether user has Pro access
- `resume_text` - Resume text (for Pro users)
- `created_at` - Timestamp

### response_evaluations table
- `id` - Primary key
- `session_id` - Links to user_responses session
- `tech_stack` - Technology stack
- `evaluation_data` - JSONB containing Mistral evaluation results
- `created_at` - Timestamp

## Usage

1. **Free Users:**
   - Responses are stored but not evaluated with AI
   - See mock feedback results

2. **Pro Users:**
   - Responses are stored and evaluated with Mistral AI
   - See AI-powered detailed feedback
   - Resume analysis included in evaluation

## Security Notes

- Mistral API key is server-side only
- User responses are stored securely in Supabase
- Session IDs are generated client-side for privacy 