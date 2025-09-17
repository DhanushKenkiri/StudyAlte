// DynamoDB single-table schema definitions

import { z } from 'zod';
import { 
  User, 
  LearningCapsule, 
  UserProgress, 
  DailyStats, 
  Goal, 
  Achievement,
  StudySession,
  Activity 
} from '@/types';

// Base DynamoDB item schema
export const baseItemSchema = z.object({
  PK: z.string(), // Partition Key
  SK: z.string(), // Sort Key
  GSI1PK: z.string().optional(), // Global Secondary Index 1 Partition Key
  GSI1SK: z.string().optional(), // Global Secondary Index 1 Sort Key
  GSI2PK: z.string().optional(), // Global Secondary Index 2 Partition Key
  GSI2SK: z.string().optional(), // Global Secondary Index 2 Sort Key
  entityType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ttl: z.number().optional(), // Time to live for temporary items
});

// User table item
export const userItemSchema = baseItemSchema.extend({
  entityType: z.literal('USER'),
  userId: z.string(),
  email: z.string(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
    timezone: z.string(),
    language: z.string(),
  }),
  preferences: z.object({
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
      preferredStudyTime: z.number(),
    }),
    privacy: z.object({
      profileVisible: z.boolean(),
      progressVisible: z.boolean(),
      allowDataCollection: z.boolean(),
    }),
  }),
  subscription: z.enum(['free', 'premium', 'enterprise']),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().optional(),
});

// Learning Capsule table item
export const capsuleItemSchema = baseItemSchema.extend({
  entityType: z.literal('CAPSULE'),
  capsuleId: z.string(),
  userId: z.string(),
  videoId: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnail: z.string(),
  duration: z.number(),
  tags: z.array(z.string()),
  category: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
  processingProgress: z.number(),
  processingError: z.string().optional(),
  lastAccessed: z.string(),
  
  // Generated content (stored as JSON strings in DynamoDB)
  summary: z.string(), // JSON serialized Summary object
  flashcards: z.string(), // JSON serialized Flashcard[] array
  quiz: z.string(), // JSON serialized Quiz object
  notes: z.string(), // JSON serialized Note[] array
  mindMap: z.string().optional(), // JSON serialized MindMap object
  transcript: z.string(), // JSON serialized Transcript object
  
  // Progress tracking
  progress: z.string(), // JSON serialized CapsuleProgress object
  
  // Search fields
  searchableContent: z.string(), // Concatenated searchable text
});

// User Progress table item
export const progressItemSchema = baseItemSchema.extend({
  entityType: z.literal('PROGRESS'),
  userId: z.string(),
  totalCapsules: z.number(),
  completedCapsules: z.number(),
  totalStudyTime: z.number(),
  streakDays: z.number(),
  longestStreak: z.number(),
  lastActivity: z.string(),
  skillLevels: z.string(), // JSON serialized Record<string, number>
  achievements: z.string(), // JSON serialized Achievement[]
  currentGoals: z.string(), // JSON serialized Goal[]
  weeklyTarget: z.number(),
  dailyTarget: z.number(),
});

// Daily Stats table item
export const dailyStatsItemSchema = baseItemSchema.extend({
  entityType: z.literal('DAILY_STATS'),
  userId: z.string(),
  date: z.string(), // YYYY-MM-DD format
  studyTime: z.number(),
  capsulesCompleted: z.number(),
  flashcardsReviewed: z.number(),
  quizzesTaken: z.number(),
  averageQuizScore: z.number(),
  notesCreated: z.number(),
  streakDays: z.number(),
});

// Goal table item
export const goalItemSchema = baseItemSchema.extend({
  entityType: z.literal('GOAL'),
  goalId: z.string(),
  userId: z.string(),
  type: z.enum(['daily_study_time', 'weekly_capsules', 'flashcard_reviews', 'quiz_scores']),
  title: z.string(),
  description: z.string(),
  target: z.number(),
  current: z.number(),
  deadline: z.string(),
  status: z.enum(['active', 'completed', 'paused', 'failed']),
  completedAt: z.string().optional(),
});

// Achievement table item
export const achievementItemSchema = baseItemSchema.extend({
  entityType: z.literal('ACHIEVEMENT'),
  achievementId: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.enum(['study_time', 'consistency', 'mastery', 'social', 'milestone']),
  requirements: z.string(), // JSON serialized AchievementRequirement[]
  reward: z.string().optional(), // JSON serialized AchievementReward
  unlockedAt: z.string().optional(),
  progress: z.number(),
});

// Study Session table item
export const studySessionItemSchema = baseItemSchema.extend({
  entityType: z.literal('STUDY_SESSION'),
  sessionId: z.string(),
  userId: z.string(),
  capsuleId: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.number(),
  activities: z.string(), // JSON serialized Activity[]
  focusScore: z.number(),
  completedTasks: z.array(z.string()),
});

