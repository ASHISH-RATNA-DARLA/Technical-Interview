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
            setQuestions(data.map(mapApiQuestionToFrontend));
          } else {
            setQuestions([]);
          }
        } catch (err) {
          setFetchError('Could not load questions from server.');
          setQuestions([]);
        } finally {
          setIsLoadingQuestions(false);
        }
      };
      fetchProQuestions();
    }
  }, [isPro, resumeText]);

  // Helper: Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Dynamically import pdfjs-dist only in the browser
    // @ts-ignore
    const pdfjsLib = await import("pdfjs-dist/build/pdf");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text;
  };

  // Helper: Extract text from DOCX
  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
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
    localStorage.setItem(`resumeText:${fileName}`, text);
  };
  const getCachedResumeText = (fileName: string) => {
    return localStorage.getItem(`resumeText:${fileName}`) || '';
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
          // You may want to generate or retrieve a sessionId/userId here
          const sessionId = undefined; // Set if available
          const userId = undefined; // Set if available
          const response = await fetch('/api/responses/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, extractedText: text, sessionId, userId })
          });
          if (!response.ok) {
            const errJson = await response.json();
            setFetchError('Failed to save resume: ' + (errJson?.error || response.statusText));
          }
        } catch (err: any) {
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
      setTimer(60)
      setIsTimerRunning(true)
      setCurrentAnswer("")
    }
  }

  const handleNextQuestion = useCallback(() => {
    // Save current answer
    if (currentAnswer.trim()) {
      const newAnswer: UserAnswer = {
        questionId: questions[currentQuestion].id,
        questionText: questions[currentQuestion].question,
        questionType: questions[currentQuestion].type,
        answer: currentAnswer,
        timeSpent: 60 - timer,
      }
      setUserAnswers((prev) => [...prev, newAnswer])
    }

    // Move to next question or show results
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
      setCurrentAnswer("")
      setTimer(60)
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
      
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          techStack,
          responses: userAnswers,
          resumeText: resumeText || null,
          isPro,
          evaluateWithMistral: isPro // Only Pro users get Mistral evaluation
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit responses');
      }

      const result = await response.json();
      if (result.evaluation) {
        setEvaluationResult(result.evaluation);
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
    setTimer(60)
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
  const progressPercentage = ((60 - timer) / 60) * 100

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
                      {techStacks.map((tech) => (
                        <SelectItem key={tech.value} value={tech.value}>
                          <div className="flex items-center gap-2">
                            <span>{tech.icon}</span>
                            {tech.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isLoadingQuestions && (
                    <div className="text-blue-600 text-sm mt-2">Loading questions...</div>
                  )}
                  {fetchError && (
                    <div className="text-red-600 text-xs mt-1">{fetchError}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Voice Assistant */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Voice Assistant
                  {!isPro && (
                    <Badge variant="secondary" className="ml-2">
                      Basic
                    </Badge>
                  )}
                  {isPro && (
                    <Badge variant="default" className="ml-2 bg-gradient-to-r from-purple-600 to-blue-600">
                      Pro
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isPro
                    ? "Choose your preferred voice for question reading"
                    : "Basic voice reading available - upgrade for voice selection"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isPro ? (
                  <div className="space-y-4">
                    <Select
                      value={selectedVoice?.name || ""}
                      onValueChange={(value) => {
                        const voice = availableVoices.find((v) => v.name === value)
                        setSelectedVoice(voice || null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.name} value={voice.name}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {voice.lang}
                              </span>
                              {voice.name.replace(/Microsoft|Google|Apple/g, "").trim()}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Pro users can select from premium voices</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Volume2 className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Basic Voice Available</p>
                        <p className="text-xs text-slate-500">
                          Questions will be read using your system's default voice
                        </p>
                      </div>
                    </div>
                    <div className="text-center py-4 border-t border-slate-200 dark:border-slate-700">
                      <Lock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 mb-3">Voice selection is a Pro feature</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPro(true)}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        Upgrade for Voice Selection
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resume Upload */}
            <Card className={cn(!isPro && "opacity-60")}>
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
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 mb-3">Resume analysis is a Pro feature</p>
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
            {techStack && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interview Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Questions:</span>
                    <span className="text-sm font-medium">{questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Time per question:</span>
                    <span className="text-sm font-medium">60 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Difficulty:</span>
                    <div className="flex gap-1">
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
                    <Play className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                    {techStack
                      ? `You'll answer ${questions.length} ${techStack} questions. Each question has a 60-second timer.`
                      : "Select a technology stack to begin your interview simulation."}
                  </p>
                  <Button
                    onClick={startInterview}
                    disabled={!techStack || questions.length === 0}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Start Interview
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
                          ? "AI-powered evaluation complete" 
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
                          <div className="text-4xl font-bold text-green-600 mb-2">
                            {evaluationResult.overallScore || mockFeedback.score}%
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-blue-600">
                              <Crown className="w-3 h-3 mr-1" />
                              AI Evaluation
                            </Badge>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 mt-2">
                            AI-powered evaluation complete
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-4xl font-bold text-green-600 mb-2">{mockFeedback.score}%</div>
                          <p className="text-slate-600 dark:text-slate-400">
                            {userAnswers.length} of {mockFeedback.totalQuestions} questions answered
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                          {evaluationResult ? 'AI-Identified Strengths' : 'Strengths'}
                        </h4>
                        <ul className="space-y-1">
                          {(evaluationResult?.strengths || mockFeedback.strengths).map((strength: string, index: number) => (
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
                          {evaluationResult ? 'AI-Identified Areas for Improvement' : 'Areas for Improvement'}
                        </h4>
                        <ul className="space-y-1">
                          {(evaluationResult?.improvements || mockFeedback.improvements).map((improvement: string, index: number) => (
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

                    {evaluationResult?.detailedFeedback && (
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          Detailed AI Feedback
                        </h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {evaluationResult.detailedFeedback}
                        </p>
                      </div>
                    )}

                    {evaluationResult?.recommendations && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          AI Recommendations
                        </h4>
                        <ul className="space-y-1">
                          {evaluationResult.recommendations.map((rec: string, index: number) => (
                            <li
                              key={index}
                              className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                            >
                              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}