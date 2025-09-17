import { User } from '../../src/types/user';
import { ValidationError } from '../../src/types/errors';

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long', 'WEAK_PASSWORD');
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasLowercase || !hasUppercase || !hasNumbers || !hasSpecialChar) {
    throw new ValidationError(
      'Password must contain lowercase, uppercase, numbers, and special characters',
      'WEAK_PASSWORD'
    );
  }
}

/**
 * Validate user profile data
 */
export function validateUserProfile(user: User): void {
  // Validate required fields
  if (!user.id || typeof user.id !== 'string') {
    throw new ValidationError('User ID is required and must be a string', 'INVALID_USER_ID');
  }

  if (!user.email || typeof user.email !== 'string') {
    throw new ValidationError('Email is required and must be a string', 'INVALID_EMAIL');
  }

  if (!validateEmail(user.email)) {
    throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
  }

  if (!user.name || typeof user.name !== 'string') {
    throw new ValidationError('Name is required and must be a string', 'INVALID_NAME');
  }

  if (user.name.length > 100) {
    throw new ValidationError('Name must be less than 100 characters', 'INVALID_NAME');
  }

  // Validate preferences
  if (user.preferences) {
    validateUserPreferences(user.preferences);
  }

  // Validate profile
  if (user.profile) {
    validateUserProfileData(user.profile);
  }

  // Validate subscription
  if (user.subscription) {
    validateUserSubscription(user.subscription);
  }

  // Validate stats
  if (user.stats) {
    validateUserStats(user.stats);
  }

  // Validate dates
  if (user.createdAt && !isValidISODate(user.createdAt)) {
    throw new ValidationError('Invalid createdAt date format', 'INVALID_DATE');
  }

  if (user.updatedAt && !isValidISODate(user.updatedAt)) {
    throw new ValidationError('Invalid updatedAt date format', 'INVALID_DATE');
  }

  if (user.lastLoginAt && !isValidISODate(user.lastLoginAt)) {
    throw new ValidationError('Invalid lastLoginAt date format', 'INVALID_DATE');
  }
}

/**
 * Validate user preferences
 */
function validateUserPreferences(preferences: User['preferences']): void {
  if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
    throw new ValidationError('Theme must be light, dark, or auto', 'INVALID_THEME');
  }

  if (preferences.language && typeof preferences.language !== 'string') {
    throw new ValidationError('Language must be a string', 'INVALID_LANGUAGE');
  }

  if (preferences.notifications) {
    const { notifications } = preferences;
    if (typeof notifications.email !== 'boolean') {
      throw new ValidationError('Email notification preference must be a boolean', 'INVALID_NOTIFICATION_SETTING');
    }
    if (typeof notifications.push !== 'boolean') {
      throw new ValidationError('Push notification preference must be a boolean', 'INVALID_NOTIFICATION_SETTING');
    }
    if (typeof notifications.studyReminders !== 'boolean') {
      throw new ValidationError('Study reminders preference must be a boolean', 'INVALID_NOTIFICATION_SETTING');
    }
  }

  if (preferences.privacy) {
    const { privacy } = preferences;
    if (privacy.profileVisibility && !['public', 'private', 'friends'].includes(privacy.profileVisibility)) {
      throw new ValidationError('Profile visibility must be public, private, or friends', 'INVALID_PRIVACY_SETTING');
    }
    if (typeof privacy.shareProgress !== 'boolean') {
      throw new ValidationError('Share progress preference must be a boolean', 'INVALID_PRIVACY_SETTING');
    }
  }

  if (preferences.learning) {
    const { learning } = preferences;
    if (learning.difficultyLevel && !['beginner', 'intermediate', 'advanced'].includes(learning.difficultyLevel)) {
      throw new ValidationError('Difficulty level must be beginner, intermediate, or advanced', 'INVALID_LEARNING_SETTING');
    }

    if (learning.preferredContentTypes && !Array.isArray(learning.preferredContentTypes)) {
      throw new ValidationError('Preferred content types must be an array', 'INVALID_LEARNING_SETTING');
    }

    if (learning.studyGoals) {
      const { studyGoals } = learning;
      if (typeof studyGoals.dailyMinutes !== 'number' || studyGoals.dailyMinutes < 0 || studyGoals.dailyMinutes > 1440) {
        throw new ValidationError('Daily minutes must be a number between 0 and 1440', 'INVALID_STUDY_GOAL');
      }
      if (typeof studyGoals.weeklyGoal !== 'number' || studyGoals.weeklyGoal < 0 || studyGoals.weeklyGoal > 50) {
        throw new ValidationError('Weekly goal must be a number between 0 and 50', 'INVALID_STUDY_GOAL');
      }
    }
  }
}

/**
 * Validate user profile data
 */
