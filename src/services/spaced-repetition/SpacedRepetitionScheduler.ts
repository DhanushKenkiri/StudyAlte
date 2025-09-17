interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  lastReviewed?: string;
  nextReview?: string;
  reviewCount: number;
  correctCount: number;
  interval: number; // Days until next review
  easeFactor: number; // Ease factor for spaced repetition (1.3 - 2.5)
}

type ReviewResponse = 'correct' | 'incorrect' | 'hard';

export class SpacedRepetitionScheduler {
  private readonly MIN_EASE_FACTOR = 1.3;
  private readonly MAX_EASE_FACTOR = 2.5;
  private readonly DEFAULT_EASE_FACTOR = 2.5;
  private readonly INITIAL_INTERVAL = 1;
  private readonly SECOND_INTERVAL = 6;

  /**
   * Updates a flashcard based on the user's response using the SM-2 algorithm
   * with modifications for better learning outcomes.
   */
  updateCard(card: Flashcard, response: ReviewResponse): Flashcard {
    const now = new Date();
    const updatedCard = { ...card };

    // Update review statistics
    updatedCard.reviewCount += 1;
    updatedCard.lastReviewed = now.toISOString();

    // Calculate new interval and ease factor based on response
    const { interval, easeFactor } = this.calculateNewSchedule(
      card.interval,
      card.easeFactor,
      card.reviewCount,
      response
    );

    updatedCard.interval = interval;
    updatedCard.easeFactor = easeFactor;

    // Update correct count
    if (response === 'correct') {
      updatedCard.correctCount += 1;
    }

    // Calculate next review date
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    updatedCard.nextReview = nextReviewDate.toISOString();

    // Update difficulty based on performance
    updatedCard.difficulty = this.calculateDifficulty(updatedCard);

    return updatedCard;
  }

  /**
   * Calculates the new interval and ease factor using a modified SM-2 algorithm
   */
  private calculateNewSchedule(
    currentInterval: number,
    currentEaseFactor: number,
    reviewCount: number,
    response: ReviewResponse
  ): { interval: number; easeFactor: number } {
    let newInterval: number;
    let newEaseFactor = currentEaseFactor || this.DEFAULT_EASE_FACTOR;

    switch (response) {
      case 'correct':
        if (reviewCount === 1) {
          newInterval = this.INITIAL_INTERVAL;
        } else if (reviewCount === 2) {
          newInterval = this.SECOND_INTERVAL;
        } else {
          newInterval = Math.round(currentInterval * newEaseFactor);
        }
        
        // Increase ease factor slightly for correct answers
        newEaseFactor = Math.min(
          this.MAX_EASE_FACTOR,
          newEaseFactor + 0.1
        );
        break;

      case 'incorrect':
        // Reset interval for incorrect answers
        newInterval = this.INITIAL_INTERVAL;
        
        // Decrease ease factor significantly
        newEaseFactor = Math.max(
          this.MIN_EASE_FACTOR,
          newEaseFactor - 0.2
        );
        break;

      case 'hard':
        // Shorter interval for hard cards
        newInterval = Math.max(1, Math.round(currentInterval * 0.6));
        
        // Decrease ease factor moderately
        newEaseFactor = Math.max(
          this.MIN_EASE_FACTOR,
          newEaseFactor - 0.15
        );
        break;

      default:
        newInterval = currentInterval;
        break;
    }

    // Apply some randomization to prevent clustering
    newInterval = this.addJitter(newInterval);

    return {
      interval: Math.max(1, newInterval),
      easeFactor: newEaseFactor,
    };
  }

  /**
   * Adds slight randomization to intervals to prevent review clustering
   */
  private addJitter(interval: number): number {
    if (interval <= 1) return interval;
    
    const jitterRange = Math.max(1, Math.floor(interval * 0.1));
    const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
    
    return Math.max(1, interval + jitter);
  }

  /**
   * Calculates the difficulty level based on card performance
   */
  private calculateDifficulty(card: Flashcard): 'easy' | 'medium' | 'hard' {
    if (card.reviewCount === 0) {
      return card.difficulty; // Keep original difficulty for new cards
    }

    const accuracy = card.correctCount / card.reviewCount;
    const easeFactor = card.easeFactor;

    // Cards with high accuracy and high ease factor are easy
    if (accuracy >= 0.8 && easeFactor >= 2.2) {
      return 'easy';
    }

    // Cards with low accuracy or low ease factor are hard
    if (accuracy < 0.6 || easeFactor <= 1.5) {
      return 'hard';
    }

    // Everything else is medium
    return 'medium';
  }

