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
  
  if (resumeAnalysis === 'true') {
    const body = await request.json();
    const resumeText = body.resumeText || '';
    
    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    try {
      // Generate AI-powered questions based on resume
      const questions = await generateQuestionsFromResume(resumeText);
      return NextResponse.json(questions);
    } catch (error) {
      console.error('Error generating questions from resume:', error);
      // Fallback to default questions if AI generation fails
      const defaultQuestions = generateFallbackQuestions(resumeText);
      return NextResponse.json(defaultQuestions);
    }
  }
  
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

async function generateQuestionsFromResume(resumeText) {
  try {
    // STEP 1: Comprehensive Resume Analysis
    console.log('🔍 Starting comprehensive resume analysis...');
    const resumeAnalysis = analyzeResumeComprehensively(resumeText);
    
    console.log('📊 Resume Analysis Results:', JSON.stringify(resumeAnalysis, null, 2));
    
    // Extract tech stack from comprehensive analysis
    const techStacks = resumeAnalysis.technologies.map(tech => tech.name);
    const primaryTechStack = techStacks[0] || 'General';
    
    console.log('🎯 Primary Tech Stack:', primaryTechStack);
    console.log('📋 All Detected Technologies:', techStacks);
    console.log('📄 Resume length:', resumeText.length);
    
    // Call Mistral API to generate questions
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    const mistralUrl = 'https://api.mistral.ai/v1/chat/completions';
    
    if (!mistralApiKey) {
      console.error('Mistral API key not found');
      throw new Error('Mistral API key not configured');
    }
    
    // Add randomness to prompt to avoid same questions
    const randomSeed = Math.floor(Math.random() * 1000);
    const currentTime = new Date().toISOString();
    
    const prompt = `You are a senior technical interviewer with expertise in creating professional, industry-standard interview questions. Based on the comprehensive resume analysis below, generate 10 HIGH-QUALITY technical questions that match professional interview standards.

COMPREHENSIVE RESUME ANALYSIS:
${resumeText.substring(0, 3000)}

TECHNOLOGY STACK ANALYSIS:
- Primary Tech Stack: ${primaryTechStack}
- All Technologies: ${techStacks.join(', ')}
- Experience Level: ${resumeAnalysis.experienceLevel}
- Project Types: ${resumeAnalysis.projectTypes.join(', ')}
- Tech Categories: ${Object.keys(resumeAnalysis.categorizedTechnologies).join(', ')}
- Is Full Stack: ${resumeAnalysis.techStackSummary.isFullStack}
- Primary Focus: ${resumeAnalysis.techStackSummary.primaryFocus}

QUESTION FOCUS AREAS (based on analysis):
- Technical Depth: ${resumeAnalysis.recommendedQuestionFocus.technical_depth}
- System Design Questions: ${resumeAnalysis.recommendedQuestionFocus.system_design ? 'Include' : 'Skip'}
- Performance Focus: ${resumeAnalysis.recommendedQuestionFocus.performance_optimization ? 'Include' : 'Skip'}
- Security Focus: ${resumeAnalysis.recommendedQuestionFocus.security_focus ? 'Include' : 'Skip'}
- Testing Focus: ${resumeAnalysis.recommendedQuestionFocus.testing_focus ? 'Include' : 'Skip'}

GENERATE QUESTIONS FOLLOWING THESE PROFESSIONAL STANDARDS:

QUESTION QUALITY REQUIREMENTS:
- Questions must be specific, practical, and test real-world knowledge
- Focus on technologies and concepts mentioned in the resume
- Include both theoretical understanding and practical application
- Test problem-solving abilities and technical depth
- Questions should be suitable for a ${primaryTechStack} professional role

QUESTION DISTRIBUTION:
- 7 MCQ questions: 2 easy, 3 medium, 2 hard
- 2 Short answer questions: 1 medium, 1 hard
- 1 Long answer question: hard level

EXAMPLES OF PROFESSIONAL QUESTION QUALITY:

MCQ Example:
"Which of the following is NOT a property of ACID transactions?"
A) Atomicity B) Consistency C) Isolation D) Availability
Correct: D (Availability is not an ACID property)

Short Answer Example:
"What is the difference between DELETE, TRUNCATE, and DROP commands in SQL?"
Expected: Technical explanation of each command's behavior, performance, and rollback capabilities.

Long Answer Example:
"Explain the concept of database normalization and its advantages."
Expected: Comprehensive explanation covering process, forms, benefits, and real-world application.

TECHNICAL FOCUS AREAS (based on resume):
- Core concepts in ${primaryTechStack}
- Best practices and design patterns
- Performance optimization techniques
- Security considerations
- Architecture and system design
- Error handling and debugging
- Database/data management (if applicable)
- Framework-specific features and patterns

SESSION UNIQUENESS: ${randomSeed}-${currentTime}

FORMAT REQUIREMENTS - Return valid JSON array:
[
  {
    "id": 1001,
    "question_type": "mcq",
    "question_text": "Professional question text here related to resume technologies",
    "option_a": "Technically accurate option A",
    "option_b": "Technically accurate option B",
    "option_c": "Technically accurate option C", 
    "option_d": "Technically accurate option D",
    "correct_answer": "option_a",
    "difficulty_level": "easy",
    "topic": "Specific Technical Topic",
    "tech_stack": "${primaryTechStack}"
  },
  {
    "id": 1002,
    "question_type": "short_answer",
    "question_text": "Professional short answer question testing practical knowledge",
    "correct_answer": null,
    "difficulty_level": "medium",
    "topic": "Specific Technical Topic",
    "tech_stack": "${primaryTechStack}"
  },
  {
    "id": 1003,
    "question_type": "long_answer", 
    "question_text": "Comprehensive question testing deep understanding and practical application",
    "correct_answer": null,
    "difficulty_level": "hard",
    "topic": "System Design/Architecture",
    "tech_stack": "${primaryTechStack}"
  }
]

CRITICAL: Questions must be professional-grade, technically accurate, and specific to the candidate's background. Focus on practical scenarios they would encounter in their role.`;

    const response = await fetch(mistralUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a senior technical interviewer and question designer with 15+ years of experience. You create professional-grade interview questions that match industry standards. CRITICAL: You must respond with ONLY a valid JSON array, no markdown formatting, no code blocks, no additional text or explanations. Start your response directly with [ and end with ]. Do not use ```json``` or any other formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9, // Increased for more variation
        max_tokens: 3000, // Increased for more detailed questions
        top_p: 0.95,
        random_seed: randomSeed // Add randomness
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const result = await response.json();
    const questionsText = result.choices[0]?.message?.content;
    
    console.log('AI Response:', questionsText);
    
    // Clean the response to extract JSON
    const cleanedJson = extractJsonFromResponse(questionsText);
    console.log('Cleaned JSON:', cleanedJson);
    
    // Parse the JSON response
    const questions = JSON.parse(cleanedJson);
    
    console.log('Parsed questions:', questions.length);
    
    // Validate and return questions
    if (Array.isArray(questions) && questions.length > 0) {
      // Validate each question has required fields
      const validatedQuestions = questions.filter(q => 
        q.id && 
        q.question_type && 
        q.question_text && 
        q.difficulty_level && 
        q.topic && 
        q.tech_stack
      );
      
      if (validatedQuestions.length > 0) {
        console.log(`Successfully generated ${validatedQuestions.length} valid questions`);
        return validatedQuestions;
      } else {
        throw new Error('No valid questions found in AI response');
      }
    } else {
      throw new Error('AI did not return a valid questions array');
    }
    
  } catch (error) {
    console.error('Error generating questions with AI:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // If it's a JSON parsing error, log the raw response for debugging
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      console.error('Raw AI response that failed to parse:', error.responseText || 'No response text available');
    }
    
    // Fallback to default questions if AI fails
    console.log('Falling back to default questions due to AI error');
    return generateFallbackQuestions(resumeText);
  }
}

function generateFallbackQuestions(resumeText) {
  // Use comprehensive analysis for fallback too
  const resumeAnalysis = analyzeResumeComprehensively(resumeText);
  const techStacks = resumeAnalysis.technologies.map(tech => tech.name);
  const primaryTechStack = techStacks[0] || 'JavaScript';
  const secondaryTechStack = techStacks[1] || 'Node.js';
  
  console.log('🔄 Generating fallback questions based on analysis:', {
    primaryTechStack,
    experienceLevel: resumeAnalysis.experienceLevel,
    categories: Object.keys(resumeAnalysis.categorizedTechnologies)
  });
  
  // Adaptive fallback questions based on analysis
  const isFullStack = resumeAnalysis.techStackSummary.isFullStack;
  const experienceLevel = resumeAnalysis.experienceLevel;
  const hasBackend = Object.keys(resumeAnalysis.categorizedTechnologies).includes('Backend Frameworks');
  const hasDatabase = Object.keys(resumeAnalysis.categorizedTechnologies).includes('Databases');
  
  // Professional fallback questions based on CSV standard and analysis
  const questionTemplates = {
    mcq: [
      {
        id: 1001,
        question_type: 'mcq',
        question_text: `Which of the following is NOT a core principle of ${primaryTechStack} best practices?`,
        option_a: 'Code reusability and modularity',
        option_b: 'Performance optimization',
        option_c: 'Ignoring error handling for faster development',
        option_d: 'Maintainable code structure',
        correct_answer: 'option_c',
        difficulty_level: 'easy',
        topic: 'Best Practices',
        tech_stack: primaryTechStack
      },
      {
        id: 1002,
        question_type: 'mcq',
        question_text: `What is the primary purpose of using version control in ${primaryTechStack} development?`,
        option_a: 'To make code run faster',
        option_b: 'To track changes and collaborate with team members',
        option_c: 'To automatically debug code',
        option_d: 'To compress file sizes',
        correct_answer: 'option_b',
        difficulty_level: 'easy',
        topic: 'Version Control',
        tech_stack: primaryTechStack
      },
      {
        id: 1003,
        question_type: 'mcq',
        question_text: `In ${primaryTechStack} development, which design pattern is most suitable for managing application state?`,
        option_a: 'Singleton Pattern',
        option_b: 'Observer Pattern',
        option_c: 'Factory Pattern',
        option_d: 'Depends on application requirements',
        correct_answer: 'option_d',
        difficulty_level: 'medium',
        topic: 'Design Patterns',
        tech_stack: primaryTechStack
      },
      {
        id: 1004,
        question_type: 'mcq',
        question_text: `Which of the following is a key benefit of ${primaryTechStack} testing practices?`,
        option_a: 'Faster initial development',
        option_b: 'Reduced maintenance costs and improved reliability',
        option_c: 'Smaller file sizes',
        option_d: 'Better visual design',
        correct_answer: 'option_b',
        difficulty_level: 'medium',
        topic: 'Testing',
        tech_stack: primaryTechStack
      },
      {
        id: 1005,
        question_type: 'mcq',
        question_text: `In ${primaryTechStack} applications, what is the most effective way to handle performance optimization?`,
        option_a: 'Always use the latest features',
        option_b: 'Profile first, then optimize bottlenecks',
        option_c: 'Optimize everything from the start',
        option_d: 'Use the most popular libraries',
        correct_answer: 'option_b',
        difficulty_level: 'medium',
        topic: 'Performance',
        tech_stack: primaryTechStack
      },
      {
        id: 1006,
        question_type: 'mcq',
        question_text: experienceLevel === 'senior' 
          ? `In a distributed ${primaryTechStack} system, which approach best handles authentication at scale?`
          : `Which approach provides the highest security for ${primaryTechStack} applications handling user authentication?`,
        option_a: experienceLevel === 'senior' ? 'Distributed session stores' : 'Storing passwords in plain text',
        option_b: experienceLevel === 'senior' ? 'JWT with microservices' : 'Using JWT tokens with proper validation',
        option_c: experienceLevel === 'senior' ? 'OAuth 2.0 with service mesh' : 'Session-based authentication only',
        option_d: experienceLevel === 'senior' ? 'All approaches have trade-offs' : 'OAuth 2.0 with PKCE flow',
        correct_answer: experienceLevel === 'senior' ? 'option_d' : 'option_d',
        difficulty_level: experienceLevel === 'senior' ? 'hard' : 'hard',
        topic: 'Security',
        tech_stack: primaryTechStack
      },
      {
        id: 1007,
        question_type: 'mcq',
        question_text: `Which of the following is the most challenging aspect of scaling ${primaryTechStack} applications?`,
        option_a: 'Adding more features',
        option_b: 'Managing state consistency and data synchronization',
        option_c: 'Choosing the right color scheme',
        option_d: 'Writing documentation',
        correct_answer: 'option_b',
        difficulty_level: 'hard',
        topic: 'Scalability',
        tech_stack: primaryTechStack
      }
    ],
    short_answer: [
      {
        id: 1008,
        question_type: 'short_answer',
        question_text: `Explain the difference between synchronous and asynchronous programming in ${primaryTechStack}. When would you use each approach?`,
        difficulty_level: 'medium',
        topic: 'Programming Concepts',
        tech_stack: primaryTechStack
      },
      {
        id: 1009,
        question_type: 'short_answer',
        question_text: `How do you handle error handling and logging in a ${primaryTechStack} production application? What strategies do you implement?`,
        difficulty_level: 'hard',
        topic: 'Error Handling',
        tech_stack: primaryTechStack
      }
    ],
    long_answer: [
      {
        id: 1010,
        question_type: 'long_answer',
        question_text: isFullStack 
          ? `Design a complete full-stack architecture using ${primaryTechStack} and ${secondaryTechStack} for a high-traffic application. Include frontend optimization, backend scalability, database design, and deployment strategy.`
          : `Design and explain a complete system architecture for a ${primaryTechStack} application that needs to handle high traffic and ensure data consistency. Include your choice of database, caching strategy, and scalability considerations.`,
        difficulty_level: 'hard',
        topic: isFullStack ? 'Full-Stack Architecture' : 'System Architecture',
        tech_stack: primaryTechStack
      }
    ]
  };
  
  // Combine all questions and add some randomization
  const allQuestions = [
    ...questionTemplates.mcq,
    ...questionTemplates.short_answer,
    ...questionTemplates.long_answer
  ];
  
  // Randomize the order and return
  return allQuestions.sort(() => Math.random() - 0.5);
}

function extractJsonFromResponse(responseText: string): string {
  if (!responseText) {
    throw new Error('Empty response from AI');
  }
  
  // Remove any markdown code block formatting
  let cleanedText = responseText.trim();
  
  // Remove markdown JSON code blocks
  cleanedText = cleanedText.replace(/^```json\s*/i, '');
  cleanedText = cleanedText.replace(/^```\s*/i, '');
  cleanedText = cleanedText.replace(/\s*```\s*$/i, '');
  
  // Remove any leading/trailing whitespace
  cleanedText = cleanedText.trim();
  
  // Find JSON array start and end
  const jsonStart = cleanedText.indexOf('[');
  const jsonEnd = cleanedText.lastIndexOf(']') + 1;
  
  if (jsonStart === -1 || jsonEnd === 0) {
    // Try to find JSON object instead
    const objStart = cleanedText.indexOf('{');
    const objEnd = cleanedText.lastIndexOf('}') + 1;
    
    if (objStart === -1 || objEnd === 0) {
      throw new Error('No valid JSON found in AI response');
    }
    
    cleanedText = cleanedText.substring(objStart, objEnd);
  } else {
    cleanedText = cleanedText.substring(jsonStart, jsonEnd);
  }
  
  // Validate it's proper JSON by attempting to parse
  try {
    JSON.parse(cleanedText);
    return cleanedText;
  } catch (error) {
    console.error('JSON validation failed:', error);
    throw new Error('Invalid JSON format in AI response');
  }
}

function analyzeResumeComprehensively(resumeText) {
  const resumeLower = resumeText.toLowerCase();
  // Comprehensive tech categories with missing technologies added
  const techCategories = {
    'Frontend Frameworks': {
      keywords: [
        'react', 'vue.js', 'vue', 'angular', 'next.js', 'nextjs', 'nuxt.js', 'nuxtjs', 'svelte', 
        'solid.js', 'preact', 'lit', 'alpine.js', 'ember.js', 'backbone.js'
      ],
      priority: 'high'
    },
    'Backend Frameworks': {
      keywords: [
        'node.js', 'nodejs', 'express.js', 'express', 'django', 'flask', 'fastapi', 'spring boot', 
        'spring', 'asp.net', 'asp', '.net', 'ruby on rails', 'rails', 'laravel', 'symfony', 'koa', 
        'hapi', 'adonisjs', 'phoenix'
      ],
      priority: 'high'
    },
    'Programming Languages': {
      keywords: [
        'javascript', 'typescript', 'python', 'java', 'c#', 'csharp', 'c++', 'cpp', 'go', 'golang', 
        'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart', 'scala', 'elixir', 'clojure', 'haskell', 
        'perl', 'r', 'objective-c'
      ],
      priority: 'very-high'
    },
    'Databases': {
      keywords: [
        'mongodb', 'mongo', 'postgresql', 'postgres', 'mysql', 'redis', 'elasticsearch', 'elastic', 
        'dynamodb', 'cassandra', 'oracle', 'sql server', 'sqlite', 'neo4j', 'influxdb', 
        'clickhouse', 'snowflake', 'bigquery'
      ],
      priority: 'high'
    },
    'Cloud Platforms': {
      keywords: [
        'aws', 'amazon web services', 'azure', 'microsoft azure', 'google cloud', 'gcp', 'vercel', 
        'netlify', 'heroku', 'digitalocean', 'linode', 'cloudflare', 'ibm cloud', 'oracle cloud'
      ],
      priority: 'high'
    },
    'DevOps & Tools': {
      keywords: [
        'docker', 'kubernetes', 'k8s', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 
        'terraform', 'ansible', 'chef', 'puppet', 'vagrant', 'prometheus', 'grafana', 'argo cd'
      ],
      priority: 'medium'
    },
    'Mobile Development': {
      keywords: [
        'react native', 'flutter', 'ionic', 'xamarin', 'native ios', 'native android', 'swift ui', 
        'jetpack compose', 'kmm', 'cordova'
      ],
      priority: 'high'
    },
    'CSS & Styling': {
      keywords: [
        'tailwind css', 'tailwind', 'bootstrap', 'material-ui', 'mui', 'ant design', 'chakra ui', 
        'styled-components', 'emotion', 'sass', 'scss', 'less', 'foundation', 'bulma'
      ],
      priority: 'medium'
    },
    'State Management': {
      keywords: [
        'redux', 'mobx', 'zustand', 'recoil', 'context api', 'vuex', 'pinia', 'ngrx', 
        'apollo client', 'react query', 'swr'
      ],
      priority: 'medium'
    },
    'Testing Tools': {
      keywords: [
        'jest', 'mocha', 'chai', 'cypress', 'playwright', 'selenium', 'testing library', 'enzyme', 
        'jasmine', 'karma', 'puppeteer', 'robot framework'
      ],
      priority: 'medium'
    },
    'Build Tools': {
      keywords: [
        'webpack', 'vite', 'rollup', 'parcel', 'babel', 'esbuild', 'turbopack', 'gulp', 'grunt', 
        'pnpm'
      ],
      priority: 'low'
    },
    'Version Control': {
      keywords: ['git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial'],
      priority: 'low'
    },
    'AI/ML & Data Science': {
      keywords: [
        'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy', 'matplotlib', 
        'openai', 'huggingface', 'langchain', 'mlflow', 'caffe', 'xgboost', 'lightgbm'
      ],
      priority: 'very-high'
    },
    'Big Data & Data Engineering': {
      keywords: [
        'hadoop', 'spark', 'kafka', 'hive', 'airflow', 'databricks', 'flink', 'beam', 
        'delta lake', 'redshift'
      ],
      priority: 'high'
    },
    'Blockchain & Web3': {
      keywords: [
        'solidity', 'ethereum', 'web3.js', 'ethers.js', 'hardhat', 'truffle', 'polygon', 
        'binance smart chain', 'ipfs', 'near protocol'
      ],
      priority: 'medium'
    }
  };
  // Extract technologies with scoring
  const foundTechnologies = [];
  const experienceLevel = analyzeExperienceLevel(resumeText);
  const projectTypes = extractProjectTypes(resumeText);
  Object.entries(techCategories).forEach(([category, data]) => {
    data.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = resumeText.match(regex) || [];
      if (matches.length > 0) {
        foundTechnologies.push({
          name: keyword,
          category: category,
          frequency: matches.length,
          priority: data.priority,
          score: calculateTechScore(matches.length, data.priority, keyword, resumeText)
        });
      }
    });
  });
  // Sort by score and remove duplicates
  const uniqueTechnologies = foundTechnologies
    .filter((tech, index, self) => 
      index === self.findIndex(t => t.name.toLowerCase() === tech.name.toLowerCase())
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 15); // Top 15 technologies
  // Group by category
  const categorizedTech = {};
  uniqueTechnologies.forEach(tech => {
    if (!categorizedTech[tech.category]) {
      categorizedTech[tech.category] = [];
    }
    categorizedTech[tech.category].push(tech);
  });
  return {
    technologies: uniqueTechnologies,
    categorizedTechnologies: categorizedTech,
    primaryTechStack: uniqueTechnologies[0]?.name || 'General',
    experienceLevel: experienceLevel,
    projectTypes: projectTypes,
    techStackSummary: generateTechStackSummary(uniqueTechnologies),
    recommendedQuestionFocus: determineQuestionFocus(uniqueTechnologies, experienceLevel)
  };
}

function calculateTechScore(frequency, priority, keyword, resumeText) {
  let score = frequency;
  
  // Priority multiplier
  const priorityMultiplier = {
    'very-high': 5,
    'high': 3,
    'medium': 2,
    'low': 1
  };
  
  score *= priorityMultiplier[priority] || 1;
  
  // Context bonus (if mentioned in context of experience, projects, etc.)
  const contextKeywords = ['experience', 'project', 'developed', 'built', 'implemented', 'worked', 'used'];
  const keywordRegex = new RegExp(`(${contextKeywords.join('|')}).*?${keyword}|${keyword}.*?(${contextKeywords.join('|')})`, 'gi');
  const contextMatches = resumeText.match(keywordRegex) || [];
  score += contextMatches.length * 2;
  
  return score;
}

function analyzeExperienceLevel(resumeText) {
  const seniorKeywords = ['senior', 'lead', 'principal', 'architect', 'manager', 'head of', 'director'];
  const midKeywords = ['developer', 'engineer', 'programmer', '3+ years', '4+ years', '5+ years'];
  const juniorKeywords = ['junior', 'intern', 'trainee', 'graduate', 'entry level', '1+ year', '2+ years'];
  
  const seniorCount = seniorKeywords.reduce((count, keyword) => 
    count + (resumeText.toLowerCase().includes(keyword) ? 1 : 0), 0);
  const midCount = midKeywords.reduce((count, keyword) => 
    count + (resumeText.toLowerCase().includes(keyword) ? 1 : 0), 0);
  const juniorCount = juniorKeywords.reduce((count, keyword) => 
    count + (resumeText.toLowerCase().includes(keyword) ? 1 : 0), 0);
  
  if (seniorCount >= 2) return 'senior';
  if (midCount >= 2) return 'mid-level';
  if (juniorCount >= 1) return 'junior';
  return 'mid-level'; // default
}

function extractProjectTypes(resumeText) {
  const projectTypes = {
    'Web Applications': ['web app', 'website', 'web application', 'frontend', 'backend', 'full stack'],
    'Mobile Apps': ['mobile app', 'android app', 'ios app', 'react native', 'flutter'],
    'APIs': ['api', 'rest api', 'restful', 'graphql', 'microservice'],
    'E-commerce': ['ecommerce', 'e-commerce', 'shopping', 'payment', 'cart'],
    'Data Processing': ['data processing', 'etl', 'data pipeline', 'analytics', 'big data'],
    'Real-time Systems': ['real-time', 'websocket', 'socket.io', 'chat', 'notification'],
    'DevOps': ['ci/cd', 'deployment', 'infrastructure', 'monitoring', 'scaling']
  };
  
  const foundTypes = [];
  Object.entries(projectTypes).forEach(([type, keywords]) => {
    const found = keywords.some(keyword => 
      resumeText.toLowerCase().includes(keyword)
    );
    if (found) foundTypes.push(type);
  });
  
  return foundTypes;
}

function generateTechStackSummary(technologies) {
  const topTech = technologies.slice(0, 5).map(t => t.name);
  const categories = [...new Set(technologies.map(t => t.category))];
  
  return {
    topTechnologies: topTech,
    categories: categories,
    isFullStack: categories.includes('Frontend Frameworks') && categories.includes('Backend Frameworks'),
    primaryFocus: technologies[0]?.category || 'General'
  };
}

function determineQuestionFocus(technologies, experienceLevel) {
  const focus = {
    technical_depth: experienceLevel === 'senior' ? 'advanced' : experienceLevel === 'junior' ? 'fundamental' : 'intermediate',
    system_design: experienceLevel === 'senior',
    practical_implementation: true,
    best_practices: experienceLevel !== 'junior',
    performance_optimization: technologies.some(t => t.category.includes('Backend') || t.category.includes('Database')),
    security_focus: technologies.some(t => t.name.includes('auth') || t.category.includes('Backend')),
    testing_focus: technologies.some(t => t.category.includes('Testing'))
  };
  
  return focus;
}

function extractTechStackFromResume(resumeText) {
  const techCategories = {
    'Frontend': ['React', 'Vue.js', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte', 'jQuery', 'Bootstrap', 'Tailwind CSS', 'Material-UI', 'Ant Design'],
    'Backend': ['Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Ruby on Rails', 'Laravel', 'Symfony'],
    'Languages': ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart'],
    'Databases': ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'Oracle', 'SQL Server'],
    'Cloud': ['AWS', 'Azure', 'Google Cloud', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean'],
    'DevOps': ['Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'Terraform', 'Ansible'],
    'Mobile': ['React Native', 'Flutter', 'Ionic', 'Xamarin', 'Native iOS', 'Native Android'],
    'Tools': ['Git', 'Webpack', 'Vite', 'Babel', 'ESLint', 'Prettier', 'Jest', 'Cypress', 'Postman']
  };
  
  const resumeLower = resumeText.toLowerCase();
  const foundTechs = [];
  
  // Extract technologies from each category
  Object.entries(techCategories).forEach(([category, techs]) => {
    techs.forEach(tech => {
      if (resumeLower.includes(tech.toLowerCase())) {
        foundTechs.push({
          name: tech,
          category: category,
          // Count occurrences to prioritize frequently mentioned techs
          count: (resumeLower.match(new RegExp(tech.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        });
      }
    });
  });
  
  // Sort by count (most mentioned first) and return top technologies
  const sortedTechs = foundTechs
    .sort((a, b) => b.count - a.count)
    .map(tech => tech.name);
  
  // Return top 6 technologies found, or default set if none found
  return sortedTechs.length > 0 ? sortedTechs.slice(0, 6) : ['JavaScript', 'Python', 'React', 'Node.js'];
}