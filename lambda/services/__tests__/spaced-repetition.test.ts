import {
  updateSpacedRepetition,
  getCardsForReview,
  planStudySession,
  analyzeLearningProgress,
  SpacedRepetitionData,
  ReviewResult,
} from '../spaced-repetition';

describe('Spaced Repetition Service', () => {
  const baseSpacedRepetition: SpacedRepetitionData = {
    interval: 1,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: new Date().toISOString(),
    totalReviews: 0,
    correctStreak: 0,
    averageResponseTime: 0,
  };

  describe('updateSpacedRepetition', () => {
    it('should handle first correct review (quality 4)', () => {
      const review: ReviewResult = {
        quality: 4,
        responseTime: 5,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(baseSpacedRepetition, review);

      expect(result.wasCorrect).toBe(true);
      expect(result.repetition).toBe(1);
      expect(result.interval).toBe(1); // First repetition interval
      expect(result.correctStreak).toBe(1);
      expect(result.easeFactor).toBeGreaterThan(2.5); // Should increase for quality 4
      expect(result.difficultyAdjustment).toBe('same');
      expect(result.totalReviews).toBe(1);
    });

    it('should handle second correct review (quality 5)', () => {
      const firstReview: SpacedRepetitionData = {
        ...baseSpacedRepetition,
        repetition: 1,
        interval: 1,
        easeFactor: 2.6,
        correctStreak: 1,
        totalReviews: 1,
      };

      const review: ReviewResult = {
        quality: 5,
        responseTime: 3,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(firstReview, review);

      expect(result.wasCorrect).toBe(true);
      expect(result.repetition).toBe(2);
      expect(result.interval).toBe(6); // Second repetition interval
      expect(result.correctStreak).toBe(2);
      expect(result.easeFactor).toBeGreaterThan(2.6); // Should increase for quality 5
      expect(result.totalReviews).toBe(2);
    });

    it('should handle third correct review with ease factor multiplication', () => {
      const secondReview: SpacedRepetitionData = {
        ...baseSpacedRepetition,
        repetition: 2,
        interval: 6,
        easeFactor: 2.7,
        correctStreak: 2,
        totalReviews: 2,
      };

      const review: ReviewResult = {
        quality: 4,
        responseTime: 8,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(secondReview, review);

      expect(result.wasCorrect).toBe(true);
      expect(result.repetition).toBe(3);
      expect(result.interval).toBe(Math.round(6 * 2.7)); // interval * easeFactor
      expect(result.correctStreak).toBe(3);
    });

    it('should handle incorrect review (quality 2)', () => {
      const review: ReviewResult = {
        quality: 2,
        responseTime: 15,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(baseSpacedRepetition, review);

      expect(result.wasCorrect).toBe(false);
      expect(result.repetition).toBe(0); // Reset to 0
      expect(result.interval).toBe(1); // Reset to 1 day
      expect(result.correctStreak).toBe(0); // Reset streak
      expect(result.difficultyAdjustment).toBe('harder');
      expect(result.easeFactor).toBeLessThan(2.5); // Should decrease for quality 2
    });

    it('should apply response time bonuses for fast correct answers', () => {
      const review: ReviewResult = {
        quality: 4,
        responseTime: 2, // Very fast
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(baseSpacedRepetition, review);

      expect(result.interval).toBeGreaterThan(1); // Should get bonus
      expect(result.wasCorrect).toBe(true);
    });

    it('should apply response time penalties for slow answers', () => {
      const review: ReviewResult = {
        quality: 3,
        responseTime: 30, // Very slow
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(baseSpacedRepetition, review);

      expect(result.interval).toBe(1); // Should get penalty (but minimum is 1)
      expect(result.wasCorrect).toBe(true);
    });

    it('should apply streak bonuses for long correct streaks', () => {
      const longStreak: SpacedRepetitionData = {
        ...baseSpacedRepetition,
        repetition: 3,
        interval: 15,
        easeFactor: 2.5,
        correctStreak: 5, // Long streak
        totalReviews: 5,
      };

      const review: ReviewResult = {
        quality: 4,
        responseTime: 5,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(longStreak, review);

      expect(result.interval).toBeGreaterThan(Math.round(15 * 2.5)); // Should get streak bonus
      expect(result.difficultyAdjustment).toBe('easier');
      expect(result.correctStreak).toBe(6);
    });

    it('should maintain ease factor within bounds', () => {
      const lowEaseFactor: SpacedRepetitionData = {
        ...baseSpacedRepetition,
        easeFactor: 1.2, // Below minimum
      };

      const review: ReviewResult = {
        quality: 1, // Very poor
        responseTime: 20,
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(lowEaseFactor, review);

      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3); // Should be clamped to minimum
    });

    it('should update average response time correctly', () => {
      const withHistory: SpacedRepetitionData = {
        ...baseSpacedRepetition,
        totalReviews: 2,
        averageResponseTime: 10, // Previous average
      };

      const review: ReviewResult = {
        quality: 4,
        responseTime: 5, // New response time
        timestamp: new Date().toISOString(),
      };

      const result = updateSpacedRepetition(withHistory, review);

      // New average should be (10 * 2 + 5) / 3 = 8.33
      expect(result.averageResponseTime).toBeCloseTo(8.33, 1);
      expect(result.totalReviews).toBe(3);
    });
  });

  describe('getCardsForReview', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const testCards = [
      {
        id: 'new-card',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 0,
          nextReview: now.toISOString(),
        },
      },
      {
        id: 'overdue-card',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 2,
          nextReview: yesterday.toISOString(),
        },
      },
      {
        id: 'due-today',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 1,
          nextReview: now.toISOString(),
        },
      },
      {
        id: 'due-tomorrow',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 1,
          nextReview: tomorrow.toISOString(),
        },
      },
      {
        id: 'future-card',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 3,
          nextReview: nextWeek.toISOString(),
        },
      },
    ];

    it('should return cards for review in priority order', () => {
      const result = getCardsForReview(testCards, 10, true);

      expect(result).toHaveLength(4); // All except future card
      expect(result[0].id).toBe('new-card'); // Highest priority
      expect(result[0].priority).toBe(100);
      expect(result[0].reason).toBe('new');

      // Find overdue card (should be high priority)
      const overdueCard = result.find(card => card.id === 'overdue-card');
      expect(overdueCard).toBeDefined();
      expect(overdueCard!.priority).toBeGreaterThan(50);
      expect(overdueCard!.reason).toContain('overdue');
    });

    it('should respect maxCards limit', () => {
      const result = getCardsForReview(testCards, 2, true);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('new-card'); // Highest priority first
    });

    it('should exclude new cards when includeNew is false', () => {
      const result = getCardsForReview(testCards, 10, false);

      expect(result.every(card => card.reason !== 'new')).toBe(true);
      expect(result.find(card => card.id === 'new-card')).toBeUndefined();
    });

    it('should include due tomorrow cards with lower priority', () => {
      const result = getCardsForReview(testCards, 10, true);

      const tomorrowCard = result.find(card => card.id === 'due-tomorrow');
      expect(tomorrowCard).toBeDefined();
      expect(tomorrowCard!.priority).toBe(10);
      expect(tomorrowCard!.reason).toBe('due_soon');
    });

    it('should not include future cards', () => {
      const result = getCardsForReview(testCards, 10, true);

      expect(result.find(card => card.id === 'future-card')).toBeUndefined();
    });
  });

  describe('planStudySession', () => {
    const testCards = [
      {
        id: 'easy-new',
        difficulty: 'easy',
        spacedRepetition: { ...baseSpacedRepetition, repetition: 0, nextReview: new Date().toISOString() },
      },
      {
        id: 'medium-review',
        difficulty: 'medium',
        spacedRepetition: { ...baseSpacedRepetition, repetition: 2, nextReview: new Date().toISOString() },
      },
      {
        id: 'hard-overdue',
        difficulty: 'hard',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 1,
          nextReview: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        },
      },
    ];

    it('should plan session within time limit', () => {
      const result = planStudySession(testCards, 5); // 5 minutes

      expect(result.estimatedTime).toBeLessThanOrEqual(5);
      expect(result.recommendedCards.length).toBeGreaterThan(0);
      expect(result.sessionBreakdown).toBeDefined();
      expect(result.studyTips.length).toBeGreaterThan(0);
    });

    it('should respect new card limits', () => {
      const result = planStudySession(testCards, 10, {
        preferNewCards: true,
        maxNewCards: 1,
      });

      expect(result.sessionBreakdown.new).toBeLessThanOrEqual(1);
    });

    it('should focus on specific difficulty when requested', () => {
      const result = planStudySession(testCards, 10, {
        focusDifficulty: 'hard',
      });

      // Should only include hard cards if available
      expect(result.recommendedCards).toContain('hard-overdue');
    });

    it('should provide relevant study tips', () => {
      const result = planStudySession(testCards, 10);

      expect(result.studyTips).toContain(
        expect.stringMatching(/overdue.*attention/)
      );
    });

    it('should handle insufficient time gracefully', () => {
      const result = planStudySession(testCards, 0.5); // 30 seconds

      expect(result.estimatedTime).toBeLessThanOrEqual(0.5);
      expect(result.recommendedCards.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeLearningProgress', () => {
    const progressCards = [
      {
        id: 'mastered-1',
        difficulty: 'medium',
        category: 'Math',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 5,
          easeFactor: 2.8,
          correctStreak: 5,
          lastReviewed: new Date().toISOString(),
        },
      },
      {
        id: 'struggling-1',
        difficulty: 'hard',
        category: 'Math',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 2,
          easeFactor: 1.8,
          correctStreak: 0,
          lastReviewed: new Date().toISOString(),
        },
      },
      {
        id: 'normal-1',
        difficulty: 'medium',
        category: 'Science',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 2,
          easeFactor: 2.3,
          correctStreak: 2,
          lastReviewed: new Date().toISOString(),
        },
      },
    ];

    it('should analyze progress correctly', () => {
      const result = analyzeLearningProgress(progressCards, 'all');

      expect(result.totalCards).toBe(3);
      expect(result.masteredCards).toBe(1); // mastered-1
      expect(result.strugglingCards).toBe(1); // struggling-1
      expect(result.averageEaseFactor).toBeCloseTo(2.3, 1);
      expect(result.categoryProgress).toHaveProperty('Math');
      expect(result.categoryProgress).toHaveProperty('Science');
    });

    it('should provide relevant recommendations', () => {
      const result = analyzeLearningProgress(progressCards, 'all');

      expect(result.recommendations.length).toBeGreaterThan(0);
      // Should have recommendations based on the struggling cards
      expect(result.recommendations.some(rec => 
        rec.includes('challenging') || rec.includes('attention')
      )).toBe(true);
    });

    it('should calculate next milestone correctly', () => {
      const result = analyzeLearningProgress(progressCards, 'all');

      expect(result.nextMilestone.current).toBe(1); // 1 mastered card
      expect(result.nextMilestone.target).toBe(10); // Next milestone
      expect(result.nextMilestone.description).toContain('10');
    });

    it('should analyze by category', () => {
      const result = analyzeLearningProgress(progressCards, 'all');

      expect(result.categoryProgress.Math.total).toBe(2);
      expect(result.categoryProgress.Math.mastered).toBe(1);
      expect(result.categoryProgress.Math.struggling).toBe(1);

      expect(result.categoryProgress.Science.total).toBe(1);
      expect(result.categoryProgress.Science.mastered).toBe(0);
      expect(result.categoryProgress.Science.struggling).toBe(0);
    });

    it('should filter by timeframe', () => {
      const oldCard = {
        id: 'old-card',
        difficulty: 'easy',
        category: 'History',
        spacedRepetition: {
          ...baseSpacedRepetition,
          repetition: 3,
          easeFactor: 2.5,
          correctStreak: 3,
          lastReviewed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        },
      };

      const cardsWithOld = [...progressCards, oldCard];
      const weekResult = analyzeLearningProgress(cardsWithOld, 'week');
      const allResult = analyzeLearningProgress(cardsWithOld, 'all');

      expect(weekResult.totalCards).toBe(3); // Should exclude old card
      expect(allResult.totalCards).toBe(4); // Should include old card
    });
  });
});