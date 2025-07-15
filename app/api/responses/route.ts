import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { parseMistralEvaluation } from '@/lib/evaluationUtils';

async function callMistralAPIWithRetry(longShortAnswers: any, techStack: any, resumeText: any, mcqResponses: any, mcqMarks: number, totalMcqs: number, mcqDetails: any[] = [], retryCount: number = 0): Promise<any> {
  const maxRetries = 3;
  
  try {
    return await callMistralAPI(longShortAnswers, techStack, resumeText, mcqResponses, mcqMarks, totalMcqs, mcqDetails);
  } catch (error: any) { // Explicitly type error as any
    console.error(`❌ Mistral API attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying Mistral API call (attempt ${retryCount + 2}/${maxRetries + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return callMistralAPIWithRetry(longShortAnswers, techStack, resumeText, mcqResponses, mcqMarks, totalMcqs, mcqDetails, retryCount + 1);
    }
    
    throw new Error(`Mistral API failed after ${maxRetries + 1} attempts: ${error.message}`);
  }
}

async function callMistralAPI(longShortAnswers: any, techStack: any, resumeText: any, mcqResponses: any, mcqMarks: number, totalMcqs: number, mcqDetails: any[] = []) {
  const mistralApiKey = process.env.MISTRAL_API_KEY;
  const mistralUrl = 'https://api.mistral.ai/v1/chat/completions';
  
  // Format questions with answers for long/short answers
  const questionsWithAnswers = longShortAnswers.map((resp: any, idx: any) => 
    `Question ${idx + 1} (${resp.questionType}):\nQ: ${resp.questionText}\nCandidate's Answer: "${resp.answer}"\nTime Spent: ${resp.timeSpent} seconds`
  ).join('\n\n');
  
  // Format MCQ details with correct answers and explanations
  const mcqAnalysis = mcqDetails.map((mcq: any, idx: any) => 
    `MCQ ${idx + 1}:\nQ: ${mcq.question}\nOptions: A) ${mcq.optionA} | B) ${mcq.optionB} | C) ${mcq.optionC} | D) ${mcq.optionD}\nCandidate's Answer: ${mcq.userAnswer}\nCorrect Answer: ${mcq.correctAnswer}\nResult: ${mcq.isCorrect ? 'CORRECT' : 'INCORRECT'}`
  ).join('\n\n');
  
  const mcqSummary = totalMcqs > 0 ? `MCQ Performance: ${mcqMarks}/${totalMcqs} (${Math.round((mcqMarks/totalMcqs)*100)}% correct)` : 'No MCQ questions';
  
  const evaluationPrompt = `You are a strict technical interviewer evaluating a ${techStack} developer's interview performance.

CANDIDATE RESPONSES FOR LONG/SHORT ANSWERS:
${questionsWithAnswers}

MCQ ANALYSIS:
${mcqAnalysis}

${mcqSummary}

EVALUATION INSTRUCTIONS:

FOR MCQs:
- Check each answer carefully
- Mark as Correct ✅ or Incorrect ❌
- If incorrect, explain why it's wrong and provide the correct answer with a one-line explanation

FOR WRITTEN (LONG/SHORT) ANSWERS:
- Evaluate for accuracy, depth, clarity, and completeness
- Provide specific feedback about what's right or missing
- Show a model correct answer for comparison

SCORING CRITERIA:
- MCQ Score: Percentage of correct answers
- Written Answer Score: 0-10 based on technical accuracy and completeness
- Technical Rating: 1-10 overall technical understanding

PROVIDE EVALUATION IN THIS EXACT JSON FORMAT:
{
  "overallScore": <0-100 number based on actual performance>,
  "mcqScore": ${totalMcqs > 0 ? Math.round((mcqMarks/totalMcqs)*100) : 0},
  "writtenAnswerScore": <0-10 score for short/long answers>,
  "longShortScore": <0-100 score for short/long answers (for backward compatibility)>,
  "technicalRating": <1-10 rating based on overall technical understanding>,
  "totalQuestions": ${longShortAnswers.length + totalMcqs},
  "mcqAnalysis": [
    {
      "questionNumber": 1,
      "question": "MCQ question text",
      "userAnswer": "User's selected option",
      "correctAnswer": "Correct option",
      "isCorrect": true/false,
      "status": "✅ Correct" or "❌ Incorrect",
      "explanation": "If incorrect: Why it's wrong and correct answer with one-line explanation"
    }
  ],
  "writtenAnswerAnalysis": [
    {
      "questionNumber": 1,
      "questionText": "The question text",
      "whatIsCorrect": "What the candidate got right (specific technical points)",
      "whatIsMissing": "What is missing or wrong in the answer (specific gaps)",
      "modelAnswer": "Complete model answer for comparison",
      "score": <0-10 individual score>,
      "feedback": "Specific feedback for improvement"
    }
  ],
  "summary": {
    "mcqScoreDisplay": "${totalMcqs > 0 ? `MCQ Score: ${Math.round((mcqMarks/totalMcqs)*100)}%` : 'No MCQ questions'}",
    "writtenScoreDisplay": "Written Answer Score: <writtenAnswerScore>/10",
    "technicalRatingDisplay": "Technical Rating: <technicalRating>/10"
  },
  "strengths": [<array of specific strengths demonstrated>],
  "weaknesses": [<array of specific areas needing improvement>],
  "recommendations": [<specific learning recommendations>],
  "passFailStatus": "<PASS/FAIL based on >= 60% overall score>"
}

BE STRICT: Evaluate based on actual technical knowledge demonstrated. Provide clear, actionable feedback.`;

  const response = await fetch(mistralUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mistralApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-large-latest', // Use larger model for better evaluation
      messages: [
        {
          role: 'system',
          content: 'You are a strict technical interviewer and evaluator. You provide honest, realistic assessments based on actual technical knowledge demonstrated. You do not give participation awards - scores must reflect actual competency. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent evaluation
      max_tokens: 3000
    })
  });
  
  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }
  
  const result = await response.json();
  const evaluationText = result.choices[0]?.message?.content;
  
  console.log('🔍 Raw evaluation response:', evaluationText);
  
  try {
    // Extract JSON from response
    const cleanedJson = extractJsonFromEvaluation(evaluationText);
    const parsedEvaluation = JSON.parse(cleanedJson);
    
    console.log('📊 Parsed evaluation:', parsedEvaluation);
    
    return {
      evaluation: parsedEvaluation,
      rawEvaluation: evaluationText,
      model: result.model,
      usage: result.usage
    };
  } catch (error: any) { // Explicitly type error as any
    console.error('❌ Failed to parse evaluation JSON:', error);
    console.error('❌ Raw response:', evaluationText);
    
    // Throw error to trigger retry mechanism
    throw new Error(`Evaluation parsing failed: ${error.message}`);
  }
}

