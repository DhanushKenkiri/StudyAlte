import { ReactNode } from 'react';
import { Theme } from '@mui/material/styles';
import { LearningCapsule, Flashcard, Quiz, Question } from './learning';
import { User } from './user';

export interface AppTheme extends Theme 
{
  custom: {
    sidebar: {
      width: number;
      collapsedWidth: number;
    };
    header: {
      height: number;
    };
    colors: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
}

export type ThemeMode = 'light' | 'dark' | 'system';

// Layout Component Props
export interface MainLayoutProps 
{
  children: ReactNode;
  sidebar?: boolean;
  user: User;
}

export interface SidebarProps 
{
  open: boolean;
  onClose: () => void;
  capsules: LearningCapsule[];
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export interface HeaderProps 
{
  user: User;
  onMenuClick: () => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
}

// Navigation Types
export interface NavigationItem 
{
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
  children?: NavigationItem[];
}

export interface BreadcrumbItem 
{
  label: string;
  path?: string;
  icon?: string;
}

// Form Types
export interface FormFieldProps 
{
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
  options?: Array<{ value: string; label: string }>;
  multiline?: boolean;
  rows?: number;
}

export interface FormState<T = Record<string, unknown>> 
{
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Video Input Component Props
export interface VideoInputProps 
{
  onVideoSubmit: (url: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  placeholder?: string;
  helperText?: string;
}

// Learning Capsule Component Props
export interface LearningCapsuleProps 
{
  capsule: LearningCapsule;
  onUpdate: (capsule: LearningCapsule) => void;
  onDelete?: (capsuleId: string) => void;
  compact?: boolean;
}

export interface CapsuleCardProps 
{
  capsule: LearningCapsule;
  onClick: (capsule: LearningCapsule) => void;
  onEdit?: (capsule: LearningCapsule) => void;
  onDelete?: (capsuleId: string) => void;
  showProgress?: boolean;
}

// Flashcard Component Props
export interface FlashcardProps 
{
  cards: Flashcard[];
  onProgress: (cardId: string, difficulty: number, correct: boolean) => void;
  spacedRepetition?: boolean;
  showProgress?: boolean;
  autoAdvance?: boolean;
}

export interface FlashcardItemProps 
{
  card: Flashcard;
  onReview: (difficulty: number, correct: boolean) => void;
  showAnswer: boolean;
  onToggleAnswer: () => void;
}

// Quiz Component Props
export interface QuizProps 
{
  quiz: Quiz;
  onComplete: (results: QuizResults) => void;
  timeLimit?: number;
  showProgress?: boolean;
}

export interface QuestionProps 
{
  question: Question;
  answer?: string;
  onAnswerChange: (answer: string) => void;
  showResult?: boolean;
  disabled?: boolean;
  timeRemaining?: number;
}

export interface QuizResults 
{
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  answers: Array<{
    questionId: string;
    answer: string;
    correct: boolean;
  }>;
}

// AI Tutor Component Props
export interface AITutorProps 
{
  capsuleId: string;
  context?: string;
  onMessage: (message: string) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
}

export interface ChatMessageProps 
{
  message: {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    references?: Array<{
      type: string;
      snippet: string;
    }>;
  };
  onReferenceClick?: (reference: { type: string; id: string }) => void;
}

// Progress Component Props
export interface ProgressDashboardProps 
{
  stats: {
    totalStudyTime: number;
    capsulesCompleted: number;
    currentStreak: number;
    weeklyGoal: number;
    weeklyProgress: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }>;
  goals: Array<{
    id: string;
    title: string;
    progress: number;
    target: number;
    deadline: Date;
  }>;
}

export interface ProgressChartProps 
{
  data: Array<{
    date: string;
    value: number;
    label?: string;
  }>;
  type: 'line' | 'bar' | 'area';
  title: string;
  color?: string;
  height?: number;
}

// Search Component Props
export interface SearchProps 
{
  onSearch: (query: string, filters?: SearchFilters) => void;
  loading?: boolean;
  placeholder?: string;
  showFilters?: boolean;
  initialQuery?: string;
}

export interface SearchFilters {
  type?: ('capsule' | 'flashcard' | 'note' | 'quiz')[];
  category?: string[];
  tags?: string[];
  difficulty?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SearchResultProps {
  result: {
    id: string;
    type: string;
    title: string;
    snippet: string;
    relevance: number;
  };
  onClick: (result: { id: string; type: string }) => void;
  onPreview?: (result: { id: string; type: string }) => void;
}

// Modal and Dialog Props
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
  actions?: ReactNode;
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'info' | 'warning' | 'error';
}

// Loading and Error States
export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'inherit';
  message?: string;
}

export interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  severity?: 'error' | 'warning' | 'info';
  variant?: 'standard' | 'filled' | 'outlined';
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Table and List Props
export interface DataTableProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
  sorting?: {
    field: keyof T;
    direction: 'asc' | 'desc';
    onSort: (field: keyof T, direction: 'asc' | 'desc') => void;
  };
  selection?: {
    selected: string[];
    onSelectionChange: (selected: string[]) => void;
  };
}

export interface TableColumn<T = unknown> {
  id: keyof T;
  label: string;
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T) => ReactNode;
}

// Notification Types
export interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  onClose: (id: string) => void;
}

// Animation and Transition Types
export interface AnimationProps {
  duration?: number;
  delay?: number;
  easing?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export interface TransitionProps {
  in: boolean;
  timeout?: number;
  appear?: boolean;
  enter?: boolean;
  exit?: boolean;
  children: ReactNode;
}