import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET /api/simple-flow-status?sessionId=xxx
// Simple version without complex views - uses direct queries
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    // Get basic session info
    const { data: responses, error: responsesError } = await supabase
      .from('user_responses')
      .select('tech_stack, is_pro_user, created_at, question_type')
      .eq('session_id', sessionId);

    if (responsesError || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Calculate basic stats
    const sessionInfo = responses[0];
    const totalQuestions = responses.length;
    const mcqCount = responses.filter(r => r.question_type === 'mcq').length;
    const subjectiveCount = responses.filter(r => r.question_type === 'short_answer' || r.question_type === 'long_answer').length;

    // Get MCQ marks from final_reports
    const { data: finalReport } = await supabase
      .from('final_reports')
      .select('mcq_marks, long_short_evaluation')
      .eq('session_id', sessionId)
      .single();

    // Get evaluation status
    const { data: evaluation } = await supabase
      .from('response_evaluations')
      .select('evaluation_data, created_at')
      .eq('session_id', sessionId)
      .single();

    // Get queue status for non-pro users
    const { data: queueStatus } = await supabase
      .from('mistral_queue')
      .select('status, created_at, updated_at')
      .eq('session_id', sessionId)
      .single();

    // Determine evaluation status
    let evaluationStatus = 'pending';
    let evaluationCompletedAt = null;

    if (evaluation) {
      evaluationStatus = 'completed';
      evaluationCompletedAt = evaluation.created_at;
    } else if (queueStatus) {
      evaluationStatus = queueStatus.status;
    }

    return NextResponse.json({
      sessionId: sessionId,
      techStack: sessionInfo.tech_stack,
      isPro: sessionInfo.is_pro_user,
      interviewDate: sessionInfo.created_at,
      totalQuestions: totalQuestions,
      mcqCount: mcqCount,
      subjectiveCount: subjectiveCount,
      mcqMarks: finalReport?.mcq_marks || 0,
      evaluationStatus: evaluationStatus,
      evaluationCompletedAt: evaluationCompletedAt,
      evaluationDetails: evaluation?.evaluation_data || null,
      queueInfo: queueStatus ? {
        status: queueStatus.status,
        createdAt: queueStatus.created_at,
        updatedAt: queueStatus.updated_at
      } : null,
      flowSteps: {
        step1_responses_stored: totalQuestions > 0,
        step2_mcq_evaluated: finalReport?.mcq_marks !== null,
        step3_queued_or_processing: ['queued', 'processing', 'completed'].includes(evaluationStatus),
        step4_evaluation_completed: evaluationStatus === 'completed'
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