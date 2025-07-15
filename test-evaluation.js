/**
 * Simple test to verify evaluation system works
 */

// Test the fallback evaluation function
function createFallbackEvaluation(longShortAnswers, mcqMarks, totalMcqs, mcqDetails = []) {
  let totalWrittenScore = 0;
  let validAnswers = 0;
  const writtenAnalysis = [];
  
  longShortAnswers.forEach((answer, idx) => {
    const answerText = answer.answer?.trim() || '';
    let questionScore = 0;
    let feedback = '';
    let whatIsCorrect = '';
    let whatIsMissing = '';
    
    if (answerText.length === 0) {
      questionScore = 0;
      feedback = 'No answer provided';
      whatIsMissing = 'Complete answer required';
    } else if (answerText.length < 10) {
      questionScore = 2;
      feedback = 'Answer too brief, needs more technical detail';
      whatIsCorrect = 'Attempted to answer';
      whatIsMissing = 'Technical depth and detailed explanation';
    } else if (answerText.length < 50) {
      questionScore = 4;
      feedback = 'Basic answer provided but lacks technical depth';
      whatIsCorrect = 'Basic understanding shown';
      whatIsMissing = 'More detailed technical explanation and examples';
    } else {
      questionScore = 6;
      feedback = 'Detailed answer provided - needs technical review for accuracy';
      whatIsCorrect = 'Comprehensive response attempted';
      whatIsMissing = 'Technical accuracy verification needed';
    }
    
    totalWrittenScore += questionScore;
    validAnswers++;
    
    writtenAnalysis.push({
      questionNumber: idx + 1,
      questionText: answer.questionText,
      whatIsCorrect,
      whatIsMissing,
      modelAnswer: 'Please refer to official documentation for comprehensive answer',
      score: questionScore,
      feedback
    });
  });
  
  const avgWrittenScore = validAnswers > 0 ? Math.round(totalWrittenScore / validAnswers) : 0;
  const mcqScore = totalMcqs > 0 ? Math.round((mcqMarks/totalMcqs)*100) : 0;
  const overallScore = totalMcqs > 0 && validAnswers > 0 
    ? Math.round((mcqScore + (avgWrittenScore * 10)) / 2)
    : totalMcqs > 0 ? mcqScore : avgWrittenScore * 10;
  
  // Generate more constructive feedback
  const strengths = [];
  const weaknesses = [];
  
  if (validAnswers > 0) {
    strengths.push("Completed all written questions");
    if (avgWrittenScore >= 6) strengths.push("Provided detailed responses");
    if (avgWrittenScore >= 4) strengths.push("Showed technical understanding");
  }
  
  if (mcqMarks > 0) {
    strengths.push(`Answered ${mcqMarks} MCQ questions correctly`);
  }
  
  if (totalMcqs > 0 && mcqScore < 50) {
    weaknesses.push("Review fundamental concepts for MCQ questions");
  }
  
  if (avgWrittenScore < 5) {
    weaknesses.push("Need more detailed technical explanations");
  }
  
  if (overallScore < 60) {
    weaknesses.push("Focus on core technical concepts");
  }
  
  // Ensure we always have at least one strength
  if (strengths.length === 0) {
    strengths.push("Attempted the interview assessment");
  }
  
  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    mcqScore: mcqScore,
    writtenAnswerScore: avgWrittenScore,
    longShortScore: avgWrittenScore * 10, // For backward compatibility
    technicalRating: Math.max(1, Math.min(10, Math.round(overallScore / 10))),
    totalQuestions: longShortAnswers.length + totalMcqs,
    mcqAnalysis: mcqDetails.map((mcq) => ({
      questionNumber: mcq.questionNumber,
      question: mcq.question,
      userAnswer: mcq.userAnswer,
      correctAnswer: mcq.correctAnswer,
      isCorrect: mcq.isCorrect,
      explanation: mcq.isCorrect ? 'Correct answer selected' : 'Incorrect answer - please review the concept'
    })),
    writtenAnswerAnalysis: writtenAnalysis,
    strengths: strengths,
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Consider practicing more complex scenarios"],
    recommendations: overallScore < 60 ? 
      ["Study fundamental concepts", "Practice technical explanations", "Review the technology documentation"] :
      ["Practice more complex scenarios", "Deepen technical knowledge"],
    nextSteps: overallScore >= 60 ? 
      ["Continue building practical experience", "Consider advanced topics"] :
      ["Focus on foundational learning", "Practice basic concepts"],
    passFailStatus: overallScore >= 60 ? "PASS" : "FAIL"
  };
}