function calculateMcqMarks(responses: any, correctAnswers: any, allQuestions: any = []) {
  let marks = 0;
  let totalMcq = 0;
  const mcqDetails: any[] = [];
  
  console.log('🔍 Calculating MCQ marks...');
  console.log('MCQ Responses:', responses.length);
  console.log('Correct Answers from DB:', correctAnswers?.length || 0);
  
  // Unified helper function to normalize MCQ answers to A, B, C, D
  const normalizeMcqAnswer = (answer: any) => {
    const answerStr = String(answer).trim();
    
    // Try to convert numeric strings (e.g., "1", "2") to option letters
    if (/^\d+$/.test(answerStr)) { // Check if string contains only digits
      const num = parseInt(answerStr);
      if (num >= 1 && num <= 4) {
        switch (num) {
          case 1: return 'A';
          case 2: return 'B';
          case 3: return 'C';
          case 4: return 'D';
        }
      }
    }
    
    // Handle "option_A", "option_B", etc.
    if (answerStr.toLowerCase().startsWith('option_')) {
      return answerStr.replace(/option_/i, '').toUpperCase();
    }
    
    // Handle single letters "A", "b", etc.
    if (answerStr.length === 1 && /[a-dA-D]/.test(answerStr)) {
      return answerStr.toUpperCase();
    }
    
    // Default: return the trimmed, uppercased string. This will handle '0' as '0',
    // and other unexpected strings as themselves (uppercased).
    return answerStr.toUpperCase();
  };

  for (const resp of responses) {
    if (resp.questionType === 'mcq') {
      totalMcq++;
      const correct = correctAnswers.find((q: any) => q.id === resp.questionId);
      const questionDetails = allQuestions.find((q: any) => q.id === resp.questionId);
      
      console.log(`Question ${resp.questionId}:`);
      console.log(`  User Answer Raw: "${resp.answer}" (Type: ${typeof resp.answer})`);
      console.log(`  Correct Answer Raw: "${correct?.correct_answer}" (Type: ${typeof correct?.correct_answer})`);
      
      let isCorrect = false;
      let userAnswerFormatted = 'Not provided';
      let correctAnswerFormatted = 'Not found';
      
      if (correct) {
        userAnswerFormatted = normalizeMcqAnswer(resp.answer);
        correctAnswerFormatted = normalizeMcqAnswer(correct.correct_answer);
        
        console.log(`  User Answer Normalized: "${userAnswerFormatted}"`);
        console.log(`  Correct Answer Normalized: "${correctAnswerFormatted}"`);
        
        // Compare normalized answers
        isCorrect = userAnswerFormatted === correctAnswerFormatted;
        
        if (isCorrect) {
          marks++;
          console.log(`  ✅ Correct!`);
        } else {
          console.log(`  ❌ Incorrect. Expected "${correctAnswerFormatted}", got "${userAnswerFormatted}"`);
        }
      } else {
        console.log(`  ⚠️ No correct answer found in database for question ID ${resp.questionId}`);
        userAnswerFormatted = normalizeMcqAnswer(resp.answer); // Still normalize for display
      }
      
      // Store detailed info for evaluation
      mcqDetails.push({
        questionNumber: totalMcq,
        question: resp.questionText,
        userAnswer: userAnswerFormatted,
        correctAnswer: correctAnswerFormatted,
        isCorrect,
        optionA: questionDetails?.option_a || '',
        optionB: questionDetails?.option_b || '',
        optionC: questionDetails?.option_c || '',
        optionD: questionDetails?.option_d || ''
      });
    }
  }
  
  console.log(`📊 MCQ Results: ${marks}/${totalMcq} correct`);
  return { marks, mcqDetails };
}

