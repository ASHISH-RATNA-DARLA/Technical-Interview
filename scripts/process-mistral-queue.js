// scripts/process-mistral-queue.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

async function callMistralAPI(longShortAnswers, techStack) {
  const questionsWithAnswers = longShortAnswers.map((resp, idx) => 
    `Question ${idx + 1} (${resp.questionType}):\nQ: ${resp.questionText}\nCandidate's Answer: "${resp.answer}"\nTime Spent: ${resp.timeSpent} seconds`
  ).join('\n\n');
  
  const evaluationPrompt = `You are a strict technical interviewer evaluating a ${techStack} developer's interview performance. 

CANDIDATE RESPONSES:
${questionsWithAnswers}

EVALUATION REQUIREMENTS:
1. Be STRICT and REALISTIC in your assessment
2. Evaluate technical accuracy, depth, and completeness of answers
3. Consider if answers demonstrate practical knowledge vs just theoretical understanding
4. Score based on actual answer quality, not just length or effort

PROVIDE EVALUATION IN THIS EXACT JSON FORMAT:
{
  "overallScore": <0-100 number based on actual performance>,
  "longShortScore": <0-100 score for short/long answers>,
  "totalQuestions": ${longShortAnswers.length},
  "strengths": [<array of specific strengths demonstrated>],
  "weaknesses": [<array of specific areas needing improvement>],
  "technicalAccuracy": <1-10 rating>,
  "practicalKnowledge": <1-10 rating>,
  "communicationClarity": <1-10 rating>,
  "detailedFeedback": {
    "questionAnalysis": [<array of analysis for each question>],
    "recommendations": [<specific learning recommendations>],
    "nextSteps": [<career/skill development suggestions>]
  },
  "passFailStatus": "<PASS/FAIL based on >= 60% overall score>"
}

BE STRICT: Empty, wrong, or nonsensical answers should receive low scores. Only reward actual technical knowledge.`;

  const response = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'system',
          content: 'You are a strict technical interviewer and evaluator. You provide honest, realistic assessments based on actual technical knowledge demonstrated. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })
  });
  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }
  const result = await response.json();
  
  try {
    const evaluationText = result.choices[0]?.message?.content;
    // Extract JSON from response (handle markdown)
    const cleanedJson = evaluationText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const jsonStart = cleanedJson.indexOf('{');
    const jsonEnd = cleanedJson.lastIndexOf('}') + 1;
    const jsonContent = cleanedJson.substring(jsonStart, jsonEnd);
    
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('Failed to parse evaluation JSON:', error);
    // Return fallback evaluation
    return {
      overallScore: 50,
      longShortScore: 50,
      totalQuestions: longShortAnswers.length,
      strengths: ["Attempted all questions"],
      weaknesses: ["Answers need more technical detail"],
      technicalAccuracy: 3,
      practicalKnowledge: 3,
      communicationClarity: 4,
      detailedFeedback: {
        questionAnalysis: longShortAnswers.map((_, idx) => `Question ${idx + 1}: Answer provided but needs technical review`),
        recommendations: ["Study fundamental concepts", "Practice technical explanations"],
        nextSteps: ["Review technology documentation", "Practice coding examples"]
      },
      passFailStatus: "FAIL"
    };
  }
}

async function processQueue() {
  const { data: jobs, error } = await supabase
    .from('mistral_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(5);
  if (error) {
    console.error('Error fetching queue:', error);
    return;
  }
  for (const job of jobs) {
    try {
      // Update status to processing
      await supabase.from('mistral_queue').update({ 
        status: 'processing', 
        updated_at: new Date().toISOString() 
      }).eq('id', job.id);
      
      // Call Mistral API
      const evaluationText = await callMistralAPI(job.long_short_answers, job.tech_stack);
      
      // Parse and structure the evaluation
      const evaluationData = {
        evaluation: evaluationText,
        rawEvaluation: evaluationText,
        processed_at: new Date().toISOString(),
        model: 'mistral-large-latest'
      };
      
      // STEP 6B: Store in response_evaluations (following the expected flow)
      await supabase.from('response_evaluations').insert({
        session_id: job.session_id,
        tech_stack: job.tech_stack,
        evaluation_data: evaluationData,
        created_at: new Date().toISOString()
      });
      
      // STEP 7B: Update final_reports.long_short_evaluation
      await supabase
        .from('final_reports')
        .update({ long_short_evaluation: evaluationData })
        .eq('session_id', job.session_id);
      
      // Mark as done
      await supabase.from('mistral_queue').update({ 
        status: 'done', 
        updated_at: new Date().toISOString() 
      }).eq('id', job.id);
      
      console.log(`✅ Processed job ${job.id} for session ${job.session_id}`);
    } catch (err) {
      await supabase.from('mistral_queue').update({ 
        status: 'error', 
        updated_at: new Date().toISOString() 
      }).eq('id', job.id);
      console.error(`❌ Error processing job ${job.id}:`, err.message);
    }
  }
}

processQueue().then(() => {
  console.log('Queue processing complete.');
  process.exit(0);
}); 