// Test data
const testLongShortAnswers = [
  {
    questionText: "What is the difference between let and var?",
    answer: "let has block scope while var has function scope",
    questionType: "short_answer"
  },
  {
    questionText: "Explain closures in JavaScript",
    answer: "A closure is a function that has access to variables in its outer scope even after the outer function has returned",
    questionType: "long_answer"
  }
];

const testMcqDetails = [
  {
    questionNumber: 1,
    question: "Which is NOT a JavaScript data type?",
    userAnswer: "option_c",
    correctAnswer: "option_c",
    isCorrect: true
  },
  {
    questionNumber: 2,
    question: "What does DOM stand for?",
    userAnswer: "option_a",
    correctAnswer: "option_b",
    isCorrect: false
  }
];

// Run test
console.log('🧪 Testing Evaluation System...');
console.log('='.repeat(50));

const result = createFallbackEvaluation(testLongShortAnswers, 1, 2, testMcqDetails);

console.log('📊 Test Results:');
console.log('- Overall Score:', result.overallScore);
console.log('- MCQ Score:', result.mcqScore + '%');
console.log('- Written Answer Score:', result.writtenAnswerScore + '/10');
console.log('- Long/Short Score:', result.longShortScore + '%');
console.log('- Technical Rating:', result.technicalRating + '/10');
console.log('- Total Questions:', result.totalQuestions);
console.log('- Pass/Fail:', result.passFailStatus);

console.log('\n💪 Strengths:');
result.strengths.forEach((strength, idx) => {
  console.log(`${idx + 1}. ${strength}`);
});

console.log('\n🎯 Areas for Improvement:');
result.weaknesses.forEach((weakness, idx) => {
  console.log(`${idx + 1}. ${weakness}`);
});

console.log('\n📝 MCQ Analysis:');
result.mcqAnalysis.forEach((mcq, idx) => {
  console.log(`${idx + 1}. ${mcq.isCorrect ? '✅' : '❌'} ${mcq.question}`);
  console.log(`   Your: ${mcq.userAnswer}, Correct: ${mcq.correctAnswer}`);
});

console.log('\n📄 Written Analysis:');
result.writtenAnswerAnalysis.forEach((answer, idx) => {
  console.log(`${idx + 1}. Score: ${answer.score}/10`);
  console.log(`   Question: ${answer.questionText}`);
  console.log(`   What's Correct: ${answer.whatIsCorrect}`);
  console.log(`   What's Missing: ${answer.whatIsMissing}`);
  console.log(`   Feedback: ${answer.feedback}`);
});

console.log('\n🎉 Expected API Response Structure:');
console.log(JSON.stringify({
  success: true,
  message: '🎉 Interview evaluated successfully!',
  mcq_marks: 1,
  mcq_details: testMcqDetails,
  evaluation: {
    evaluation: result
  },
  isPro: true
}, null, 2));

console.log('\n✨ Your Frontend Should Access:');
console.log('- evaluation.evaluation.overallScore:', result.overallScore);
console.log('- evaluation.evaluation.mcqScore:', result.mcqScore);
console.log('- evaluation.evaluation.writtenAnswerScore:', result.writtenAnswerScore);
console.log('- evaluation.evaluation.longShortScore:', result.longShortScore);
console.log('- evaluation.evaluation.technicalRating:', result.technicalRating);
console.log('- evaluation.evaluation.strengths:', result.strengths);
console.log('- evaluation.evaluation.weaknesses:', result.weaknesses);