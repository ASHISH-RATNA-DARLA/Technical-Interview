import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const techStack = searchParams.get('techStack');
  const listTechStacks = searchParams.get('listTechStacks');

  if (listTechStacks === 'true') {
    // Return unique tech stacks
    const { data, error } = await supabase
      .from('technical_questions')
      .select('tech_stack', { distinct: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Extract unique tech stacks
    const uniqueTechStacks = Array.from(new Set((data || []).map(q => q.tech_stack))).filter(Boolean);
    return NextResponse.json(uniqueTechStacks);
  }

  let query = supabase.from('technical_questions').select('*');
  if (techStack) {
    query = query.eq('tech_stack', techStack);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const resumeAnalysis = searchParams.get('resumeAnalysis');
  const techStack = searchParams.get('techStack');
  if (resumeAnalysis === 'true') {
    // Generate questions based on resumeText (mocked for now)
    const body = await request.json();
    const resumeText = body.resumeText || '';
    // TODO: Replace with real AI-powered question generation
    // For now, return a mix of MCQ, short, and long questions based on resume
    const questions = [
      {
        id: 1,
        question_type: 'mcq',
        question_text: `Which technology is most relevant to this resume?`,
        option_a: 'React',
        option_b: 'Node.js',
        option_c: 'Python',
        option_d: 'Java',
        correct_answer: 'React',
        difficulty_level: 'easy',
        topic: techStack || 'General',
      },
      {
        id: 2,
        question_type: 'short',
        question_text: `Summarize your experience with ${techStack || 'this stack'} in 2-3 sentences.`,
        difficulty_level: 'medium',
        topic: techStack || 'General',
      },
      {
        id: 3,
        question_type: 'long',
        question_text: `Describe a challenging project from your resume and how you solved key problems.`,
        difficulty_level: 'hard',
        topic: techStack || 'General',
      }
    ];
    return NextResponse.json(questions);
  }
  // Fallback: not a resume analysis request
  return NextResponse.json({ error: 'Not implemented' }, { status: 400 });
} 