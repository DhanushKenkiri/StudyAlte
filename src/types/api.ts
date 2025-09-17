// API request and response types

import { LearningCapsule, ProcessingJob, Quiz, Flashcard } from './learning';
import { User, CreateUserRequest, ProfileUpdate } from './user';
import { UserProgress, DailyStats, Goal, Achievement } from './progress';

// Generic API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string; // for validation errors
}

// Authentication API Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
  };
}

export interface RegisterRequest extends CreateUserRequest {}

export interface RegisterResponse {
  user: User;
  requiresVerification: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

// Video Processing API Types
export interface ProcessVideoRequest {
  url: string;
  options?: {
    generateFlashcards?: boolean;
    generateQuiz?: boolean;
    generateMindMap?: boolean;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    language?: string;
  };
}

export interface ProcessVideoResponse {
  job: ProcessingJob;
}

export interface GetProcessingJobResponse {
  job: ProcessingJob;
}

// Capsule API Types
export interface GetCapsulesRequest {
  page?: number;
  limit?: number;
  category?: string;
  tags?: string[];
  difficulty?: string;
  sortBy?: 'created' | 'updated' | 'title' | 'progress';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface GetCapsulesResponse extends PaginatedResponse<LearningCapsule> {}

export interface GetCapsuleResponse {
  capsule: LearningCapsule;
}

export interface UpdateCapsuleRequest {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
}

export interface UpdateCapsuleResponse {
  capsule: LearningCapsule;
}

// Flashcard API Types
export interface ReviewFlashcardRequest {
  cardId: string;
  difficulty: number; // 1-5
  correct: boolean;
  timeSpent: number;
}

export interface ReviewFlashcardResponse {
  card: Flashcard;
  nextReviewDate: Date;
}

export interface GetFlashcardsForReviewRequest {
  capsuleId?: string;
  limit?: number;
  difficulty?: number;
}

export interface GetFlashcardsForReviewResponse {
  flashcards: Flashcard[];
  totalDue: number;
}

// Quiz API Types
export interface StartQuizRequest {
  quizId: string;
}

export interface StartQuizResponse {
  attemptId: string;
  quiz: Quiz;
  timeLimit?: number;
}

export interface SubmitQuizAnswerRequest {
  attemptId: string;
  questionId: string;
  answer: string;
  timeSpent: number;
}

export interface SubmitQuizAnswerResponse {
  correct: boolean;
  explanation?: string;
}

export interface CompleteQuizRequest {
  attemptId: string;
}

export interface CompleteQuizResponse {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  feedback: string[];
}

// Progress API Types
export interface GetProgressRequest {
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  includeInsights?: boolean;
}

export interface GetProgressResponse {
  progress: UserProgress;
  dailyStats: DailyStats[];
  insights?: Array<{
    type: string;
    message: string;
    data: Record<string, unknown>;
  }>;
}

export interface UpdateGoalRequest {
  goalId: string;
  target?: number;
  deadline?: Date;
  status?: 'active' | 'paused';
}

export interface UpdateGoalResponse {
  goal: Goal;
}

export interface CreateGoalRequest {
  type: 'daily_study_time' | 'weekly_capsules' | 'flashcard_reviews' | 'quiz_scores';
  title: string;
  description?: string;
  target: number;
  deadline: Date;
}

export interface CreateGoalResponse {
  goal: Goal;
}

// Search API Types
export interface SearchRequest {
  query: string;
  filters?: {
    type?: ('capsule' | 'flashcard' | 'note' | 'quiz')[];
    category?: string[];
    tags?: string[];
    difficulty?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: 'capsule' | 'flashcard' | 'note' | 'quiz';
  title: string;
  snippet: string;
  relevance: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse extends PaginatedResponse<SearchResult> {
  suggestions?: string[];
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

// Chat API Types
export interface SendChatMessageRequest {
  capsuleId: string;
  message: string;
  context?: {
    timestamp?: number;
    section?: string;
    previousMessages?: string[];
  };
}

export interface SendChatMessageResponse {
  messageId: string;
  response: string;
  references?: Array<{
    type: 'transcript' | 'note' | 'flashcard';
    id: string;
    snippet: string;
    timestamp?: number;
  }>;
  suggestions?: string[];
}

export interface GetChatHistoryRequest {
  capsuleId: string;
  limit?: number;
  before?: string; // message ID
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: Array<{
    type: string;
    id: string;
    snippet: string;
  }>;
}

export interface GetChatHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

// Export API Types
export interface ExportDataRequest {
  format: 'json' | 'csv' | 'pdf';
  includeProgress?: boolean;
  includeNotes?: boolean;
  includeFlashcards?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportDataResponse {
  downloadUrl: string;
  expiresAt: Date;
  fileSize: number;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
}