  /**
   * Gets cards that are due for review
   */
  getDueCards(cards: Flashcard[]): Flashcard[] {
    const now = new Date();
    
    return cards.filter(card => {
      if (!card.nextReview) {
        return card.reviewCount === 0; // New cards are always due
      }
      
      return new Date(card.nextReview) <= now;
    });
  }

  /**
   * Gets new cards that haven't been reviewed yet
   */
  getNewCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter(card => card.reviewCount === 0);
  }

  /**
   * Gets cards that are considered difficult
   */
  getDifficultCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter(card => {
      if (card.reviewCount === 0) return false;
      
      const accuracy = card.correctCount / card.reviewCount;
      return card.difficulty === 'hard' || accuracy < 0.7 || card.easeFactor <= 1.6;
    });
  }

  /**
   * Sorts cards by priority for studying
   */
  sortCardsByPriority(cards: Flashcard[]): Flashcard[] {
    return [...cards].sort((a, b) => {
      // Overdue cards first
      const aOverdue = this.getDaysOverdue(a);
      const bOverdue = this.getDaysOverdue(b);
      
      if (aOverdue !== bOverdue) {
        return bOverdue - aOverdue; // More overdue first
      }

      // Then by difficulty (hard cards first)
      const difficultyOrder = { hard: 3, medium: 2, easy: 1 };
      const aDifficultyScore = difficultyOrder[a.difficulty];
      const bDifficultyScore = difficultyOrder[b.difficulty];
      
      if (aDifficultyScore !== bDifficultyScore) {
        return bDifficultyScore - aDifficultyScore;
      }

      // Finally by ease factor (lower ease factor first)
      return a.easeFactor - b.easeFactor;
    });
  }

  /**
   * Calculates how many days a card is overdue
   */
  private getDaysOverdue(card: Flashcard): number {
    if (!card.nextReview) return 0;
    
    const now = new Date();
    const dueDate = new Date(card.nextReview);
    const diffTime = now.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Gets study statistics for a set of cards
   */
  getStudyStats(cards: Flashcard[]): {
    total: number;
    new: number;
    due: number;
    difficult: number;
    averageAccuracy: number;
    totalReviews: number;
  } {
    const newCards = this.getNewCards(cards);
    const dueCards = this.getDueCards(cards);
    const difficultCards = this.getDifficultCards(cards);
    
    const totalReviews = cards.reduce((sum, card) => sum + card.reviewCount, 0);
    const totalCorrect = cards.reduce((sum, card) => sum + card.correctCount, 0);
    const averageAccuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

    return {
      total: cards.length,
      new: newCards.length,
      due: dueCards.length,
      difficult: difficultCards.length,
      averageAccuracy,
      totalReviews,
    };
  }

  /**
   * Recommends optimal study session size based on card difficulty and user performance
   */
  recommendSessionSize(cards: Flashcard[], targetMinutes: number = 20): number {
    const stats = this.getStudyStats(cards);
    
    // Estimate time per card based on difficulty
    const avgTimePerCard = this.estimateTimePerCard(cards);
    const maxCards = Math.floor((targetMinutes * 60) / avgTimePerCard);
    
    // Prioritize due cards, then new cards, then difficult cards
    const priorityCards = Math.min(
      maxCards,
      stats.due + Math.min(5, stats.new) + Math.min(3, stats.difficult)
    );
    
    return Math.max(1, Math.min(priorityCards, 20)); // Cap at 20 cards per session
  }

  /**
   * Estimates average time per card based on difficulty distribution
   */
  private estimateTimePerCard(cards: Flashcard[]): number {
    if (cards.length === 0) return 30; // Default 30 seconds
    
    const difficultyTimes = { easy: 15, medium: 25, hard: 40 };
    const totalTime = cards.reduce((sum, card) => sum + difficultyTimes[card.difficulty], 0);
    
    return totalTime / cards.length;
  }
}