// Validation schemas using Zod

import { z } from 'zod';

// User validation schemas
export const userProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  bio: z.string().max(500, 'Bio too long').optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  language: z.string().min(1, 'Language is required'),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    studyReminders: z.boolean(),
    weeklyProgress: z.boolean(),
  }),
  learning: z.object({
    defaultDifficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    spacedRepetitionEnabled: z.boolean(),
    autoGenerateFlashcards: z.boolean(),
    preferredStudyTime: z.number().min(5).max(480), // 5 minutes to 8 hours
  }),
  privacy: z.object({
    profileVisible: z.boolean(),
    progressVisible: z.boolean(),
    allowDataCollection: z.boolean(),
  }),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().min(6, 'Verification code must be 6 characters'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
});

// Video processing validation schemas
export const youtubeUrlSchema = z.string()
  .url('Invalid URL')
  .refine((url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
    return youtubeRegex.test(url);
  }, 'Must be a valid YouTube URL');

export const processVideoSchema = z.object({
  url: youtubeUrlSchema,
  options: z.object({
    generateFlashcards: z.boolean().optional(),
    generateQuiz: z.boolean().optional(),
    generateMindMap: z.boolean().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    language: z.string().optional(),
  }).optional(),
});

// Learning content validation schemas
export const flashcardSchema = z.object({
  front: z.string().min(1, 'Front side is required').max(500, 'Front side too long'),
  back: z.string().min(1, 'Back side is required').max(1000, 'Back side too long'),
  tags: z.array(z.string()).max(10, 'Too many tags'),
});

export const noteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  tags: z.array(z.string()).max(20, 'Too many tags'),
  category: z.string().min(1, 'Category is required'),
});

export const quizAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  answer: z.string().min(1, 'Answer is required'),
  timeSpent: z.number().min(0, 'Time spent must be positive'),
});

// Search validation schemas
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200, 'Query too long'),
  filters: z.object({
    type: z.array(z.enum(['capsule', 'flashcard', 'note', 'quiz'])).optional(),
    category: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    difficulty: z.array(z.enum(['beginner', 'intermediate', 'advanced'])).optional(),
    dateRange: z.object({
      start: z.date(),
      end: z.date(),
    }).optional(),
  }).optional(),
  page: z.number().min(1, 'Page must be at least 1').optional(),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit too high').optional(),
});

// Goal validation schemas
export const goalSchema = z.object({
  type: z.enum(['daily_study_time', 'weekly_capsules', 'flashcard_reviews', 'quiz_scores']),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  target: z.number().min(1, 'Target must be positive'),
  deadline: z.date().min(new Date(), 'Deadline must be in the future'),
});

// Chat validation schemas
export const chatMessageSchema = z.object({
  capsuleId: z.string().min(1, 'Capsule ID is required'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  context: z.object({
    timestamp: z.number().optional(),
    section: z.string().optional(),
    previousMessages: z.array(z.string()).optional(),
  }).optional(),
});

// Export validation schemas
export const exportDataSchema = z.object({
  format: z.enum(['json', 'csv', 'pdf']),
  includeProgress: z.boolean().optional(),
  includeNotes: z.boolean().optional(),
  includeFlashcards: z.boolean().optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date(),
  }).optional(),
});

// Type inference from schemas
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProcessVideoInput = z.infer<typeof processVideoSchema>;
export type FlashcardInput = z.infer<typeof flashcardSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type QuizAnswerInput = z.infer<typeof quizAnswerSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ExportDataInput = z.infer<typeof exportDataSchema>;

// Validation helper functions
export const validateYouTubeUrl = (url: string): boolean => {
  try {
    youtubeUrlSchema.parse(url);
    return true;
  } catch {
    return false;
  }
};

export const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

export const validateEmail = (email: string): boolean => {
  try {
    z.string().email().parse(email);
    return true;
  } catch {
    return false;
  }
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};