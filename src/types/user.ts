// User-related types and interfaces

export type SubscriptionTier = 'free' | 'premium' | 'enterprise';

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  timezone: string;
  language: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    studyReminders: boolean;
    weeklyProgress: boolean;
  };
  learning: {
    defaultDifficulty: 'beginner' | 'intermediate' | 'advanced';
    spacedRepetitionEnabled: boolean;
    autoGenerateFlashcards: boolean;
    preferredStudyTime: number; // minutes per session
  };
  privacy: {
    profileVisible: boolean;
    progressVisible: boolean;
    allowDataCollection: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  preferences: UserPreferences;
  subscription: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  profile: Omit<UserProfile, 'avatar'>;
  preferences?: Partial<UserPreferences>;
}

export interface ProfileUpdate {
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  firstName: string;
  lastName: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}