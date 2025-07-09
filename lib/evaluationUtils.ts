export interface MistralEvaluation {
  overallScore?: number;
  technicalKnowledge?: number;
  communicationSkills?: number;
  problemSolving?: number;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  recommended?: boolean;
  detailedFeedback?: string;
}

export function parseMistralEvaluation(evaluationText: string): MistralEvaluation | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(evaluationText);
    return parsed as MistralEvaluation;
  } catch (error) {
    // If JSON parsing fails, try to extract information from text
    return extractFromText(evaluationText);
  }
}

function extractFromText(text: string): MistralEvaluation | null {
  const evaluation: MistralEvaluation = {};
  
  // Extract overall score
  const scoreMatch = text.match(/overall.*?score.*?(\d+)/i);
  if (scoreMatch) {
    evaluation.overallScore = parseInt(scoreMatch[1]);
  }
  
  // Extract technical knowledge
  const techMatch = text.match(/technical.*?knowledge.*?(\d+)/i);
  if (techMatch) {
    evaluation.technicalKnowledge = parseInt(techMatch[1]);
  }
  
  // Extract communication skills
  const commMatch = text.match(/communication.*?skills.*?(\d+)/i);
  if (commMatch) {
    evaluation.communicationSkills = parseInt(commMatch[1]);
  }
  
  // Extract problem solving
  const probMatch = text.match(/problem.*?solving.*?(\d+)/i);
  if (probMatch) {
    evaluation.problemSolving = parseInt(probMatch[1]);
  }
  
  // Extract strengths (look for bullet points or numbered lists)
  const strengthsMatch = text.match(/strengths?[:\s]*((?:[•\-\*]\s*[^\n]+\n?)+)/i);
  if (strengthsMatch) {
    evaluation.strengths = strengthsMatch[1]
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  // Extract improvements
  const improvementsMatch = text.match(/improvements?[:\s]*((?:[•\-\*]\s*[^\n]+\n?)+)/i);
  if (improvementsMatch) {
    evaluation.improvements = improvementsMatch[1]
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  // Extract recommendations
  const recMatch = text.match(/recommendations?[:\s]*((?:[•\-\*]\s*[^\n]+\n?)+)/i);
  if (recMatch) {
    evaluation.recommendations = recMatch[1]
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  // Extract recommendation status
  const recommendedMatch = text.match(/recommended.*?(yes|no|true|false)/i);
  if (recommendedMatch) {
    evaluation.recommended = ['yes', 'true'].includes(recommendedMatch[1].toLowerCase());
  }
  
  // Use the full text as detailed feedback if no specific section found
  if (!evaluation.detailedFeedback) {
    evaluation.detailedFeedback = text;
  }
  
  return Object.keys(evaluation).length > 0 ? evaluation : null;
}

export function formatEvaluationScore(score: number | undefined): string {
  if (score === undefined) return 'N/A';
  
  if (score >= 90) return `${score}% (Excellent)`;
  if (score >= 80) return `${score}% (Very Good)`;
  if (score >= 70) return `${score}% (Good)`;
  if (score >= 60) return `${score}% (Satisfactory)`;
  return `${score}% (Needs Improvement)`;
} 