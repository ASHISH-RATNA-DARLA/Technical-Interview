import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET /api/flow-status?sessionId=xxx
// Returns the current status of the interview flow for a session
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    // Get flow status using our new view
    const { data: flowStatus, error: flowError } = await supabase
      .from('interview_flow_status')
      .select('*')
      .eq('session_id', sessionId)
      .limit(1)
      .single();

    if (flowError) {
      return NextResponse.json({ error: 'Flow status not found' }, { status: 404 });
    }

    // Get detailed evaluation if available
    let evaluationDetails = null;
    if (flowStatus.evaluation_status === 'completed') {
      const { data: evaluation } = await supabase
        .from('response_evaluations')
        .select('evaluation_data')
        .eq('session_id', sessionId)
        .single();
      
      evaluationDetails = evaluation?.evaluation_data || null;
    }

    return NextResponse.json({
      sessionId: sessionId,
      techStack: flowStatus.tech_stack,
      isPro: flowStatus.is_pro_user,
      interviewDate: flowStatus.interview_date,
      totalQuestions: flowStatus.total_questions,
      mcqCount: flowStatus.mcq_count,
      subjectiveCount: flowStatus.subjective_count,
      mcqMarks: flowStatus.mcq_marks,
      evaluationStatus: flowStatus.evaluation_status,
      evaluationCompletedAt: flowStatus.evaluation_completed_at,
      evaluationDetails: evaluationDetails,
      flowSteps: {
        step1_responses_stored: flowStatus.total_questions > 0,
        step2_mcq_evaluated: flowStatus.mcq_marks !== null,
        step3_queued_or_processing: ['queued', 'processing', 'completed'].includes(flowStatus.evaluation_status),
        step4_evaluation_completed: flowStatus.evaluation_status === 'completed'
      }
    });
  } catch (error: any) {
    console.error('Error fetching flow status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/flow-status - Force reprocess a session (for debugging)
export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, action } = body;

  if (!sessionId || !action) {
    return NextResponse.json({ error: 'Session ID and action are required' }, { status: 400 });
  }

  try {
    if (action === 'reprocess_evaluation') {
      // Add back to queue for reprocessing
      const { data: userResponse } = await supabase
        .from('user_responses')
        .select('tech_stack, is_pro_user')
        .eq('session_id', sessionId)
        .limit(1)
        .single();

      if (!userResponse) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (!userResponse.is_pro_user) {
        // Add to queue for non-pro users
        const { data: longShortAnswers } = await supabase
          .from('user_responses')
          .select('question_id, question_text, question_type, user_answer, time_spent')
          .eq('session_id', sessionId)
          .in('question_type', ['short_answer', 'long_answer']);

        if (longShortAnswers && longShortAnswers.length > 0) {
          await supabase.from('mistral_queue').insert({
            session_id: sessionId,
            tech_stack: userResponse.tech_stack,
            long_short_answers: longShortAnswers,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Session queued for reprocessing' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error reprocessing session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}