function extractJsonFromEvaluation(responseText: string): string {
  if (!responseText) {
    throw new Error('Empty evaluation response');
  }
  
  console.log('🔍 Extracting JSON from response...');
  
  // Remove any markdown code block formatting
  let cleanedText = responseText.trim();
  
  // Remove markdown JSON code blocks
  cleanedText = cleanedText.replace(/^```json\s*/i, '');
  cleanedText = cleanedText.replace(/^```\s*/i, '');
  cleanedText = cleanedText.replace(/\s*```\s*$/i, '');
  
  // Find JSON object start and end
  const jsonStart = cleanedText.indexOf('{');
  const jsonEnd = cleanedText.lastIndexOf('}') + 1;
  
  if (jsonStart === -1 || jsonEnd === 0) {
    console.error('❌ No JSON braces found in response');
    throw new Error('No valid JSON found in evaluation response');
  }
  
  cleanedText = cleanedText.substring(jsonStart, jsonEnd);
  
  // Try to fix common JSON issues
  cleanedText = cleanedText
    .replace(/,\s*}/g, '}') // Remove trailing commas
    .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double quotes
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/\t/g, '  '); // Replace tabs with spaces
  
  // Validate it's proper JSON
  try {
    JSON.parse(cleanedText);
    console.log('✅ JSON validation successful');
    return cleanedText;
  } catch (error) {
    console.error('❌ JSON validation failed:', error);
    console.error('❌ Problematic JSON:', cleanedText.substring(0, 500));
    throw new Error('Invalid JSON format in evaluation response');
  }
}



export async function POST(request: any) {
  console.log('🔍 API /responses POST called');
  try {
    let body;
    try {
      body = await request.json();
      console.log('✅ JSON parsed successfully');
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON request body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' }, 
        { status: 400 }
      );
    }
    
    const { 
      sessionId, 
      techStack, 
      responses, 
      resumeText, 
      isPro
    } = body;
    
    console.log('📊 Request data:', { sessionId, techStack, responsesCount: responses?.length, resumeTextLength: resumeText?.length, isPro });

    if (!sessionId || !responses || !Array.isArray(responses)) {
      console.error('❌ Missing required fields:', { sessionId: !!sessionId, responses: !!responses, isArray: Array.isArray(responses) });
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, responses' }, 
        { status: 400 }
      );
    }

    // Quick supabase connection test
    console.log('🗄️ Testing supabase connection...');
    try {
      const { data, error } = await supabase.from('technical_questions').select('count').limit(1);
      if (error) {
        console.error('❌ Supabase connection error:', error);
        return NextResponse.json(
          { error: 'Database connection failed', details: error.message }, 
          { status: 500 }
        );
      }
      console.log('✅ Supabase connection successful');
    } catch (supabaseError) {
      console.error('❌ Supabase connection exception:', supabaseError);
      return NextResponse.json(
        { error: 'Database connection failed', details: supabaseError }, 
        { status: 500 }
      );
    }

    // For Pro users, techStack might be derived from resume; for Non-Pro, it's selected
    const finalTechStack = techStack || 'General';

    // STEP 1: Store user_responses (all answers)
    const responseData = responses.map((response: any) => ({
      session_id: sessionId,
      tech_stack: finalTechStack,
      question_id: response.questionId,
      question_text: response.questionText,
      question_type: response.questionType,
      user_answer: response.answer,
      time_spent: response.timeSpent,
      is_pro_user: isPro,
      resume_text: resumeText || null,
      created_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase.from('user_responses').insert(responseData);
    if (insertError) {
      return NextResponse.json({ error: 'Failed to store responses', details: insertError }, { status: 500 });
    }

    // STEP 2: Evaluate MCQs → update final_reports.mcq_marks
    const mcqResponses = responses.filter((r: any) => r.questionType === 'mcq');
    let mcqMarks = 0;
    let mcqDetails: any[] = [];
    
    if (mcqResponses.length > 0) {
      // Fetch correct answers and question details for MCQs from DB
      const { data: questionsDb, error: questionsError } = await supabase
        .from('technical_questions')
        .select('id, correct_answer, question_text, option_a, option_b, option_c, option_d')
        .eq('tech_stack', finalTechStack)
        .eq('question_type', 'mcq');
      
      if (!questionsError && questionsDb) {
        const result = calculateMcqMarks(mcqResponses, questionsDb, questionsDb);
        mcqMarks = result.marks;
        mcqDetails = result.mcqDetails;
      }
    }

    // STEP 3: Create final_reports entry with MCQ marks
    const { error: reportError } = await supabase.from('final_reports').insert({
      session_id: sessionId,
      tech_stack: finalTechStack,
      mcq_marks: mcqMarks,
      long_short_evaluation: null,
      created_at: new Date().toISOString()
    });
    
    if (reportError) {
      return NextResponse.json({ error: 'Failed to create final report', details: reportError }, { status: 500 });
    }

    // STEP 4: Handle Long/Short Answer Evaluation
    const longShortAnswers = responses.filter((r: any) => r.questionType !== 'mcq');
    
    if (longShortAnswers.length > 0) {
      if (isPro) {
        // STEP 5A: Pro User → Send to Mistral API immediately
        try {
          const evaluationResult = await callMistralAPIWithRetry(longShortAnswers, finalTechStack, resumeText, mcqResponses, mcqMarks, mcqResponses.length, mcqDetails);
          
          // STEP 6A: Store in response_evaluations
          await supabase.from('response_evaluations').insert({
            session_id: sessionId,
            tech_stack: finalTechStack,
            evaluation_data: evaluationResult,
            created_at: new Date().toISOString()
          });
          
          // STEP 7A: Update final_reports.long_short_evaluation
          await supabase
            .from('final_reports')
            .update({ long_short_evaluation: evaluationResult })
            .eq('session_id', sessionId);
          
          return NextResponse.json({ 
            success: true, 
            message: '🎉 Interview evaluated successfully! Check your detailed results below.',
            mcq_marks: mcqMarks, 
            mcq_details: mcqDetails,
            evaluation: evaluationResult,
            isPro: true
          });
        } catch (err: any) {
          console.error('❌ Mistral API error after all retries:', err);
          
          return NextResponse.json({ 
            success: false, 
            error: 'AI evaluation service temporarily unavailable. Please try again.',
            details: err.message,
            mcq_marks: mcqMarks, 
            mcq_details: mcqDetails,
            isPro: true
          }, { status: 503 });
        }
      } else {
        // STEP 5B: Non-Pro User → Add to mistral_queue for long/short answers only
        if (longShortAnswers.length > 0) {
          await supabase.from('mistral_queue').insert({
            session_id: sessionId,
            tech_stack: finalTechStack,
            long_short_answers: longShortAnswers,
            mcq_details: mcqDetails,
            mcq_marks: mcqMarks,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        
        // Create immediate MCQ evaluation for non-pro users
        const nonProEvaluation = {
          overallScore: mcqResponses.length > 0 ? Math.round((mcqMarks/mcqResponses.length)*100) : 0,
          mcqScore: mcqResponses.length > 0 ? Math.round((mcqMarks/mcqResponses.length)*100) : 0,
          writtenAnswerScore: 0, // Will be updated when queue is processed
          longShortScore: 0, // Will be updated when queue is processed
          technicalRating: mcqResponses.length > 0 ? Math.max(1, Math.min(10, Math.round((mcqMarks/mcqResponses.length)*10))) : 1,
          totalQuestions: mcqResponses.length + longShortAnswers.length,
          mcqAnalysis: mcqDetails.map((mcq: any) => ({
            questionNumber: mcq.questionNumber,
            question: mcq.question,
            userAnswer: mcq.userAnswer,
            correctAnswer: mcq.correctAnswer,
            isCorrect: mcq.isCorrect,
            status: mcq.isCorrect ? '✅ Correct' : '❌ Incorrect',
            explanation: mcq.isCorrect ? 'Correct answer selected' : `Incorrect. The correct answer is ${mcq.correctAnswer}.`
          })),
          writtenAnswerAnalysis: [], // Will be populated when queue is processed
          summary: {
            mcqScoreDisplay: mcqResponses.length > 0 ? `MCQ Score: ${Math.round((mcqMarks/mcqResponses.length)*100)}%` : 'No MCQ questions',
            writtenScoreDisplay: longShortAnswers.length > 0 ? 'Written Answer Score: Processing...' : 'No written questions',
            technicalRatingDisplay: `Technical Rating: ${mcqResponses.length > 0 ? Math.max(1, Math.min(10, Math.round((mcqMarks/mcqResponses.length)*10))) : 1}/10`
          },
          strengths: mcqMarks > 0 ? [`Answered ${mcqMarks} MCQ questions correctly`] : [],
          weaknesses: mcqMarks < mcqResponses.length ? ['Review concepts for incorrect MCQ answers'] : [],
          recommendations: longShortAnswers.length > 0 ? ['Written answer evaluation in progress'] : ['Practice more technical questions'],
          passFailStatus: mcqResponses.length > 0 && (mcqMarks/mcqResponses.length) >= 0.6 ? 'PASS' : 'FAIL'
        };
        
        // Store MCQ evaluation for non-pro users
        await supabase.from('response_evaluations').insert({
          session_id: sessionId,
          tech_stack: finalTechStack,
          evaluation_data: { evaluation: nonProEvaluation },
          created_at: new Date().toISOString()
        });
        
        // Update final_reports with MCQ evaluation (written answers will be updated by queue processor)
        await supabase
          .from('final_reports')
          .update({ 
            long_short_evaluation: longShortAnswers.length > 0 ? 
              { evaluation: nonProEvaluation, status: 'mcq_complete_processing_written' } : 
              { evaluation: nonProEvaluation, status: 'complete' }
          })
          .eq('session_id', sessionId);
        
        return NextResponse.json({ 
          success: true, 
          message: mcqResponses.length > 0 ? 
            `🎉 Your test has been submitted successfully!\n\n📊 MCQ Results: ${mcqMarks}/${mcqResponses.length} correct (${Math.round((mcqMarks/mcqResponses.length)*100)}%)\n\n${longShortAnswers.length > 0 ? '⏳ Your written answer evaluation is being processed and will be available in your dashboard shortly.' : '✅ Evaluation complete!'}` :
            '🎉 Your test has been submitted successfully!\n\n⏳ Your evaluation is being processed and will be available in your dashboard shortly.',
          mcq_marks: mcqMarks,
          mcq_details: mcqDetails,
          evaluation: { evaluation: nonProEvaluation },
          queued: longShortAnswers.length > 0,
          isPro: false,
          acknowledgment: longShortAnswers.length > 0 ? 'Your written answers are in the evaluation queue. Results will be updated in your dashboard when ready.' : 'MCQ evaluation complete!'
        });
      }
    }
    
    // No long/short answers - only MCQs
    if (mcqResponses.length > 0) {
      // For MCQ-only sessions, provide complete evaluation
      const mcqOnlyEvaluation = {
        overallScore: Math.round((mcqMarks/mcqResponses.length)*100),
        mcqScore: Math.round((mcqMarks/mcqResponses.length)*100),
        writtenAnswerScore: 0,
        longShortScore: 0,
        technicalRating: Math.max(1, Math.min(10, Math.round((mcqMarks/mcqResponses.length)*10))),
        totalQuestions: mcqResponses.length,
        mcqAnalysis: mcqDetails.map((mcq: any) => ({
          questionNumber: mcq.questionNumber,
          question: mcq.question,
          userAnswer: mcq.userAnswer,
          correctAnswer: mcq.correctAnswer,
          isCorrect: mcq.isCorrect,
          status: mcq.isCorrect ? '✅ Correct' : '❌ Incorrect',
          explanation: mcq.isCorrect ? 'Correct answer selected' : `Incorrect. The correct answer is ${mcq.correctAnswer}.`
        })),
        writtenAnswerAnalysis: [],
        summary: {
          mcqScoreDisplay: `MCQ Score: ${Math.round((mcqMarks/mcqResponses.length)*100)}%`,
          writtenScoreDisplay: 'No written questions',
          technicalRatingDisplay: `Technical Rating: ${Math.max(1, Math.min(10, Math.round((mcqMarks/mcqResponses.length)*10)))}/10`
        },
        strengths: mcqMarks > 0 ? [`Answered ${mcqMarks} MCQ questions correctly`] : [],
        weaknesses: mcqMarks < mcqResponses.length ? ['Review concepts for incorrect MCQ answers'] : [],
        recommendations: ['Practice more technical questions'],
        passFailStatus: (mcqMarks/mcqResponses.length) >= 0.6 ? 'PASS' : 'FAIL'
      };
      
      // Store evaluation
      await supabase.from('response_evaluations').insert({
        session_id: sessionId,
        tech_stack: finalTechStack,
        evaluation_data: { evaluation: mcqOnlyEvaluation },
        created_at: new Date().toISOString()
      });
      
      // Update final_reports
      await supabase
        .from('final_reports')
        .update({ long_short_evaluation: { evaluation: mcqOnlyEvaluation, status: 'complete' } })
        .eq('session_id', sessionId);
      
      return NextResponse.json({ 
        success: true, 
        message: `🎉 MCQ evaluation complete!\n\n📊 Results: ${mcqMarks}/${mcqResponses.length} correct (${Math.round((mcqMarks/mcqResponses.length)*100)}%)`,
        mcq_marks: mcqMarks,
        mcq_details: mcqDetails,
        evaluation: { evaluation: mcqOnlyEvaluation },
        isPro: isPro
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'No questions to evaluate',
      mcq_marks: 0,
      isPro: isPro
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    );
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
