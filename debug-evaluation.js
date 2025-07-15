/**
 * Debug Script for Evaluation System
 * 
 * Run this script to debug evaluation issues:
 * node debug-evaluation.js [sessionId]
 */

const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node debug-evaluation.js <sessionId>');
  console.log('Example: node debug-evaluation.js test-session-123');
  process.exit(1);
}

const API_BASE = 'http://localhost:3000';

async function debugEvaluation(sessionId) {
  try {
    console.log('🔍 Debugging evaluation for session:', sessionId);
    console.log('='.repeat(50));

    // Get debug info
    const response = await fetch(`${API_BASE}/api/debug-evaluation?sessionId=${sessionId}`);
    const debugData = await response.json();

    if (!debugData.success) {
      console.error('❌ Error:', debugData.error);
      return;
    }

    console.log('📊 Debug Information:');
    console.log('- Has Final Report:', debugData.debugInfo.hasFinalReport);
    console.log('- Has Evaluation:', debugData.debugInfo.hasEvaluation);
    console.log('- Has User Responses:', debugData.debugInfo.hasUserResponses);
    console.log('- Has Queue Entry:', debugData.debugInfo.hasQueueEntry);
    console.log('- MCQ Marks:', debugData.debugInfo.mcqMarks);
    console.log('- Evaluation Structure:', debugData.debugInfo.evaluationStructure);
    console.log('- Long/Short Evaluation Structure:', debugData.debugInfo.longShortEvaluationStructure);

    console.log('\n📝 Final Report:');
    console.log(JSON.stringify(debugData.finalReport, null, 2));

    if (debugData.evaluation) {
      console.log('\n🤖 Evaluation Data:');
      console.log(JSON.stringify(debugData.evaluation.evaluation_data, null, 2));
    }

    if (debugData.queueStatus) {
      console.log('\n⏳ Queue Status:');
      console.log('- Status:', debugData.queueStatus.status);
      console.log('- Created:', debugData.queueStatus.created_at);
      console.log('- Updated:', debugData.queueStatus.updated_at);
    }

    console.log('\n📋 User Responses:');
    debugData.userResponses.forEach((resp, idx) => {
      console.log(`${idx + 1}. ${resp.question_type}: ${resp.question_text}`);
      console.log(`   Answer: ${resp.user_answer}`);
      console.log(`   Time: ${resp.time_spent}s`);
      console.log('');
    });

    // Test evaluation logic
    console.log('\n🧪 Testing Evaluation Logic:');
    const testResponse = await fetch(`${API_BASE}/api/debug-evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, testMode: true })
    });

    const testData = await testResponse.json();
    
    if (testData.success) {
      console.log('✅ Test Evaluation Generated:');
      console.log('- Overall Score:', testData.testEvaluation.overallScore);
      console.log('- MCQ Score:', testData.testEvaluation.mcqScore);
      console.log('- Written Answer Score:', testData.testEvaluation.writtenAnswerScore);
      console.log('- Technical Rating:', testData.testEvaluation.technicalRating);
      console.log('- Strengths:', testData.testEvaluation.strengths);
      console.log('- Weaknesses:', testData.testEvaluation.weaknesses);
      
      console.log('\n📊 MCQ Analysis:');
      testData.testEvaluation.mcqAnalysis.forEach((mcq, idx) => {
        console.log(`${idx + 1}. ${mcq.isCorrect ? '✅' : '❌'} ${mcq.question}`);
        console.log(`   Your Answer: ${mcq.userAnswer}`);
        console.log(`   Correct Answer: ${mcq.correctAnswer}`);
      });

      console.log('\n📝 Written Answer Analysis:');
      testData.testEvaluation.writtenAnswerAnalysis.forEach((ans, idx) => {
        console.log(`${idx + 1}. Score: ${ans.score}/10`);
        console.log(`   What's Correct: ${ans.whatIsCorrect}`);
        console.log(`   What's Missing: ${ans.whatIsMissing}`);
        console.log(`   Feedback: ${ans.feedback}`);
      });
    } else {
      console.error('❌ Test evaluation failed:', testData.error);
    }

  } catch (error) {
    console.error('❌ Debug script error:', error.message);
  }
}

// Run the debug
debugEvaluation(sessionId);