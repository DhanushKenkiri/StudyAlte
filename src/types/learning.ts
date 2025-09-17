// Learning-related types and interfaces

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type QuestionType = 'multiple-choice' | 'short-answer' | 'true-false';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Video and Transcript Types
export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: string;
  channelName: string;
  publishedAt: Date;
  viewCount: number;
  language: string;
}

export interface Transcript {
  id: string;
  videoId: string;
  segments: TranscriptSegment[];
  language: string;
  confidence: number;
  generatedAt: Date;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  confidence: number;
  speaker?: string;
}

// Summary Types
export interface Summary {
  id: string;
  keyPoints: string[];
  mainConcepts: string[];
  learningObjectives: string[];
  estimatedReadTime: number; // in minutes
  difficulty: DifficultyLevel;
  generatedAt: Date;
}

// Flashcard Types
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: number; // 1-5 scale
  nextReview: Date;
  reviewCount: number;
  correctCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardReview {
  cardId: string;
  userId: string;
  difficulty: number; // 1-5 (1=easy, 5=hard)
  correct: boolean;
  timeSpent: number; // in seconds
  reviewedAt: Date;
}

// Quiz Types
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for multiple-choice
  correctAnswer: string;
  explanation: string;
  difficulty: number; // 1-5 scale
  tags: string[];
  timeLimit?: number; // in seconds
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  timeLimit?: number; // in seconds
  passingScore: number; // percentage
  attempts: QuizAttempt[];
  createdAt: Date;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  answers: QuizAnswer[];
  score: number; // percentage
  timeSpent: number; // in seconds
  completedAt: Date;
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
  correct: boolean;
  timeSpent: number; // in seconds
}

export interface QuizResults {
  attemptId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  answers: QuizAnswer[];
  feedback: string[];
}

// Mind Map Types
export interface MindMapNode {
  id: string;
  label: string;
  type: 'concept' | 'topic' | 'subtopic' | 'detail';
  x: number;
  y: number;
  color?: string;
  size?: number;
  children: string[]; // node IDs
  metadata?: Record<string, unknown>;
}

export interface MindMapEdge {
  id: string;
  source: string; // node ID
  target: string; // node ID
  label?: string;
  type: 'hierarchy' | 'association' | 'dependency';
  weight?: number;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  layout: 'hierarchical' | 'radial' | 'force-directed';
  createdAt: Date;
  updatedAt: Date;
}

// Notes Types
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  highlights: NoteHighlight[];
  annotations: NoteAnnotation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteHighlight {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  color: string;
  timestamp?: number; // video timestamp if applicable
}

export interface NoteAnnotation {
  id: string;
  text: string;
  position: number; // character position in note
  timestamp?: number; // video timestamp if applicable
  createdAt: Date;
}

// Learning Capsule Types
export interface LearningCapsule {
  id: string;
  userId: string;
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  category: string;
  difficulty: DifficultyLevel;
  
  // Generated Content
  summary: Summary;
  flashcards: Flashcard[];
  quiz: Quiz;
  notes: Note[];
  mindMap?: MindMap;
  transcript: Transcript;
  
  // Progress Tracking
  progress: CapsuleProgress;
  lastAccessed: Date;
  
  // Processing Status
  processingStatus: ProcessingStatus;
  processingProgress: number; // 0-100
  processingError?: string;
}

export interface CapsuleProgress {
  capsuleId: string;
  completionPercentage: number;
  timeSpent: number; // in seconds
  flashcardsReviewed: number;
  flashcardsTotal: number;
  quizzesTaken: number;
  quizzesTotal: number;
  notesCreated: number;
  lastSection: string;
  sectionsCompleted: string[];
  updatedAt: Date;
}

// Processing Job Types
export interface ProcessingJob {
  jobId: string;
  userId: string;
  videoUrl: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  estimatedCompletion?: Date;
  result?: LearningCapsule;
  error?: ProcessingError;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}