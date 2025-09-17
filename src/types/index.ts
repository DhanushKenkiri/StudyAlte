// Main types export file

// User types
export * from './user';

// Learning types
export * from './learning';

// Progress types
export * from './progress';

// API types
export * from './api';

// Error types
export * from './errors';

// UI types
export * from './ui';

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Generic utility types
export type ID = string;
export type Timestamp = Date;
export type URL = string;
export type Email = string;

// Environment types
export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  AWS_REGION: string;
  AWS_USER_POOL_ID: string;
  AWS_USER_POOL_CLIENT_ID: string;
  AWS_IDENTITY_POOL_ID: string;
  API_BASE_URL: string;
  YOUTUBE_API_KEY: string;
  // AWS Bedrock is used instead of OpenAI for all AI services
}

// Configuration types
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  aws: {
    region: string;
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId: string;
  };
  features: {
    enableOfflineMode: boolean;
    enableAnalytics: boolean;
    enableNotifications: boolean;
    maxVideoLength: number; // in seconds
    maxConcurrentProcessing: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
}

// Constants
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const QUESTION_TYPES = ['multiple-choice', 'short-answer', 'true-false'] as const;
export const PROCESSING_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export const SUBSCRIPTION_TIERS = ['free', 'premium', 'enterprise'] as const;
export const ACTIVITY_TYPES = [
  'video_processed',
  'flashcard_reviewed',
  'quiz_taken',
  'note_created',
  'capsule_completed',
  'study_session_started',
  'study_session_ended',
] as const;