// Activity table item
export const activityItemSchema = baseItemSchema.extend({
  entityType: z.literal('ACTIVITY'),
  activityId: z.string(),
  userId: z.string(),
  type: z.enum([
    'video_processed',
    'flashcard_reviewed',
    'quiz_taken',
    'note_created',
    'capsule_completed',
    'study_session_started',
    'study_session_ended',
  ]),
  entityId: z.string(),
  entityType: z.string(),
  metadata: z.string(), // JSON serialized Record<string, unknown>
  duration: z.number().optional(),
  timestamp: z.string(),
});

// Processing Job table item (temporary items with TTL)
export const processingJobItemSchema = baseItemSchema.extend({
  entityType: z.literal('PROCESSING_JOB'),
  jobId: z.string(),
  userId: z.string(),
  videoUrl: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number(),
  estimatedCompletion: z.string().optional(),
  result: z.string().optional(), // JSON serialized LearningCapsule
  error: z.string().optional(), // JSON serialized ProcessingError
  ttl: z.number(), // TTL for cleanup after 24 hours
});

// Union type for all possible DynamoDB items
export type DynamoDBItem = 
  | z.infer<typeof userItemSchema>
  | z.infer<typeof capsuleItemSchema>
  | z.infer<typeof progressItemSchema>
  | z.infer<typeof dailyStatsItemSchema>
  | z.infer<typeof goalItemSchema>
  | z.infer<typeof achievementItemSchema>
  | z.infer<typeof studySessionItemSchema>
  | z.infer<typeof activityItemSchema>
  | z.infer<typeof processingJobItemSchema>;

// Key generation utilities
export class KeyGenerator {
  // User keys
  static userPK(userId: string): string {
    return `USER#${userId}`;
  }

  static userSK(): string {
    return 'PROFILE';
  }

  static userGSI1PK(email: string): string {
    return `EMAIL#${email}`;
  }

  static userGSI1SK(): string {
    return 'USER';
  }

  // Capsule keys
  static capsulePK(userId: string): string {
    return `USER#${userId}`;
  }

  static capsuleSK(capsuleId: string): string {
    return `CAPSULE#${capsuleId}`;
  }

  static capsuleGSI1PK(capsuleId: string): string {
    return `CAPSULE#${capsuleId}`;
  }

  static capsuleGSI1SK(createdAt: string): string {
    return `CREATED#${createdAt}`;
  }

  static capsuleGSI2PK(category: string): string {
    return `CATEGORY#${category}`;
  }

  static capsuleGSI2SK(updatedAt: string): string {
    return `UPDATED#${updatedAt}`;
  }

  // Progress keys
  static progressPK(userId: string): string {
    return `USER#${userId}`;
  }

  static progressSK(): string {
    return 'PROGRESS';
  }

  // Daily stats keys
  static dailyStatsPK(userId: string): string {
    return `USER#${userId}`;
  }

  static dailyStatsSK(date: string): string {
    return `STATS#${date}`;
  }

  static dailyStatsGSI1PK(date: string): string {
    return `DATE#${date}`;
  }

  static dailyStatsGSI1SK(userId: string): string {
    return `USER#${userId}`;
  }

  // Goal keys
  static goalPK(userId: string): string {
    return `USER#${userId}`;
  }

  static goalSK(goalId: string): string {
    return `GOAL#${goalId}`;
  }

  static goalGSI1PK(userId: string, status: string): string {
    return `USER#${userId}#STATUS#${status}`;
  }

  static goalGSI1SK(deadline: string): string {
    return `DEADLINE#${deadline}`;
  }

  // Achievement keys
  static achievementPK(userId: string): string {
    return `USER#${userId}`;
  }

  static achievementSK(achievementId: string): string {
    return `ACHIEVEMENT#${achievementId}`;
  }

  static achievementGSI1PK(userId: string, category: string): string {
    return `USER#${userId}#CATEGORY#${category}`;
  }

  static achievementGSI1SK(unlockedAt?: string): string {
    return unlockedAt ? `UNLOCKED#${unlockedAt}` : 'LOCKED';
  }

  // Study session keys
  static studySessionPK(userId: string): string {
    return `USER#${userId}`;
  }

  static studySessionSK(sessionId: string): string {
    return `SESSION#${sessionId}`;
  }

  static studySessionGSI1PK(userId: string): string {
    return `USER#${userId}#SESSIONS`;
  }

  static studySessionGSI1SK(startTime: string): string {
    return `START#${startTime}`;
  }

  // Activity keys
  static activityPK(userId: string): string {
    return `USER#${userId}`;
  }

  static activitySK(activityId: string): string {
    return `ACTIVITY#${activityId}`;
  }

  static activityGSI1PK(userId: string, type: string): string {
    return `USER#${userId}#TYPE#${type}`;
  }

  static activityGSI1SK(timestamp: string): string {
    return `TIME#${timestamp}`;
  }

