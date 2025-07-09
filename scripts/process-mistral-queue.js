// scripts/process-mistral-queue.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

async function callMistralAPI(longShortAnswers, techStack) {
  const prompt = longShortAnswers.map((resp, idx) => `Question ${idx + 1} (${resp.questionType}):\nQuestion: ${resp.questionText}\nAnswer: ${resp.answer}\nTime Spent: ${resp.timeSpent} seconds`).join('\n');
  const evaluationPrompt = `Please evaluate this technical interview for a ${techStack} position.\nCandidate Responses:\n${prompt}\nPlease provide a comprehensive evaluation including: 1. Overall score (0-100) 2. Technical knowledge assessment 3. Communication skills 4. Problem-solving approach 5. Areas of strength 6. Areas for improvement 7. Suggestions for next steps.`;
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
  return result.choices[0]?.message?.content || null;
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
      await supabase.from('mistral_queue').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', job.id);
      const evaluation = await callMistralAPI(job.long_short_answers, job.tech_stack);
      await supabase
        .from('final_reports')
        .update({ long_short_evaluation: evaluation })
        .eq('session_id', job.session_id);
      await supabase.from('mistral_queue').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', job.id);
      console.log(`Processed job ${job.id} for session ${job.session_id}`);
    } catch (err) {
      await supabase.from('mistral_queue').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', job.id);
      console.error(`Error processing job ${job.id}:`, err.message);
    }
  }
}

processQueue().then(() => {
  console.log('Queue processing complete.');
  process.exit(0);
}); 