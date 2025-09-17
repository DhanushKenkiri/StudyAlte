import { logger } from '../shared/logger';

export interface SpacedRepetitionData {
  interval: number; // Days until next review
  repetition: number; // Number of times reviewed
  easeFactor: number; // Ease factor for SM-2 algorithm
  nextReview: string; // ISO date string
  lastReviewed?: string; // ISO date string
  totalReviews?: number; // Total number of reviews
  correctStreak?: number; // Current streak of correct answers
  averageResponseTime?: number; // Average response time in seconds
}

export interface ReviewResult {
  quality: 0 | 1 | 2 | 3 | 4 | 5; // SM-2 quality rating (0=blackout, 5=perfect)
  responseTime?: number; // Time taken to answer in seconds
  timestamp: string; // ISO date string
}

export interface UpdatedSpacedRepetition extends SpacedRepetitionData {
  wasCorrect: boolean;
  difficultyAdjustment: 'easier' | 'harder' | 'same';
  nextInterval: number;
}

/**
 * Update spaced repetition data based on review performance using SM-2 algorithm
 * Enhanced with additional factors like response time and streak bonuses
 */
export function updateSpacedRepetition(
  current: SpacedRepetitionData,
  review: ReviewResult
): UpdatedSpacedRepetition {
  const now = new Date().toISOString();
  const wasCorrect = review.quality >= 3; // Quality 3+ is considered correct
  
  let newInterval = current.interval;
  let newRepetition = current.repetition;
  let newEaseFactor = current.easeFactor;
  let difficultyAdjustment: 'easier' | 'harder' | 'same' = 'same';

  // SM-2 Algorithm implementation
  if (review.quality >= 3) {
    // Correct answer
    if (newRepetition === 0) {
      newInterval = 1;
    } else if (newRepetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(current.interval * newEaseFactor);
    }
    newRepetition += 1;
  } else {
    // Incorrect answer - reset repetition and set short interval
    newRepetition = 0;
    newInterval = 1;
    difficultyAdjustment = 'harder';
  }

  // Update ease factor based on quality
  newEaseFactor = newEaseFactor + (0.1 - (5 - review.quality) * (0.08 + (5 - review.quality) * 0.02));
  
  // Ensure ease factor stays within reasonable bounds
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }

  // Apply response time adjustments
  if (review.responseTime) {
    const responseTimeAdjustment = calculateResponseTimeAdjustment(review.responseTime, review.quality);
    newInterval = Math.round(newInterval * responseTimeAdjustment);
  }

  // Apply streak bonuses
  const currentStreak = current.correctStreak || 0;
  const newStreak = wasCorrect ? currentStreak + 1 : 0;
  
  if (newStreak >= 5 && wasCorrect) {
    // Bonus for long streaks
    newInterval = Math.round(newInterval * 1.2);
    difficultyAdjustment = 'easier';
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  // Update average response time
  const totalReviews = (current.totalReviews || 0) + 1;
  const avgResponseTime = current.averageResponseTime || 0;
  const newAvgResponseTime = review.responseTime 
    ? (avgResponseTime * (totalReviews - 1) + review.responseTime) / totalReviews
    : avgResponseTime;

  logger.info('Spaced repetition updated', {
    wasCorrect,
    quality: review.quality,
    oldInterval: current.interval,
    newInterval,
    oldEaseFactor: current.easeFactor,
    newEaseFactor,
    streak: newStreak,
    responseTime: review.responseTime,
  });

  return {
    interval: newInterval,
    repetition: newRepetition,
    easeFactor: newEaseFactor,
    nextReview: nextReviewDate.toISOString(),
    lastReviewed: now,
    totalReviews,
    correctStreak: newStreak,
    averageResponseTime: newAvgResponseTime,
    wasCorrect,
    difficultyAdjustment,
    nextInterval: newInterval,
  };
}

/**
 * Calculate adjustment factor based on response time
 * Fast correct answers get bonus, slow answers get penalty
 */
function calculateResponseTimeAdjustment(responseTime: number, quality: number): number {
  if (quality < 3) return 1; // No bonus for incorrect answers

  // Define optimal response time ranges (in seconds)
  const optimalTimes = {
    easy: 5,    // Easy cards should be answered quickly
    medium: 10, // Medium cards allow more thinking time
    hard: 20,   // Hard cards allow even more time
  };

  // Use medium as default
  const optimalTime = optimalTimes.medium;
  
  if (responseTime <= optimalTime * 0.5) {
    // Very fast - significant bonus
    return 1.3;
  } else if (responseTime <= optimalTime) {
    // Fast - small bonus
    return 1.1;
  } else if (responseTime <= optimalTime * 2) {
    // Normal - no adjustment
    return 1.0;
  } else if (responseTime <= optimalTime * 3) {
    // Slow - small penalty
    return 0.9;
  } else {
    // Very slow - larger penalty
    return 0.8;
  }
}