  // Processing job keys
  static processingJobPK(userId: string): string {
    return `USER#${userId}`;
  }

  static processingJobSK(jobId: string): string {
    return `JOB#${jobId}`;
  }

  static processingJobGSI1PK(status: string): string {
    return `STATUS#${status}`;
  }

  static processingJobGSI1SK(createdAt: string): string {
    return `CREATED#${createdAt}`;
  }
}

// Data transformation utilities
export class DataTransformer {
  // Convert domain objects to DynamoDB items
  static userToDynamoItem(user: User): z.infer<typeof userItemSchema> {
    const now = new Date().toISOString();
    return {
      PK: KeyGenerator.userPK(user.id),
      SK: KeyGenerator.userSK(),
      GSI1PK: KeyGenerator.userGSI1PK(user.email),
      GSI1SK: KeyGenerator.userGSI1SK(),
      entityType: 'USER',
      userId: user.id,
      email: user.email,
      profile: user.profile,
      preferences: user.preferences,
      subscription: user.subscription,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static capsuleToDynamoItem(capsule: LearningCapsule): z.infer<typeof capsuleItemSchema> {
    const now = new Date().toISOString();
    return {
      PK: KeyGenerator.capsulePK(capsule.userId),
      SK: KeyGenerator.capsuleSK(capsule.id),
      GSI1PK: KeyGenerator.capsuleGSI1PK(capsule.id),
      GSI1SK: KeyGenerator.capsuleGSI1SK(capsule.createdAt.toISOString()),
      GSI2PK: KeyGenerator.capsuleGSI2PK(capsule.category),
      GSI2SK: KeyGenerator.capsuleGSI2SK(capsule.updatedAt.toISOString()),
      entityType: 'CAPSULE',
      capsuleId: capsule.id,
      userId: capsule.userId,
      videoId: capsule.videoId,
      title: capsule.title,
      description: capsule.description,
      thumbnail: capsule.thumbnail,
      duration: capsule.duration,
      tags: capsule.tags,
      category: capsule.category,
      difficulty: capsule.difficulty,
      processingStatus: capsule.processingStatus,
      processingProgress: capsule.processingProgress,
      processingError: capsule.processingError,
      lastAccessed: capsule.lastAccessed.toISOString(),
      summary: JSON.stringify(capsule.summary),
      flashcards: JSON.stringify(capsule.flashcards),
      quiz: JSON.stringify(capsule.quiz),
      notes: JSON.stringify(capsule.notes),
      mindMap: capsule.mindMap ? JSON.stringify(capsule.mindMap) : undefined,
      transcript: JSON.stringify(capsule.transcript),
      progress: JSON.stringify(capsule.progress),
      searchableContent: this.buildSearchableContent(capsule),
      createdAt: capsule.createdAt.toISOString(),
      updatedAt: capsule.updatedAt.toISOString(),
    };
  }

  // Convert DynamoDB items to domain objects
  static dynamoItemToUser(item: z.infer<typeof userItemSchema>): User {
    return {
      id: item.userId,
      email: item.email,
      profile: item.profile,
      preferences: item.preferences,
      subscription: item.subscription,
      emailVerified: item.emailVerified,
      lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : undefined,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };
  }

  static dynamoItemToCapsule(item: z.infer<typeof capsuleItemSchema>): LearningCapsule {
    return {
      id: item.capsuleId,
      userId: item.userId,
      videoId: item.videoId,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      duration: item.duration,
      tags: item.tags,
      category: item.category,
      difficulty: item.difficulty,
      processingStatus: item.processingStatus,
      processingProgress: item.processingProgress,
      processingError: item.processingError,
      lastAccessed: new Date(item.lastAccessed),
      summary: JSON.parse(item.summary),
      flashcards: JSON.parse(item.flashcards),
      quiz: JSON.parse(item.quiz),
      notes: JSON.parse(item.notes),
      mindMap: item.mindMap ? JSON.parse(item.mindMap) : undefined,
      transcript: JSON.parse(item.transcript),
      progress: JSON.parse(item.progress),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };
  }

  // Helper method to build searchable content
  private static buildSearchableContent(capsule: LearningCapsule): string {
    const searchParts = [
      capsule.title,
      capsule.description,
      ...capsule.tags,
      capsule.category,
      capsule.summary.keyPoints.join(' '),
      capsule.summary.mainConcepts.join(' '),
      capsule.notes.map(note => `${note.title} ${note.content}`).join(' '),
    ];

    return searchParts.join(' ').toLowerCase();
  }
}

// Validation utilities
export const validateDynamoItem = (item: unknown, schema: z.ZodSchema): boolean => {
  try {
    schema.parse(item);
    return true;
  } catch {
    return false;
  }
};

export const validateAndTransformItem = <T>(
  item: unknown,
  schema: z.ZodSchema<T>
): T => {
  return schema.parse(item);
};