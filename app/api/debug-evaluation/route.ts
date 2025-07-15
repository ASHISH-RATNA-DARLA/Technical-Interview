import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Get final report
    const { data: finalReport, error: reportError } = await supabase
      .from('final_reports')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (reportError) {
      return NextResponse.json(
        { error: 'Failed to fetch final report', details: reportError.message },
        { status: 500 }
      );
    }

    // Get evaluation data
    const { data: evaluation, error: evalError } = await supabase
      .from('response_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (evalError) {
      console.log('No evaluation found (might be in queue)');
    }

    // Get user responses
    const { data: userResponses, error: responsesError } = await supabase
      .from('user_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (responsesError) {
      return NextResponse.json(
        { error: 'Failed to fetch user responses', details: responsesError.message },
        { status: 500 }
      );
    }

    // Get queue status
    const { data: queueStatus, error: queueError } = await supabase
      .from('mistral_queue')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (queueError) {
      console.log('No queue entry found');
    }

    return NextResponse.json({
      success: true,
      sessionId,
      finalReport,
      evaluation,
      userResponses,
      queueStatus,
      debugInfo: {
        hasFinalReport: !!finalReport,
        hasEvaluation: !!evaluation,
        hasUserResponses: !!userResponses && userResponses.length > 0,
        hasQueueEntry: !!queueStatus,
        mcqMarks: finalReport?.mcq_marks || 0,
        evaluationStructure: evaluation?.evaluation_data ? Object.keys(evaluation.evaluation_data) : [],
        longShortEvaluationStructure: finalReport?.long_short_evaluation ? Object.keys(finalReport.long_short_evaluation) : []
      }
    });

  } catch (error: any) {
    console.error('Debug evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint to test evaluation logic
export async function POST(request: Request) {
  try {
    const { sessionId, testMode = false } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Get user responses for this session
    const { data: userResponses, error: responsesError } = await supabase
      .from('user_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (responsesError || !userResponses) {
      return NextResponse.json(
        { error: 'Failed to fetch user responses', details: responsesError?.message },
        { status: 500 }
      );
    }

    // Separate MCQ and written answers
    const mcqResponses = userResponses.filter(r => r.question_type === 'mcq');
    const longShortAnswers = userResponses.filter(r => r.question_type !== 'mcq');

    // Get MCQ correct answers
    const techStack = userResponses[0]?.tech_stack || 'General';
    const { data: questionsDb, error: questionsError } = await supabase
      .from('technical_questions')
      .select('id, correct_answer, question_text, option_a, option_b, option_c, option_d')
      .eq('tech_stack', techStack)
      .eq('question_type', 'mcq');

    let mcqMarks = 0;
    let mcqDetails: any[] = [];

    if (questionsDb && mcqResponses.length > 0) {
      // Test MCQ calculation
      let totalMcq = 0;
      
      for (const resp of mcqResponses) {
        totalMcq++;
        const correct = questionsDb.find((q: any) => q.id === resp.question_id);
        const questionDetails = questionsDb.find((q: any) => q.id === resp.question_id);
        
        let isCorrect = false;
        
        if (correct) {
          const userAnswer = String(resp.user_answer).trim().toLowerCase();
          const correctAnswer = String(correct.correct_answer).trim().toLowerCase();
          
          isCorrect = userAnswer === correctAnswer || 
                     userAnswer === correctAnswer.replace('option_', '') ||
                     (userAnswer.startsWith('option_') && userAnswer === `option_${correctAnswer}`) ||
                     (correctAnswer.startsWith('option_') && `option_${userAnswer}` === correctAnswer);
          
          if (isCorrect) {
            mcqMarks++;
          }
        }
        
        mcqDetails.push({
          questionNumber: totalMcq,
          question: resp.question_text,
          userAnswer: resp.user_answer,
          correctAnswer: correct?.correct_answer || 'Not found',
          isCorrect,
          optionA: questionDetails?.option_a || '',
          optionB: questionDetails?.option_b || '',
          optionC: questionDetails?.option_c || '',
          optionD: questionDetails?.option_d || ''
        });
      }
    }

    // Create test evaluation
    const testEvaluation = {
      overallScore: 75,
      mcqScore: mcqResponses.length > 0 ? Math.round((mcqMarks/mcqResponses.length)*100) : 0,
      writtenAnswerScore: 7,
      longShortScore: 70,
      technicalRating: 7,
      totalQuestions: longShortAnswers.length + mcqResponses.length,
      mcqAnalysis: mcqDetails,
      writtenAnswerAnalysis: longShortAnswers.map((ans: any, idx: number) => ({
        questionNumber: idx + 1,
        questionText: ans.question_text,
        whatIsCorrect: ans.user_answer ? "Answer provided with some understanding" : "No answer provided",
        whatIsMissing: ans.user_answer ? "More technical depth needed" : "Complete answer required",
        modelAnswer: "This is a sample model answer for testing purposes",
        score: ans.user_answer ? 6 : 0,
        feedback: ans.user_answer ? "Good attempt, but needs more technical detail" : "No answer provided"
      })),
      strengths: ["Completed the interview", "Showed effort in responses"],
      weaknesses: ["Need more technical depth", "Review fundamental concepts"],
      recommendations: ["Study core concepts", "Practice technical explanations"],
      nextSteps: ["Continue learning", "Practice more"],
      passFailStatus: "PASS"
    };

    if (testMode) {
      return NextResponse.json({
        success: true,
        testEvaluation,
        mcqDetails,
        mcqMarks,
        totalMcqs: mcqResponses.length,
        longShortCount: longShortAnswers.length,
        userResponses: userResponses.length
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      mcqMarks,
      mcqDetails,
      longShortAnswers: longShortAnswers.length,
      mcqResponses: mcqResponses.length,
      totalResponses: userResponses.length,
      techStack
    });

  } catch (error: any) {
    console.error('Debug evaluation POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}