/**
 * Get cards due for review based on spaced repetition schedule
 */
export function getCardsForReview(
  cards: Array<{ id: string; spacedRepetition: SpacedRepetitionData }>,
  maxCards: number = 20,
  includeNew: boolean = true
): Array<{ id: string; priority: number; reason: string }> {
  const now = new Date();
  const reviewCards: Array<{ id: string; priority: number; reason: string }> = [];

  cards.forEach(card => {
    const nextReview = new Date(card.spacedRepetition.nextReview);
    const daysDue = Math.floor((now.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24));
    
    let priority = 0;
    let reason = '';

    if (card.spacedRepetition.repetition === 0 && includeNew) {
      // New card
      priority = 100;
      reason = 'new';
    } else if (daysDue > 0) {
      // Overdue card - higher priority for more overdue cards
      priority = 50 + Math.min(daysDue * 10, 40);
      reason = `overdue_${daysDue}d`;
    } else if (daysDue === 0) {
      // Due today
      priority = 30;
      reason = 'due_today';
    } else if (daysDue >= -1) {
      // Due tomorrow (can be reviewed early)
      priority = 10;
      reason = 'due_soon';
    }

    if (priority > 0) {
      reviewCards.push({ id: card.id, priority, reason });
    }
  });

  // Sort by priority (highest first) and limit results
  return reviewCards
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCards);
}

/**
 * Calculate optimal study session based on available time and card priorities
 */
export function planStudySession(
  cards: Array<{ id: string; spacedRepetition: SpacedRepetitionData; difficulty: string }>,
  availableMinutes: number,
  userPreferences?: {
    preferNewCards?: boolean;
    maxNewCards?: number;
    focusDifficulty?: 'easy' | 'medium' | 'hard';
  }
): {
  recommendedCards: string[];
  estimatedTime: number;
  sessionBreakdown: {
    new: number;
    review: number;
    overdue: number;
  };
  studyTips: string[];
} {
  const preferences = {
    preferNewCards: false,
    maxNewCards: 5,
    focusDifficulty: undefined,
    ...userPreferences,
  };

  // Estimate time per card based on difficulty and repetition
  const estimateCardTime = (card: { spacedRepetition: SpacedRepetitionData; difficulty: string }) => {
    const baseTime = {
      easy: 30,    // 30 seconds
      medium: 60,  // 1 minute
      hard: 120,   // 2 minutes
    };

    const difficultyTime = baseTime[card.difficulty as keyof typeof baseTime] || 60;
    
    // New cards take longer
    if (card.spacedRepetition.repetition === 0) {
      return difficultyTime * 1.5;
    }
    
    // Cards with low ease factor (difficult) take longer
    if (card.spacedRepetition.easeFactor < 2.0) {
      return difficultyTime * 1.2;
    }
    
    return difficultyTime;
  };

  const availableSeconds = availableMinutes * 60;
  let totalTime = 0;
  const selectedCards: string[] = [];
  const breakdown = { new: 0, review: 0, overdue: 0 };

  // Get cards for review with priorities
  const reviewCandidates = getCardsForReview(cards, cards.length, true);
  
  // Filter by difficulty preference if specified
  const filteredCandidates = preferences.focusDifficulty
    ? reviewCandidates.filter(candidate => {
        const card = cards.find(c => c.id === candidate.id);
        return card?.difficulty === preferences.focusDifficulty;
      })
    : reviewCandidates;

  // Select cards within time limit
  for (const candidate of filteredCandidates) {
    const card = cards.find(c => c.id === candidate.id);
    if (!card) continue;

    const cardTime = estimateCardTime(card);
    
    if (totalTime + cardTime <= availableSeconds) {
      // Check new card limit
      if (candidate.reason === 'new' && breakdown.new >= preferences.maxNewCards) {
        continue;
      }

      selectedCards.push(candidate.id);
      totalTime += cardTime;

      // Update breakdown
      if (candidate.reason === 'new') {
        breakdown.new++;
      } else if (candidate.reason.startsWith('overdue')) {
        breakdown.overdue++;
      } else {
        breakdown.review++;
      }
    }
  }

  // Generate study tips
  const studyTips: string[] = [];
  
  if (breakdown.overdue > 0) {
    studyTips.push(`Focus on ${breakdown.overdue} overdue cards first - they need immediate attention`);
  }
  
  if (breakdown.new > 0) {
    studyTips.push(`Take extra time with ${breakdown.new} new cards to build strong memory foundations`);
  }
  
  if (totalTime < availableSeconds * 0.8) {
    studyTips.push('You have extra time - consider reviewing additional cards or taking breaks between cards');
  }
  
  if (selectedCards.length > 15) {
    studyTips.push('Large session planned - consider taking a 5-minute break halfway through');
  }

  return {
    recommendedCards: selectedCards,
    estimatedTime: Math.round(totalTime / 60), // Convert to minutes
    sessionBreakdown: breakdown,
    studyTips,
  };
}

