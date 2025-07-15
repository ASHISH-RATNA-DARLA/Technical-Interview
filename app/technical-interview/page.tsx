"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Upload,
  Lock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Zap,
  Crown,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { VoiceAnimation } from "@/components/voice-animation"
// Remove react-tts import
// import ReactTTS from "react-tts"
import mammoth from "mammoth";
import { Document, Packer } from "docx";

// Types
interface Question {
  id: number
  type: "mcq" | "short" | "long"
  question: string
  options?: string[]
  correctAnswer?: string | number
  difficulty: "easy" | "medium" | "hard"
  category: string
}

interface UserAnswer {
  questionId: number
  questionText: string
  questionType: "mcq" | "short" | "long"
  answer: string
  timeSpent: number
}

interface MockFeedback {
  score: number
  totalQuestions: number
  strengths: string[]
  improvements: string[]
  resumeInsights?: {
    matchScore: number
    missingSkills: string[]
    recommendations: string[]
  }
}

// Mock Data
const mockQuestions: Record<string, Question[]> = {
  react: [
    {
      id: 1,
      type: "mcq",
      question: "What is the purpose of useEffect hook in React?",
      options: [
        "To manage component state",
        "To perform side effects in functional components",
        "To create custom hooks",
        "To handle form submissions",
      ],
      correctAnswer: 1,
      difficulty: "medium",
      category: "Hooks",
    },
    {
      id: 2,
      type: "short",
      question: "Explain the difference between props and state in React.",
      difficulty: "easy",
      category: "Fundamentals",
    },
    {
      id: 3,
      type: "long",
      question:
        "Describe how you would optimize a React application for performance. Include specific techniques and tools you would use.",
      difficulty: "hard",
      category: "Performance",
    },
  ],
  nodejs: [
    {
      id: 1,
      type: "mcq",
      question: "Which of the following is NOT a core module in Node.js?",
      options: ["fs", "http", "express", "path"],
      correctAnswer: 2,
      difficulty: "easy",
      category: "Core Modules",
    },
    {
      id: 2,
      type: "short",
      question: "What is the event loop in Node.js and why is it important?",
      difficulty: "medium",
      category: "Architecture",
    },
  ],
  python: [
    {
      id: 1,
      type: "mcq",
      question: "What is the output of: print(type([]))?",
      options: ["<class 'array'>", "<class 'list'>", "<class 'tuple'>", "<class 'dict'>"],
      correctAnswer: 1,
      difficulty: "easy",
      category: "Data Types",
    },
    {
      id: 2,
      type: "long",
      question: "Explain the concept of decorators in Python with examples.",
      difficulty: "hard",
      category: "Advanced Features",
    },
  ],
}

const mockFeedback: MockFeedback = {
  score: 85,
  totalQuestions: 3,
  strengths: [
    "Strong understanding of React hooks",
    "Good grasp of performance optimization concepts",
    "Clear and concise explanations",
  ],
  improvements: [
    "Could elaborate more on state management patterns",
    "Consider mentioning more specific optimization tools",
    "Practice explaining complex concepts in simpler terms",
  ],
  resumeInsights: {
    matchScore: 92,
    missingSkills: ["GraphQL", "Docker", "AWS"],
    recommendations: [
      "Add GraphQL experience to strengthen full-stack profile",
      "Consider learning containerization with Docker",
      "AWS certification would complement your backend skills",
    ],
  },
}

function mapApiQuestionToFrontend(q: any): Question {
  return {
    id: q.id,
    type: q.question_type === 'mcq' ? 'mcq' : q.question_type === 'short_answer' ? 'short' : 'long',
    question: q.question_text,
    options: q.question_type === 'mcq' ? [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) : undefined,
    correctAnswer: q.correct_answer,
    difficulty: (q.difficulty_level || '').toLowerCase(),
    category: q.topic || q.tech_stack || '',
  };
}

