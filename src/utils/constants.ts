// Application constants

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// AWS Configuration
export const AWS_CONFIG = {
  REGION: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  USER_POOL_ID: import.meta.env.VITE_AWS_USER_POOL_ID || '',
  USER_POOL_CLIENT_ID: import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID || '',
  IDENTITY_POOL_ID: import.meta.env.VITE_AWS_IDENTITY_POOL_ID || '',
} as const;

// External API Keys
export const EXTERNAL_APIS = {
  YOUTUBE_API_KEY: import.meta.env.VITE_YOUTUBE_API_KEY || '',
  // AWS Bedrock is used instead of OpenAI for all AI services
  // This is configured in the backend Lambda functions
} as const;

// Application Limits
export const LIMITS = {
  MAX_VIDEO_DURATION: 3600, // 1 hour in seconds
  MAX_CONCURRENT_PROCESSING: 3,
  MAX_FLASHCARDS_PER_CAPSULE: 100,
  MAX_QUIZ_QUESTIONS: 50,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_SEARCH_RESULTS: 100,
  MAX_CHAT_HISTORY: 50,
  MAX_TAGS_PER_ITEM: 10,
  MAX_GOALS_PER_USER: 20,
} as const;

// UI Constants
export const UI_CONFIG = {
  SIDEBAR_WIDTH: 280,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  HEADER_HEIGHT: 64,
  FOOTER_HEIGHT: 48,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1200,
} as const;

// Animation Durations (in milliseconds)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  EXTRA_SLOW: 1000,
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'yt_learning_auth_token',
  REFRESH_TOKEN: 'yt_learning_refresh_token',
  USER_PREFERENCES: 'yt_learning_user_preferences',
  THEME: 'yt_learning_theme',
  LANGUAGE: 'yt_learning_language',
  SIDEBAR_STATE: 'yt_learning_sidebar_state',
  RECENT_SEARCHES: 'yt_learning_recent_searches',
  DRAFT_NOTES: 'yt_learning_draft_notes',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  VIDEO_PROCESSING_FAILED: 'Failed to process the video. Please try again.',
  INVALID_YOUTUBE_URL: 'Please enter a valid YouTube URL.',
  VIDEO_TOO_LONG: 'Video is too long. Maximum duration is 1 hour.',
  QUOTA_EXCEEDED: 'You have reached your processing limit. Please upgrade your plan.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  REGISTRATION_SUCCESS: 'Account created successfully! Please verify your email.',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  VIDEO_PROCESSING_STARTED: 'Video processing started. You will be notified when complete.',
  FLASHCARD_REVIEWED: 'Flashcard reviewed successfully!',
  QUIZ_COMPLETED: 'Quiz completed successfully!',
  NOTE_SAVED: 'Note saved successfully!',
  GOAL_CREATED: 'Goal created successfully!',
  GOAL_COMPLETED: 'Congratulations! Goal completed!',
} as const;

// Default Values
export const DEFAULTS = {
  PAGINATION_LIMIT: 20,
  SEARCH_DEBOUNCE_DELAY: 300,
  AUTO_SAVE_DELAY: 2000,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  NOTIFICATION_DURATION: 5000, // 5 seconds
  FLASHCARD_REVIEW_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  QUIZ_TIME_LIMIT: 30 * 60, // 30 minutes in seconds
  STUDY_SESSION_TARGET: 30 * 60, // 30 minutes in seconds
} as const;

// Spaced Repetition Intervals (in days)
export const SPACED_REPETITION_INTERVALS = [1, 3, 7, 14, 30, 90, 180, 365] as const;

// Difficulty Multipliers for Spaced Repetition
export const DIFFICULTY_MULTIPLIERS = {
  1: 2.5, // Very easy
  2: 2.0, // Easy
  3: 1.5, // Normal
  4: 1.0, // Hard
  5: 0.5, // Very hard
} as const;

// Color Palette
export const COLORS = {
  PRIMARY: '#1976d2',
  SECONDARY: '#dc004e',
  SUCCESS: '#2e7d32',
  WARNING: '#ed6c02',
  ERROR: '#d32f2f',
  INFO: '#0288d1',
  GREY: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
} as const;

// Chart Colors
export const CHART_COLORS = [
  '#1976d2', '#dc004e', '#2e7d32', '#ed6c02', '#d32f2f',
  '#0288d1', '#7b1fa2', '#5d4037', '#455a64', '#e65100',
] as const;

// File Types
export const SUPPORTED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'text/plain', 'application/msword'],
  EXPORTS: ['application/json', 'text/csv', 'application/pdf'],
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  YOUTUBE_URL: /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/,
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  PHONE_NUMBER: /^\+?[\d\s\-\(\)]+$/,
  URL: /^https?:\/\/.+/,
} as const;

// Date Formats
export const DATE_FORMATS = {
  SHORT: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  WITH_TIME: 'MMM d, yyyy h:mm a',
  TIME_ONLY: 'h:mm a',
  ISO: 'yyyy-MM-dd',
  RELATIVE: 'relative', // Special format for relative dates
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  SEARCH: 'cmd+k',
  NEW_CAPSULE: 'cmd+n',
  TOGGLE_SIDEBAR: 'cmd+b',
  TOGGLE_THEME: 'cmd+shift+t',
  SAVE: 'cmd+s',
  HELP: '?',
  ESCAPE: 'escape',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_OFFLINE_MODE: false,
  ENABLE_ANALYTICS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_SOCIAL_FEATURES: false,
  ENABLE_ADVANCED_SEARCH: true,
  ENABLE_EXPORT_FEATURES: true,
  ENABLE_COLLABORATION: false,
} as const;

// Environment Check
export const IS_DEVELOPMENT = import.meta.env.MODE === 'development';
export const IS_PRODUCTION = import.meta.env.MODE === 'production';
export const IS_TEST = import.meta.env.MODE === 'test';