import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { parseMistralEvaluation } from '@/lib/evaluationUtils';

async function callMistralAPI(longShortAnswers: any, techStack: any, resumeText: any) {
  const mistralApiKey = process.env.MISTRAL_API_KEY;
  const mistralUrl = 'https://api.mistral.ai/v1/chat/completions';
  const prompt = longShortAnswers.map((resp: any, idx: any) => `Question ${idx + 1} (${resp.questionType}):\nQuestion: ${resp.questionText}\nAnswer: ${resp.answer}\nTime Spent: ${resp.timeSpent} seconds`).join('\n');
  const evaluationPrompt = `Please evaluate this technical interview for a ${techStack} position.\n${resumeText ? `Resume Context: ${resumeText.substring(0, 1000)}...` : 'No resume provided.'}\nCandidate Responses:\n${prompt}\nPlease provide a comprehensive evaluation including: 1. Overall score (0-100) 2. Technical knowledge assessment 3. Communication skills 4. Problem-solving approach 5. Areas of strength 6. Areas for improvement 7. Suggestions for next steps.`;
  const response = await fetch(mistralUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mistralApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'system',
          content: 'You are an expert technical interviewer and evaluator. Analyze the candidate\'s responses and provide detailed feedback.'
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });
  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }
  const result = await response.json();
  const evaluationText = result.choices[0]?.message?.content;
  const parsedEvaluation = parseMistralEvaluation(evaluationText);
  return {
    evaluation: parsedEvaluation,
    rawEvaluation: evaluationText,
    model: result.model,
    usage: result.usage
  };
}

function calculateMcqMarks(responses: any, correctAnswers: any) {
  let marks = 0;
  for (const resp of responses) {
    if (resp.questionType === 'mcq') {
      const correct = correctAnswers.find((q: any) => q.id === resp.questionId);
      if (correct && String(resp.answer).trim() === String(correct.correctAnswer).trim()) {
        marks++;
      }
    }
  }
  return marks;
}

export async function POST(request: any) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      techStack, 
      responses, 
      resumeText, 
      isPro
    } = body;

    if (!sessionId || !techStack || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, techStack, responses' }, 
        { status: 400 }
      );
    }

    // Fetch correct answers for MCQs from DB
    const { data: questionsDb, error: questionsError } = await supabase
      .from('technical_questions')
      .select('id, correct_answer, question_type')
      .eq('tech_stack', techStack);
    if (questionsError) {
      return NextResponse.json({ error: 'Failed to fetch questions for MCQ validation', details: questionsError }, { status: 500 });
    }
    const correctAnswers = (questionsDb || []).filter((q: any) => q.question_type === 'mcq');

    // Calculate MCQ marks
    const mcqMarks = calculateMcqMarks(responses, correctAnswers);
    // Prepare long/short answers
    const longShortAnswers = responses.filter((r: any) => r.questionType !== 'mcq');

    // Store user_responses (all answers)
    const responseData = responses.map((response: any) => ({
      session_id: sessionId,
      tech_stack: techStack,
      question_id: response.questionId,
      question_text: response.questionText,
      user_answer: response.answer,
      time_spent: response.timeSpent,
      is_pro_user: isPro,
      resume_text: resumeText || null,
      created_at: new Date().toISOString()
    }));
    await supabase.from('user_responses').insert(responseData);

    // Insert partial final report
    await supabase.from('final_reports').insert({
      session_id: sessionId,
      tech_stack: techStack,
      mcq_marks: mcqMarks,
      long_short_evaluation: null,
      created_at: new Date().toISOString()
    });

    if (longShortAnswers.length > 0) {
      if (isPro) {
        // Pro: Call Mistral API immediately
        try {
          const evaluation = await callMistralAPI(longShortAnswers, techStack, resumeText);
          await supabase
            .from('final_reports')
            .update({ long_short_evaluation: evaluation })
            .eq('session_id', sessionId);
          return NextResponse.json({ success: true, mcq_marks: mcqMarks, evaluation });
        } catch (err: any) {
          return NextResponse.json({ success: true, mcq_marks: mcqMarks, evaluation: null, mistralError: err.message });
        }
      } else {
        // Non-Pro: Add to queue for later processing
        await supabase.from('mistral_queue').insert({
          session_id: sessionId,
          tech_stack: techStack,
          long_short_answers: longShortAnswers,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return NextResponse.json({ success: true, mcq_marks: mcqMarks, queued: true });
      }
    }
    // No long/short answers
    return NextResponse.json({ success: true, mcq_marks: mcqMarks });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    );
  }
}

// --- New: Resume upload endpoint for Pro users ---
export async function POST_resume(request: any) {
  try {
    const body = await request.json();
    const { fileName, extractedText, sessionId, userId } = body;
    if (!fileName || !extractedText) {
      return NextResponse.json({ error: 'Missing required fields: fileName, extractedText' }, { status: 400 });
    }
    const { error } = await supabase.from('resumes').insert({
      file_name: fileName,
      extracted_text: extractedText,
      session_id: sessionId || null,
      user_id: userId || null,
      uploaded_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function GET(request: any) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' }, 
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('user_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 