export default function TechnicalInterviewSimulator() {
  const [techStacks, setTechStacks] = useState<{ value: string; label: string; icon?: string }[]>([])

  // Fetch tech stacks from backend on mount
  useEffect(() => {
    const fetchTechStacks = async () => {
      try {
        const res = await fetch('/api/questions?listTechStacks=true')
        const data = await res.json()
        if (Array.isArray(data)) {
          setTechStacks(data.map((stack: string) => ({ value: stack, label: stack })))
        }
      } catch (err) {
        setTechStacks([])
      }
    }
    fetchTechStacks()
  }, [])

  // State Management
  const [isPro, setIsPro] = useState(false)
  const [techStack, setTechStack] = useState("")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string>("")
  const [isExtracting, setIsExtracting] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [timer, setTimer] = useState(60)
  
  // Function to get timer duration based on question type
  const getTimerDuration = (questionType: string) => {
    switch (questionType) {
      case 'mcq':
        return 90  // 1.5 minutes for MCQ
      case 'short_answer':
        return 180 // 3 minutes for short answers
      case 'long_answer':
        return 300 // 5 minutes for long answers
      default:
        return 60  // fallback
    }
  }
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([])
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [isInterviewStarted, setIsInterviewStarted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isSubmittingResponses, setIsSubmittingResponses] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<any>(null)

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    } else if (timer === 0) {
      handleNextQuestion()
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timer])

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices()
      console.log("Available voices detected:", voices.length, voices)
      const englishVoices = voices.filter(
        (voice) =>
          voice.lang.startsWith("en") &&
          (voice.name.includes("Google") || voice.name.includes("Microsoft") || voice.name.includes("Apple")),
      )
      setAvailableVoices(englishVoices)

      const preferredVoice =
        englishVoices.find(
          (voice) =>
            voice.name.includes("Google UK English Female") ||
            voice.name.includes("Microsoft Zira") ||
            voice.name.includes("Samantha") ||
            voice.name.includes("Karen") ||
            voice.name.includes("Moira"),
        ) || englishVoices[0]

      setSelectedVoice(preferredVoice)
      console.log("Selected voice for TTS:", preferredVoice?.name)
    }

    // Call loadVoices immediately and add event listener
    loadVoices()
    speechSynthesis.addEventListener("voiceschanged", loadVoices)

    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices)
    }
  }, [])

  // Automatically trigger TTS when a new question appears and interview is started
  useEffect(() => {
    if (isInterviewStarted && questions.length > 0) {
      toggleSpeech();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, isInterviewStarted]);

  // Handlers
  const handleTechStackChange = async (value: string) => {
    if (isPro) return; // Pro users do not use tech stack selector
    setTechStack(value)
    setIsLoadingQuestions(true)
    setFetchError(null)
    setQuestions([])
    setCurrentQuestion(0)
    setUserAnswers([])
    setShowResults(false)
    setIsInterviewStarted(false)
    try {
      const res = await fetch(`/api/questions?techStack=${encodeURIComponent(value)}`)
      if (!res.ok) throw new Error('Failed to fetch questions')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setQuestions(data.map(mapApiQuestionToFrontend))
      } else {
        setQuestions([])
      }
    } catch (err) {
      setFetchError('Could not load questions from server.')
      setQuestions([])
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  // For Pro users, generate questions after resume upload
  useEffect(() => {
    if (isPro && resumeText) {
      const fetchProQuestions = async () => {
        setIsLoadingQuestions(true);
        setFetchError(null);
        setQuestions([]);
        setCurrentQuestion(0);
        setUserAnswers([]);
        setShowResults(false);
        setIsInterviewStarted(false);
        try {
          const res = await fetch(`/api/questions?resumeAnalysis=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText })
          });
          if (!res.ok) throw new Error('Failed to generate questions from resume');
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mappedQuestions = data.map(mapApiQuestionToFrontend);
            setQuestions(mappedQuestions);
            // Auto-set tech stack for Pro users from the first question
            if (data[0]?.tech_stack) {
              setTechStack(data[0].tech_stack);
            }
            // Optional: Auto-start interview for Pro users (can be commented out if not desired)
            // setTimeout(() => {
            //   if (mappedQuestions.length > 0) {
            //     startInterview();
            //   }
            // }, 1000);
          } else {
            setQuestions([]);
          }
        } catch (err) {
          console.error('Error loading Pro questions:', err);
          setFetchError('Failed to generate personalized questions. Please check your internet connection and try uploading your resume again.');
          setQuestions([]);
        } finally {
          setIsLoadingQuestions(false);
        }
      };
      fetchProQuestions();
    }
  }, [isPro, resumeText]);

  // Helper: Sanitize text to remove problematic Unicode sequences
  const sanitizeText = (text: string): string => {
    if (!text) return '';
    
    // Remove null characters and other problematic control characters
    let sanitized = text.replace(/\x00/g, '');
    
    // Remove or replace problematic Unicode escape sequences
    sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, (match) => {
      try {
        return String.fromCharCode(parseInt(match.slice(2), 16));
      } catch (e) {
        return ''; // Remove invalid sequences
      }
    });
    
    // Remove other escape sequences that might cause issues
    sanitized = sanitized.replace(/\\[nrtbfav]/g, ' ');
    
    // Replace multiple whitespace with single space
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // Remove any remaining problematic characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove problematic quotes that might break JSON
    sanitized = sanitized.replace(/[\u2018\u2019]/g, "'"); // Smart single quotes
    sanitized = sanitized.replace(/[\u201C\u201D]/g, '"'); // Smart double quotes
    sanitized = sanitized.replace(/[\u2013\u2014]/g, '-'); // En/em dashes
    
    return sanitized.trim();
  };

  // Helper: Safe JSON stringify with error handling
  const safeJSONStringify = (obj: any): string => {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.error('JSON stringify error:', error);
      // Create a safer version of the object
      const safeObj = { ...obj };
      if (safeObj.extractedText) {
        safeObj.extractedText = sanitizeText(safeObj.extractedText);
      }
      return JSON.stringify(safeObj);
    }
  };

  // Helper: Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Dynamically import pdfjs-dist only in the browser
    // @ts-ignore
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return sanitizeText(text);
  };

  // Helper: Extract text from DOCX
  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return sanitizeText(value);
  };

  // Helper: Extract text from DOC (best effort, limited support)
  const extractTextFromDOC = async (file: File): Promise<string> => {
    // DOC extraction in browser is very limited; fallback to showing unsupported
    return "DOC file extraction is not supported in this browser. Please upload PDF or DOCX.";
  };

  // Helper: Get file extension
  const getFileExtension = (file: File) => file.name.split('.').pop()?.toLowerCase() || '';

  // Helper: Cache resume text in localStorage
  const cacheResumeText = (fileName: string, text: string) => {
    try {
      const sanitizedText = sanitizeText(text);
      localStorage.setItem(`resumeText:${fileName}`, sanitizedText);
    } catch (error) {
      console.error('Failed to cache resume text:', error);
    }
  };
  
  const getCachedResumeText = (fileName: string) => {
    try {
      return localStorage.getItem(`resumeText:${fileName}`) || '';
    } catch (error) {
      console.error('Failed to retrieve cached resume text:', error);
      return '';
    }
  };

  // Modified handler for resume upload
  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isPro) {
      setResumeFile(file);
      setIsExtracting(true);
      setResumeText("");
      // Check cache first
      const cached = getCachedResumeText(file.name);
      if (cached) {
        setResumeText(cached);
        setIsExtracting(false);
        return;
      }
      let text = "";
      let errorMsg = "";
      try {
        const ext = getFileExtension(file);
        if (ext === "pdf") {
          text = await extractTextFromPDF(file);
        } else if (ext === "docx") {
          text = await extractTextFromDOCX(file);
        } else {
          errorMsg = "Unsupported file type. Please upload PDF or DOCX.";
        }
      } catch (err: any) {
        errorMsg = "Failed to extract text from resume: " + (err?.message || String(err));
      }
      if (text && !errorMsg) {
        setResumeText(text);
        cacheResumeText(file.name, text);
        // Export as JSON and send to backend resumes table
        try {
          // Validate text length and content
          if (text.length === 0) {
            setFetchError('No text content found in the uploaded file');
            return;
          }
          
          if (text.length > 100000) {
            setFetchError('Resume text is too long. Please use a shorter document.');
            return;
          }
          
          // You may want to generate or retrieve a sessionId/userId here
          const sessionId = undefined; // Set if available
          const userId = undefined; // Set if available
          
          console.log('📤 Saving resume:', {
            fileName: file.name,
            textLength: text.length,
            preview: text.substring(0, 100) + '...'
          });
          
          const response = await fetch('/api/responses/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: safeJSONStringify({ fileName: file.name, extractedText: text, sessionId, userId })
          });
          
          if (!response.ok) {
            const errJson = await response.json();
            console.error('Resume save error:', errJson);
            setFetchError('Failed to save resume: ' + (errJson?.error || response.statusText));
          } else {
            const result = await response.json();
            console.log('✅ Resume saved successfully:', result);
            // Optional: Show success message
            // setFetchError('Resume saved successfully!');
          }
        } catch (err: any) {
          console.error('Resume save exception:', err);
          setFetchError('Failed to save resume: ' + (err?.message || String(err)));
        }
      } else {
        setResumeText(errorMsg);
      }
      setIsExtracting(false);
    }
  };

  const startInterview = () => {
    if (questions.length > 0) {
      setIsInterviewStarted(true)
      setTimer(getTimerDuration(questions[0].type))
      setIsTimerRunning(true)
      setCurrentAnswer("")
    }
  }

  const handleNextQuestion = useCallback(() => {
    // Save current answer
    if (currentAnswer.trim()) {
      const currentQuestionTimer = getTimerDuration(questions[currentQuestion].type)
      const newAnswer: UserAnswer = {
        questionId: questions[currentQuestion].id,
        questionText: questions[currentQuestion].question,
        questionType: questions[currentQuestion].type,
        answer: currentAnswer,
        timeSpent: currentQuestionTimer - timer,
      }
      setUserAnswers((prev) => [...prev, newAnswer])
    }

    // Move to next question or show results
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
      setCurrentAnswer("")
      setTimer(getTimerDuration(questions[currentQuestion + 1].type))
    } else {
      setIsTimerRunning(false)
      setShowResults(true)
      // Submit responses to API when interview is completed
      submitResponsesToAPI()
    }
  }, [currentAnswer, currentQuestion, questions, timer])

  const submitResponsesToAPI = async () => {
    if (userAnswers.length === 0) return;

    setIsSubmittingResponses(true);
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const requestData = {
        sessionId,
        techStack,
        responses: userAnswers,
        resumeText: resumeText ? sanitizeText(resumeText) : null,
        isPro,
        evaluateWithMistral: isPro // Only Pro users get Mistral evaluation
      };
      
      console.log('🚀 Submitting responses to API:', requestData);
      
      let requestBody;
      try {
        requestBody = safeJSONStringify(requestData);
        console.log('✅ JSON stringified successfully');
      } catch (stringifyError) {
        console.error('❌ JSON stringify error:', stringifyError);
        throw new Error('Failed to serialize request data');
      }
      
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });

      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorData = { error: errorText };
          } catch (textError) {
            errorData = { error: 'Unknown error occurred' };
          }
        }
        console.error('❌ API Error:', errorData);
        throw new Error(`Failed to submit responses: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ API Result:', result);
      
      if (result.evaluation) {
        console.log('🎯 Setting evaluation result:', result.evaluation);
        console.log('🔍 Evaluation structure:', JSON.stringify(result.evaluation, null, 2));
        setEvaluationResult(result.evaluation);
      } else {
        console.log('⚠️ No evaluation in result - will use mock data');
      }
      
      if (result.warning) {
        console.warn('Warning:', result.warning);
      }
      
      console.log('Responses submitted successfully:', result);
    } catch (error) {
      console.error('Error submitting responses:', error);
    } finally {
      setIsSubmittingResponses(false);
    }
  };

  const resetInterview = () => {
    setCurrentQuestion(0)
    setUserAnswers([])
    setCurrentAnswer("")
    setTimer(questions.length > 0 ? getTimerDuration(questions[0].type) : 60)
    setIsTimerRunning(false)
    setShowResults(false)
    setIsInterviewStarted(false)
    setEvaluationResult(null)
  }

  // Restore toggleSpeech function, ensure it only runs on client
  const toggleSpeech = () => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const questionText = questions[currentQuestion]?.question;
      if (!questionText) return;
      let voiceToUse: SpeechSynthesisVoice | null = null;
      if (isPro && selectedVoice) {
        voiceToUse = selectedVoice;
      } else {
        // Prefer 'Microsoft Zira - English (United States)' for free users if available
        voiceToUse =
          availableVoices.find(
            (v) => v.name === "Microsoft Zira - English (United States)" && v.lang === "en-US"
          ) || availableVoices[0] || null;
      }
      if (!voiceToUse) return;
      const utterance = new window.SpeechSynthesisUtterance(questionText);
      utterance.voice = voiceToUse;
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 0.8;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const currentQ = questions[currentQuestion]
  const currentQuestionTimer = questions.length > 0 ? getTimerDuration(questions[currentQuestion]?.type || 'mcq') : 60
  const progressPercentage = ((currentQuestionTimer - timer) / currentQuestionTimer) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header with Pro Toggle */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Technical Interview Simulator</h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Practice coding interviews with AI-powered feedback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="pro-toggle" className="text-sm font-medium">
              Free
            </Label>
            <Switch
              id="pro-toggle"
              checked={isPro}
              onCheckedChange={setIsPro}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-blue-600"
            />
            <Label htmlFor="pro-toggle" className="text-sm font-medium flex items-center gap-1">
              <Crown className="w-4 h-4 text-yellow-500" />
              Pro
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Setup */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tech Stack Selector - only for non-Pro users */}
            {!isPro && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Technology</CardTitle>
                  <CardDescription>Choose your interview focus area</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={techStack} onValueChange={handleTechStackChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose technology..." />
                    </SelectTrigger>
                    <SelectContent>
                      {techStacks.map((stack) => (
                        <SelectItem key={stack.value} value={stack.value}>
                          {stack.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Pro users can select from premium voices</p>
                </CardContent>
              </Card>
            )}
            {/* Resume Analysis - Pro Only */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Resume Analysis
                  {!isPro && <Lock className="w-4 h-4 text-slate-400" />}
                </CardTitle>
                <CardDescription>
                  {isPro ? "Upload your resume for personalized insights" : "Upgrade to Pro for resume analysis"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isPro ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleResumeUpload}
                        className="hidden"
                        id="resume-upload"
                      />
                      <label htmlFor="resume-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">Click to upload or drag and drop</p>
                        <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                      </label>
                    </div>
                    {isExtracting && (
                      <div className="text-sm text-blue-600">Extracting resume text...</div>
                    )}
                    {resumeFile && !isExtracting && (
                      <div className="flex flex-col gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700 dark:text-green-400">{resumeFile.name}</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded p-2 mt-2 border border-slate-200 dark:border-slate-700">
                          {resumeText ? resumeText.slice(0, 1000) + (resumeText.length > 1000 ? '...' : '') : 'No text extracted.'}
                        </div>
                      </div>
                    )}
                    {isLoadingQuestions && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-blue-700 dark:text-blue-400">Generating personalized questions based on your resume...</span>
                      </div>
                    )}
                    {fetchError && (
                      <div className="text-red-600 text-xs mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">{fetchError}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 mb-3">
                      Resume analysis is a Pro feature
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPro(true)}
                      className="border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      Upgrade to Pro
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interview Stats */}
            {(techStack || (isPro && isLoadingQuestions)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interview Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingQuestions && isPro ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Preparing interview questions...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Questions:</span>
                        <span className="text-sm font-medium">{questions.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Time per question:</span>
                        <span className="text-sm font-medium">60 seconds</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Difficulty:</span>
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {questions.map((q) => (
                            <Badge
                              key={q.id}
                              variant={
                                q.difficulty === "easy"
                                  ? "secondary"
                                  : q.difficulty === "medium"
                                    ? "default"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {q.difficulty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Interview */}
          <div className="lg:col-span-2">
            {!isInterviewStarted && !showResults ? (
              /* Start Screen */
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-6">
                    {isLoadingQuestions && isPro ? (
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                    ) : (
                      <Play className="w-10 h-10 text-white" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-4">
                    {isLoadingQuestions && isPro ? "Generating Questions..." : "Ready to Start?"}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                    {isLoadingQuestions && isPro 
                      ? "AI is analyzing your resume and creating personalized interview questions. This may take a moment..."
                      : isPro && questions.length > 0
                      ? `You'll answer ${questions.length} personalized questions based on your resume. MCQ questions (1.5 min), short answers (3 min), and long answers (5 min).`
                      : techStack
                      ? `You'll answer ${questions.length} ${techStack} questions. MCQ questions (1.5 min), short answers (3 min), and long answers (5 min).`
                      : isPro 
                      ? "Upload your resume to generate personalized interview questions."
                      : "Select a technology stack to begin your interview simulation."}
                  </p>
                  <Button
                    onClick={startInterview}
                    disabled={isPro ? (questions.length === 0 || isLoadingQuestions) : (!techStack || questions.length === 0)}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isLoadingQuestions && isPro ? "Generating Questions..." : "Start Interview"}
                  </Button>
                </CardContent>
              </Card>
            ) : showResults ? (
              /* Results Screen */
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {isSubmittingResponses ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          Analyzing Responses...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-600" />
                          Interview Complete!
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isPro && evaluationResult 
                        ? "AI-powered answer corrections and explanations" 
                        : isPro && isSubmittingResponses 
                          ? "AI is analyzing your responses..." 
                          : "Here's your performance summary"
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center">
                      {isSubmittingResponses ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="text-slate-600 dark:text-slate-400">Analyzing your responses...</span>
                        </div>
                      ) : evaluationResult ? (
                        <div>
                          <div className="text-2xl font-bold text-blue-600 mb-2">
                            ✓ Correct Answers Available
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-blue-600">
                              <Crown className="w-3 h-3 mr-1" />
                              AI Corrections
                            </Badge>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 mt-2">
                            AI-powered answer corrections complete
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-4xl font-bold text-green-600 mb-2">
                            {evaluationResult?.evaluation?.overallScore || mockFeedback.score}%
                          </div>
                          <p className="text-slate-600 dark:text-slate-400">
                            {userAnswers.length} of {evaluationResult?.evaluation?.totalQuestions || mockFeedback.totalQuestions} questions answered
                          </p>
                          {evaluationResult?.evaluation?.passFailStatus && (
                            <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium inline-block ${
                              evaluationResult.evaluation.passFailStatus === 'PASS' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {evaluationResult.evaluation.passFailStatus}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Display evaluation results */}
                    {evaluationResult?.evaluation ? (
                      <div className="space-y-6 mt-6">
                        {/* Detailed Scores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">MCQ Score</h4>
                            <div className="text-2xl font-bold text-blue-600">{evaluationResult.evaluation.mcqScore}%</div>
                          </div>
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">Written Answers</h4>
                            <div className="text-2xl font-bold text-purple-600">{evaluationResult.evaluation.writtenAnswerScore}/10</div>
                          </div>
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Technical Rating</h4>
                            <div className="text-2xl font-bold text-green-600">{evaluationResult.evaluation.technicalRating}/10</div>
                          </div>
                        </div>

                        {/* Strengths and Weaknesses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                              Strengths
                            </h4>
                            <ul className="space-y-1">
                              {(evaluationResult.evaluation.strengths || []).map((strength: any, index: number) => (
                                <li
                                  key={index}
                                  className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  {typeof strength === 'string' ? strength : 
                                    typeof strength === 'object' && strength !== null ? 
                                      `${strength.strength || strength.description || 'Strength identified'}` :
                                      'Strength identified'
                                  }
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">
                              Areas for Improvement
                            </h4>
                            <ul className="space-y-1">
                              {(evaluationResult.evaluation.weaknesses || []).map((weakness: any, index: number) => (
                                <li
                                  key={index}
                                  className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                                >
                                  <XCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                  {typeof weakness === 'string' ? weakness : 
                                    typeof weakness === 'object' && weakness !== null ? 
                                      `${weakness.weakness || weakness.description || 'Area for improvement'}` :
                                      'Area for improvement'
                                  }
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* MCQ Analysis */}
                        {evaluationResult.evaluation?.mcqAnalysis && evaluationResult.evaluation.mcqAnalysis.length > 0 && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-3">
                              📊 MCQ Analysis
                            </h4>
                            <div className="space-y-3">
                              {evaluationResult.evaluation.mcqAnalysis.map((mcq: any, index: number) => (
                                <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                                  <div className="flex items-start gap-2 mb-1">
                                    <span className="text-sm font-medium text-blue-600">Q{mcq.questionNumber}:</span>
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{mcq.question}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Your Answer:</span>
                                    <span className="font-medium">{mcq.userAnswer}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      mcq.isCorrect 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                      {mcq.status}
                                    </span>
                                  </div>
                                  {!mcq.isCorrect && (
                                    <div className="mt-2 text-sm">
                                      <span className="text-green-600 dark:text-green-400 font-medium">Correct Answer: </span>
                                      <span className="text-slate-700 dark:text-slate-300">{mcq.correctAnswer}</span>
                                      {mcq.explanation && (
                                        <div className="mt-1 text-slate-600 dark:text-slate-400 italic">
                                          {mcq.explanation}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Written Answer Analysis */}
                        {evaluationResult.evaluation?.writtenAnswerAnalysis && evaluationResult.evaluation.writtenAnswerAnalysis.length > 0 && (
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-3">
                              📝 Written Answer Analysis
                            </h4>
                            <div className="space-y-4">
                              {evaluationResult.evaluation.writtenAnswerAnalysis.map((analysis: any, index: number) => (
                                <div key={index} className="border-l-4 border-purple-200 pl-4 py-2">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-sm font-medium text-purple-600">Q{analysis.questionNumber}:</span>
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{analysis.questionText}</span>
                                    <span className="text-sm font-medium text-purple-600">Score: {analysis.score}/10</span>
                                  </div>
                                  
                                  {analysis.whatIsCorrect && (
                                    <div className="mb-2">
                                      <span className="text-green-600 dark:text-green-400 font-medium text-sm">✅ What's Correct: </span>
                                      <span className="text-slate-700 dark:text-slate-300 text-sm">{analysis.whatIsCorrect}</span>
                                    </div>
                                  )}
                                  
                                  {analysis.whatIsMissing && (
                                    <div className="mb-2">
                                      <span className="text-orange-600 dark:text-orange-400 font-medium text-sm">⚠️ What's Missing: </span>
                                      <span className="text-slate-700 dark:text-slate-300 text-sm">{analysis.whatIsMissing}</span>
                                    </div>
                                  )}
                                  
                                  {analysis.modelAnswer && (
                                    <div className="mb-2">
                                      <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">📖 Model Answer: </span>
                                      <div className="text-slate-700 dark:text-slate-300 text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">
                                        {analysis.modelAnswer}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {analysis.feedback && (
                                    <div className="text-sm text-slate-600 dark:text-slate-400 italic">
                                      💡 {analysis.feedback}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Detailed Feedback */}
                        {evaluationResult.evaluation?.detailedFeedback && (
                          <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-400 mb-3">
                              📋 Detailed Analysis
                            </h4>
                            {evaluationResult.evaluation?.detailedFeedback?.questionAnalysis && (
                              <div className="mb-4">
                                <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">Question Analysis:</h5>
                                <ul className="space-y-1 text-sm">
                                  {evaluationResult.evaluation.detailedFeedback.questionAnalysis.map((analysis: any, index: number) => (
                                    <li key={index} className="text-slate-600 dark:text-slate-400">
                                      • {typeof analysis === 'string' ? analysis : 
                                          typeof analysis === 'object' && analysis !== null ? 
                                            `Question ${index + 1}: ${analysis.question || analysis.analysis || 'Analysis available'}` :
                                            'Analysis data available'
                                        }
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {evaluationResult.evaluation?.detailedFeedback?.recommendations && (
                              <div className="mb-4">
                                <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">Recommendations:</h5>
                                <ul className="space-y-1 text-sm">
                                  {evaluationResult.evaluation.detailedFeedback.recommendations.map((rec: any, index: number) => (
                                    <li key={index} className="text-slate-600 dark:text-slate-400">
                                      • {typeof rec === 'string' ? rec : 
                                          typeof rec === 'object' && rec !== null ? 
                                            `${rec.title || rec.recommendation || 'Recommendation available'}` :
                                            'Recommendation available'
                                        }
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {evaluationResult.evaluation?.detailedFeedback?.nextSteps && (
                              <div className="mb-4">
                                <h5 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">Next Steps:</h5>
                                <ul className="space-y-1 text-sm">
                                  {evaluationResult.evaluation.detailedFeedback.nextSteps.map((step: any, index: number) => (
                                    <li key={index} className="text-slate-600 dark:text-slate-400">
                                      • {typeof step === 'string' ? step : 
                                          typeof step === 'object' && step !== null ? 
                                            `${step.step || step.action || 'Next step available'}` :
                                            'Next step available'
                                        }
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                            Strengths
                          </h4>
                          <ul className="space-y-1">
                            {mockFeedback.strengths.map((strength: string, index: number) => (
                              <li
                                key={index}
                                className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                              >
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">
                            Areas for Improvement
                          </h4>
                          <ul className="space-y-1">
                            {mockFeedback.improvements.map((improvement: string, index: number) => (
                              <li
                                key={index}
                                className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                              >
                                <XCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                {improvement}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <Button onClick={resetInterview} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Take Another Interview
                    </Button>
                  </CardContent>
                </Card>

                {/* Resume Insights - Pro Only */}
                <Card className={cn(!isPro && "opacity-60")}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Resume Insights
                      {!isPro && <Lock className="w-4 h-4 text-slate-400" />}
                    </CardTitle>
                    <CardDescription>
                      {isPro
                        ? "AI-powered analysis of your resume vs interview performance"
                        : "Upgrade to Pro for detailed resume insights"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isPro && resumeFile ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Resume Match Score</span>
                          <span className="text-2xl font-bold text-blue-600">
                            {mockFeedback.resumeInsights?.matchScore}%
                          </span>
                        </div>
                        <Separator />
                        <div>
                          <h5 className="font-medium mb-2">Missing Skills</h5>
                          <div className="flex flex-wrap gap-2">
                            {mockFeedback.resumeInsights?.missingSkills.map((skill) => (
                              <Badge key={skill} variant="outline">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium mb-2">Recommendations</h5>
                          <ul className="space-y-1">
                            {mockFeedback.resumeInsights?.recommendations.map((rec, index) => (
                              <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                                • {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-3">
                          {!isPro ? "Resume insights are a Pro feature" : "Upload a resume to see insights"}
                        </p>
                        {!isPro && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPro(true)}
                            className="border-purple-200 text-purple-700 hover:bg-purple-50"
                          >
                            Upgrade to Pro
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Interview Screen */
              <div className="space-y-4">
                {/* Interview Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Interview Details</CardTitle>
                    <CardDescription>Current session information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Tech Stack</p>
                        <p className="font-medium text-sm break-words overflow-wrap-anywhere">
                          {techStack || 'Not selected'}
                        </p>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Questions</p>
                        <p className="font-medium text-sm break-words">
                          {questions.length} total
                        </p>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <p className="font-medium text-sm break-words">
                          {currentQuestion + 1} of {questions.length}
                        </p>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Mode</p>
                        <p className="font-medium text-sm break-words">
                          {isPro ? 'Pro' : 'Basic'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Question Card */}
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          Question {currentQuestion + 1} of {questions.length}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              currentQ?.difficulty === "easy"
                                ? "secondary"
                                : currentQ?.difficulty === "medium"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {currentQ?.difficulty}
                          </Badge>
                          <span>•</span>
                          <span>{currentQ?.category}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Voice Animation and TTS Button */}
                        <div className="relative flex items-center">
                          <VoiceAnimation isActive={isSpeaking} size="sm" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSpeech}
                            className="rounded-full bg-transparent hover:bg-transparent"
                            title={isSpeaking ? "Stop reading" : `Read question aloud${!isPro ? " (Basic voice)" : ""}`}
                          >
                            <span className="sr-only">{isSpeaking ? "Stop reading" : "Read question aloud"}</span>
                            <Volume2 className="w-5 h-5 text-blue-600" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4" />
                          <span className={cn("font-mono", timer <= 10 && "text-red-600")}>
                            {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="mt-4" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                      <p className="text-lg leading-relaxed">{currentQ?.question}</p>
                    </div>

                    {currentQ?.type === "mcq" && currentQ.options && (
                      <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer}>
                        {currentQ.options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                            <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {currentQ?.type === "short" && (
                      <Textarea
                        placeholder="Type your answer here..."
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        className="min-h-[120px]"
                      />
                    )}

                    {currentQ?.type === "long" && (
                      <Textarea
                        placeholder="Provide a detailed explanation..."
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        className="min-h-[200px]"
                      />
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setIsTimerRunning(!isTimerRunning)}>
                        {isTimerRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isTimerRunning ? "Pause" : "Resume"}
                      </Button>
                      <Button onClick={handleNextQuestion} disabled={!currentAnswer.trim()}>
                        {currentQuestion === questions.length - 1 ? "Finish Interview" : "Next Question"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
