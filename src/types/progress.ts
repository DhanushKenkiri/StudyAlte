// Progress tracking and analytics types

export type ActivityType = 
  | 'video_processed'
  | 'flashcard_reviewed'
  | 'quiz_taken'
  | 'note_created'
  | 'capsule_completed'
  | 'study_session_started'
  | 'study_session_ended';

export type GoalType = 'daily_study_time' | 'weekly_capsules' | 'flashcard_reviews' | 'quiz_scores';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'failed';

// Activity Tracking
export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  entityId: string; // capsule ID, flashcard ID, etc.
  entityType: string;
  metadata: Record<string, unknown>;
  duration?: number; // in seconds
  timestamp: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  capsuleId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  activities: Activity[];
  focusScore: number; // 0-100
  completedTasks: string[];
}

// Progress Statistics
export interface DailyStats {
  date: string; // YYYY-MM-DD
  userId: string;
  studyTime: number; // in seconds
  capsulesCompleted: number;
  flashcardsReviewed: number;
  quizzesTaken: number;
  averageQuizScore: number;
  notesCreated: number;
  streakDays: number;
}

export interface WeeklyStats {
  weekStart: string; // YYYY-MM-DD
  userId: string;
  totalStudyTime: number;
  averageDailyTime: number;
  capsulesCompleted: number;
  flashcardsReviewed: number;
  quizzesTaken: number;
  averageQuizScore: number;
  improvementRate: number; // percentage
  consistencyScore: number; // 0-100
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  userId: string;
  totalStudyTime: number;
  capsulesCompleted: number;
  topCategories: CategoryStats[];
  skillProgression: SkillProgression[];
  achievements: Achievement[];
}

export interface CategoryStats {
  category: string;
  studyTime: number;
  capsulesCompleted: number;
  averageScore: number;
  proficiencyLevel: number; // 0-100
}

export interface SkillProgression {
  skill: string;
  startLevel: number;
  currentLevel: number;
  improvement: number;
  lastUpdated: Date;
}

// User Progress Overview
export interface UserProgress {
  userId: string;
  totalCapsules: number;
  completedCapsules: number;
  totalStudyTime: number; // in seconds
  streakDays: number;
  longestStreak: number;
  lastActivity: Date;
  skillLevels: Record<string, number>; // skill -> level (0-100)
  achievements: Achievement[];
  currentGoals: Goal[];
  weeklyTarget: number; // minutes
  dailyTarget: number; // minutes
  updatedAt: Date;
}

// Achievements System
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'study_time' | 'consistency' | 'mastery' | 'social' | 'milestone';
  requirements: AchievementRequirement[];
  reward?: AchievementReward;
  unlockedAt?: Date;
  progress: number; // 0-100
}

export interface AchievementRequirement {
  type: 'study_time' | 'capsules_completed' | 'streak_days' | 'quiz_score' | 'flashcard_reviews';
  target: number;
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

export interface AchievementReward {
  type: 'badge' | 'points' | 'feature_unlock';
  value: string | number;
}

// Goals System
export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  description: string;
  target: number;
  current: number;
  deadline: Date;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Analytics and Insights
export interface LearningInsight {
  id: string;
  userId: string;
  type: 'strength' | 'weakness' | 'recommendation' | 'trend';
  title: string;
  description: string;
  data: Record<string, unknown>;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  generatedAt: Date;
  dismissedAt?: Date;
}

export interface PerformanceMetrics {
  userId: string;
  timeframe: 'week' | 'month' | 'quarter' | 'year';
  averageSessionDuration: number; // in minutes
  completionRate: number; // percentage
  retentionRate: number; // percentage
  improvementRate: number; // percentage
  consistencyScore: number; // 0-100
  focusScore: number; // 0-100
  strongestCategories: string[];
  weakestCategories: string[];
  recommendedActions: string[];
}

// Leaderboard and Social Features
export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  rank: number;
  change: number; // position change from previous period
  achievements: number;
  streakDays: number;
}

export interface Leaderboard {
  id: string;
  type: 'global' | 'friends' | 'category';
  category?: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all_time';
  entries: LeaderboardEntry[];
  userRank?: number;
  lastUpdated: Date;
}