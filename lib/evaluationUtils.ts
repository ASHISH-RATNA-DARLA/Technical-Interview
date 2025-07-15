export interface MistralEvaluation {
  correctAnswers?: string; // The full text response with correct answers and explanations
  detailedFeedback?: string;
  evaluation?: any; // Enhanced evaluation object with detailed analysis
}

export interface EvaluationResult {
  overallScore: number;
  mcqScore: number;
  writtenAnswerScore: number;
  technicalRating: number;
  totalQuestions: number;
  mcqAnalysis: MCQAnalysis[];
  writtenAnswerAnalysis: WrittenAnswerAnalysis[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextSteps: string[];
  passFailStatus: string;
}

export interface MCQAnalysis {
  questionNumber: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

export interface WrittenAnswerAnalysis {
  questionNumber: number;
  questionText: string;
  whatIsCorrect: string;
  whatIsMissing: string;
  modelAnswer: string;
  score: number;
  feedback: string;
}

export function parseMistralEvaluation(evaluationText: string): MistralEvaluation | null {
  if (!evaluationText || evaluationText.trim() === '') {
    return null;
  }
  
  try {
    // Try to parse as JSON first
    const parsedEvaluation = JSON.parse(evaluationText);
    return {
      correctAnswers: evaluationText,
      detailedFeedback: evaluationText,
      evaluation: parsedEvaluation
    };
  } catch (error) {
    // If not JSON, treat as plain text
    return {
      correctAnswers: evaluationText,
      detailedFeedback: evaluationText
    };
  }
}

// Helper function to format the evaluation response for display
export function formatCorrectAnswers(correctAnswers: string | undefined): string {
  if (!correctAnswers) return 'No evaluation available';
  return correctAnswers;
}

// Helper function to format MCQ analysis for display
export function formatMCQAnalysis(mcqAnalysis: MCQAnalysis[]): string {
  if (!mcqAnalysis || mcqAnalysis.length === 0) {
    return 'No MCQ questions found';
  }
  
  return mcqAnalysis.map(mcq => 
    `Question ${mcq.questionNumber}: ${mcq.isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}\n` +
    `Your Answer: ${mcq.userAnswer}\n` +
    `Correct Answer: ${mcq.correctAnswer}\n` +
    `Explanation: ${mcq.explanation}\n`
  ).join('\n---\n');
}

// Helper function to format written answer analysis for display
export function formatWrittenAnswerAnalysis(writtenAnalysis: WrittenAnswerAnalysis[]): string {
  if (!writtenAnalysis || writtenAnalysis.length === 0) {
    return 'No written questions found';
  }
  
  return writtenAnalysis.map(answer => 
    `Question ${answer.questionNumber}: ${answer.questionText}\n` +
    `Score: ${answer.score}/10\n` +
    `What's Correct: ${answer.whatIsCorrect}\n` +
    `What's Missing: ${answer.whatIsMissing}\n` +
    `Model Answer: ${answer.modelAnswer}\n` +
    `Feedback: ${answer.feedback}\n`
  ).join('\n---\n');
} 