/**
 * Analyze learning progress and provide insights
 */
export function analyzeLearningProgress(
  cards: Array<{
    id: string;
    spacedRepetition: SpacedRepetitionData;
    difficulty: string;
    category: string;
  }>,
  timeframe: 'week' | 'month' | 'all' = 'week'
): {
  totalCards: number;
  masteredCards: number;
  strugglingCards: number;
  averageEaseFactor: number;
  categoryProgress: Record<string, { total: number; mastered: number; struggling: number }>;
  recommendations: string[];
  nextMilestone: { target: number; current: number; description: string };
} {
  const now = new Date();
  const cutoffDate = new Date();
  
  if (timeframe === 'week') {
    cutoffDate.setDate(cutoffDate.getDate() - 7);
  } else if (timeframe === 'month') {
    cutoffDate.setMonth(cutoffDate.getMonth() - 1);
  } else {
    cutoffDate.setFullYear(1970); // Include all cards
  }

  // Filter cards based on timeframe
  const relevantCards = cards.filter(card => {
    if (!card.spacedRepetition.lastReviewed) return timeframe === 'all';
    return new Date(card.spacedRepetition.lastReviewed) >= cutoffDate;
  });

  // Analyze card status
  const masteredCards = relevantCards.filter(card => 
    card.spacedRepetition.repetition >= 3 && 
    card.spacedRepetition.easeFactor >= 2.5 &&
    (card.spacedRepetition.correctStreak || 0) >= 3
  );

  const strugglingCards = relevantCards.filter(card =>
    card.spacedRepetition.easeFactor < 2.0 ||
    (card.spacedRepetition.correctStreak || 0) === 0
  );

  // Calculate average ease factor
  const totalEaseFactor = relevantCards.reduce((sum, card) => sum + card.spacedRepetition.easeFactor, 0);
  const averageEaseFactor = relevantCards.length > 0 ? totalEaseFactor / relevantCards.length : 2.5;

  // Analyze by category
  const categoryProgress: Record<string, { total: number; mastered: number; struggling: number }> = {};
  
  relevantCards.forEach(card => {
    if (!categoryProgress[card.category]) {
      categoryProgress[card.category] = { total: 0, mastered: 0, struggling: 0 };
    }
    
    categoryProgress[card.category].total++;
    
    if (masteredCards.includes(card)) {
      categoryProgress[card.category].mastered++;
    }
    
    if (strugglingCards.includes(card)) {
      categoryProgress[card.category].struggling++;
    }
  });

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (strugglingCards.length > relevantCards.length * 0.3) {
    recommendations.push('Consider reviewing fundamental concepts - many cards need attention');
  }
  
  if (masteredCards.length < relevantCards.length * 0.2) {
    recommendations.push('Focus on consistent daily practice to build mastery');
  }
  
  if (averageEaseFactor < 2.2) {
    recommendations.push('Cards seem challenging - consider breaking complex concepts into smaller parts');
  }
  
  const overdueCards = relevantCards.filter(card => 
    new Date(card.spacedRepetition.nextReview) < now
  );
  
  if (overdueCards.length > 0) {
    recommendations.push(`${overdueCards.length} cards are overdue - prioritize these in your next session`);
  }

  // Calculate next milestone
  const masteredCount = masteredCards.length;
  const nextMilestoneTargets = [10, 25, 50, 100, 200, 500];
  const nextTarget = nextMilestoneTargets.find(target => target > masteredCount) || masteredCount + 100;

  return {
    totalCards: relevantCards.length,
    masteredCards: masteredCards.length,
    strugglingCards: strugglingCards.length,
    averageEaseFactor,
    categoryProgress,
    recommendations,
    nextMilestone: {
      target: nextTarget,
      current: masteredCount,
      description: `Master ${nextTarget} flashcards`,
    },
  };
}