function validateUserProfileData(profile: User['profile']): void {
  if (profile.bio && (typeof profile.bio !== 'string' || profile.bio.length > 500)) {
    throw new ValidationError('Bio must be a string with less than 500 characters', 'INVALID_BIO');
  }

  if (profile.location && (typeof profile.location !== 'string' || profile.location.length > 100)) {
    throw new ValidationError('Location must be a string with less than 100 characters', 'INVALID_LOCATION');
  }

  if (profile.website && (typeof profile.website !== 'string' || !isValidUrl(profile.website))) {
    throw new ValidationError('Website must be a valid URL', 'INVALID_WEBSITE');
  }

  if (profile.avatar && (typeof profile.avatar !== 'string' || !isValidUrl(profile.avatar))) {
    throw new ValidationError('Avatar must be a valid URL', 'INVALID_AVATAR');
  }

  if (profile.socialLinks) {
    Object.entries(profile.socialLinks).forEach(([platform, url]) => {
      if (typeof url !== 'string' || !isValidUrl(url)) {
        throw new ValidationError(`Social link for ${platform} must be a valid URL`, 'INVALID_SOCIAL_LINK');
      }
    });
  }
}

/**
 * Validate user subscription
 */
function validateUserSubscription(subscription: User['subscription']): void {
  if (!['free', 'premium', 'pro', 'enterprise'].includes(subscription.tier)) {
    throw new ValidationError('Subscription tier must be free, premium, pro, or enterprise', 'INVALID_SUBSCRIPTION_TIER');
  }

  if (!['active', 'inactive', 'cancelled', 'expired'].includes(subscription.status)) {
    throw new ValidationError('Subscription status must be active, inactive, cancelled, or expired', 'INVALID_SUBSCRIPTION_STATUS');
  }

  if (!isValidISODate(subscription.startDate)) {
    throw new ValidationError('Subscription start date must be a valid ISO date', 'INVALID_SUBSCRIPTION_DATE');
  }

  if (subscription.endDate && !isValidISODate(subscription.endDate)) {
    throw new ValidationError('Subscription end date must be a valid ISO date', 'INVALID_SUBSCRIPTION_DATE');
  }

  if (!Array.isArray(subscription.features)) {
    throw new ValidationError('Subscription features must be an array', 'INVALID_SUBSCRIPTION_FEATURES');
  }
}

/**
 * Validate user stats
 */
function validateUserStats(stats: User['stats']): void {
  const numericFields = [
    'totalCapsules',
    'totalStudyTime',
    'currentStreak',
    'longestStreak',
    'completedQuizzes',
    'averageQuizScore',
  ];

  numericFields.forEach(field => {
    const value = stats[field as keyof User['stats']];
    if (typeof value !== 'number' || value < 0) {
      throw new ValidationError(`${field} must be a non-negative number`, 'INVALID_STATS');
    }
  });

  if (stats.averageQuizScore > 100) {
    throw new ValidationError('Average quiz score cannot exceed 100', 'INVALID_STATS');
  }
}

/**
 * Validate ISO date string
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate YouTube URL format
 */
export function validateYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;
  return youtubeRegex.test(url);
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validate learning capsule data
 */
export function validateLearningCapsule(capsule: any): void {
  if (!capsule.id || typeof capsule.id !== 'string') {
    throw new ValidationError('Capsule ID is required and must be a string', 'INVALID_CAPSULE_ID');
  }

  if (!capsule.userId || typeof capsule.userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string', 'INVALID_USER_ID');
  }

  if (!capsule.videoUrl || typeof capsule.videoUrl !== 'string') {
    throw new ValidationError('Video URL is required and must be a string', 'INVALID_VIDEO_URL');
  }

  if (!validateYouTubeUrl(capsule.videoUrl)) {
    throw new ValidationError('Invalid YouTube URL format', 'INVALID_VIDEO_URL');
  }

  if (!capsule.title || typeof capsule.title !== 'string') {
    throw new ValidationError('Title is required and must be a string', 'INVALID_TITLE');
  }

  if (capsule.title.length > 200) {
    throw new ValidationError('Title must be less than 200 characters', 'INVALID_TITLE');
  }

  if (capsule.description && (typeof capsule.description !== 'string' || capsule.description.length > 1000)) {
    throw new ValidationError('Description must be a string with less than 1000 characters', 'INVALID_DESCRIPTION');
  }

  if (capsule.tags && !Array.isArray(capsule.tags)) {
    throw new ValidationError('Tags must be an array', 'INVALID_TAGS');
  }

  if (capsule.duration && (typeof capsule.duration !== 'number' || capsule.duration < 0)) {
    throw new ValidationError('Duration must be a non-negative number', 'INVALID_DURATION');
  }

  if (!['processing', 'ready', 'error'].includes(capsule.status)) {
    throw new ValidationError('Status must be processing, ready, or error', 'INVALID_STATUS');
  }
}