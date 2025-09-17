import { logger } from '../shared/logger';

export interface FlashcardQualityMetrics {
  clarity: number;
  difficulty: number;
  relevance: number;
  completeness: number;
  engagement: number;
  overall: number;
}

export interface FlashcardQualityAssessment {
  score: FlashcardQualityMetrics;
  issues: string[];
  suggestions: string[];
  isValid: boolean;
  category: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface FlashcardValidationResult {
  validCards: any[];
  invalidCards: any[];
  qualityDistribution: Record<string, number>;
  averageQuality: number;
  recommendations: string[];
}

/**
 * Assess the quality of a single flashcard
 */
export function assessFlashcardQuality(
  front: string,
  back: string,
  category?: string,
  type?: string,
  tags?: string[]
): FlashcardQualityAssessment {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Assess clarity (how clear and understandable the card is)
  const clarity = assessClarity(front, back, issues, suggestions);

  // Assess difficulty appropriateness
  const difficulty = assessDifficulty(front, back, issues, suggestions);

  // Assess relevance (how well front and back relate)
  const relevance = assessRelevance(front, back, issues, suggestions);

  // Assess completeness (whether the answer is complete)
  const completeness = assessCompleteness(front, back, issues, suggestions);

  // Assess engagement (how engaging/memorable the card is)
  const engagement = assessEngagement(front, back, category, type, issues, suggestions);

  // Calculate overall score
  const overall = (clarity * 0.25 + difficulty * 0.2 + relevance * 0.25 + completeness * 0.2 + engagement * 0.1);

  // Determine category
  let qualityCategory: FlashcardQualityAssessment['category'];
  if (overall >= 0.85) qualityCategory = 'excellent';
  else if (overall >= 0.7) qualityCategory = 'good';
  else if (overall >= 0.5) qualityCategory = 'fair';
  else qualityCategory = 'poor';

  const isValid = overall >= 0.4 && issues.length < 3;

  logger.debug('Flashcard quality assessed', {
    front: front.substring(0, 50),
    overall,
    category: qualityCategory,
    issuesCount: issues.length,
    isValid,
  });

  return {
    score: {
      clarity,
      difficulty,
      relevance,
      completeness,
      engagement,
      overall,
    },
    issues,
    suggestions,
    isValid,
    category: qualityCategory,
  };
}

/**
 * Assess clarity of the flashcard
 */
function assessClarity(front: string, back: string, issues: string[], suggestions: string[]): number {
  let score = 0.5; // Base score

  // Front side clarity
  if (front.length < 10) {
    issues.push('Question is too short and may lack context');
    suggestions.push('Expand the question to provide more context');
  } else if (front.length > 150) {
    issues.push('Question is too long and may be confusing');
    suggestions.push('Simplify the question to focus on one concept');
    score -= 0.2;
  } else {
    score += 0.2;
  }

  // Check for question format
  if (front.includes('?') || front.toLowerCase().startsWith('what') || 
      front.toLowerCase().startsWith('how') || front.toLowerCase().startsWith('why') ||
      front.toLowerCase().startsWith('when') || front.toLowerCase().startsWith('where')) {
    score += 0.1;
  } else {
    suggestions.push('Consider phrasing the front as a clear question');
  }

  // Back side clarity
  if (back.length < 15) {
    issues.push('Answer is too brief and may lack explanation');
    suggestions.push('Provide a more detailed explanation in the answer');
  } else if (back.length > 400) {
    issues.push('Answer is too long and may be overwhelming');
    suggestions.push('Condense the answer to focus on key points');
    score -= 0.1;
  } else {
    score += 0.2;
  }

  // Check for explanation indicators
  if (back.includes('because') || back.includes('means') || back.includes('refers to') ||
      back.includes('example') || back.includes('such as')) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Assess difficulty appropriateness
 */
function assessDifficulty(front: string, back: string, issues: string[], suggestions: string[]): number {
  let score = 0.6; // Base score

  // Vocabulary complexity
  const frontWords = front.split(/\s+/);
  const backWords = back.split(/\s+/);
  
  const complexFrontWords = frontWords.filter(word => word.length > 8).length;
  const complexBackWords = backWords.filter(word => word.length > 8).length;
  
  const frontComplexity = complexFrontWords / frontWords.length;
  const backComplexity = complexBackWords / backWords.length;

  // Moderate complexity is good (not too simple, not too complex)
  if (frontComplexity > 0.4) {
    issues.push('Question uses too many complex terms');
    suggestions.push('Simplify the question language while maintaining precision');
    score -= 0.2;
  } else if (frontComplexity > 0.1) {
    score += 0.1; // Good complexity
  }

  if (backComplexity > 0.5) {
    issues.push('Answer is overly complex');
    suggestions.push('Break down complex concepts into simpler explanations');
    score -= 0.1;
  } else if (backComplexity > 0.2) {
    score += 0.1; // Good complexity
  }

  // Sentence structure complexity
  const frontSentences = front.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const backSentences = back.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (frontSentences.length > 2) {
    issues.push('Question has too many sentences');
    suggestions.push('Focus the question on a single concept');
    score -= 0.1;
  }

  if (backSentences.length > 4) {
    suggestions.push('Consider breaking the answer into shorter sentences');
  } else if (backSentences.length >= 2) {
    score += 0.1; // Good structure
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Assess relevance between front and back
 */
function assessRelevance(front: string, back: string, issues: string[], suggestions: string[]): number {
  let score = 0.5; // Base score

  const frontWords = front.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  const backWords = back.toLowerCase().split(/\s+/).filter(word => word.length > 3);

  // Calculate word overlap
  const commonWords = frontWords.filter(word => backWords.includes(word));
  const overlapRatio = commonWords.length / Math.max(frontWords.length, backWords.length);

  if (overlapRatio < 0.1) {
    issues.push('Question and answer seem unrelated');
    suggestions.push('Ensure the answer directly addresses the question');
    score -= 0.3;
  } else if (overlapRatio > 0.8) {
    issues.push('Answer repeats the question too much');
    suggestions.push('Provide additional explanation beyond restating the question');
    score -= 0.1;
  } else if (overlapRatio >= 0.2 && overlapRatio <= 0.5) {
    score += 0.3; // Good overlap
  }

  // Check for direct answer patterns
  if (front.toLowerCase().includes('what is') && back.toLowerCase().includes('is')) {
    score += 0.1;
  }

  if (front.toLowerCase().includes('how') && 
      (back.toLowerCase().includes('by') || back.toLowerCase().includes('through'))) {
    score += 0.1;
  }

  // Check for definition patterns
  if (front.toLowerCase().includes('define') || front.toLowerCase().includes('definition')) {
    if (back.toLowerCase().includes('means') || back.toLowerCase().includes('refers to')) {
      score += 0.1;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Assess completeness of the answer
 */
function assessCompleteness(front: string, back: string, issues: string[], suggestions: string[]): number {
  let score = 0.5; // Base score

  // Check for incomplete answers
  if (back.endsWith('...') || back.includes('etc.') || back.includes('and so on')) {
    issues.push('Answer appears incomplete');
    suggestions.push('Provide a complete answer without trailing indicators');
    score -= 0.2;
  }

  // Check for examples when appropriate
  if (front.toLowerCase().includes('example') && !back.toLowerCase().includes('example')) {
    issues.push('Question asks for examples but answer doesn\'t provide them');
    suggestions.push('Include specific examples in the answer');
    score -= 0.2;
  }

  // Check for explanation depth
  const backSentences = back.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (backSentences.length === 1 && back.length < 50) {
    suggestions.push('Consider adding more explanation or context to the answer');
  } else if (backSentences.length >= 2) {
    score += 0.2; // Good depth
  }

  // Check for context provision
  if (back.includes('because') || back.includes('since') || back.includes('due to')) {
    score += 0.1; // Provides reasoning
  }

  if (back.includes('for example') || back.includes('such as') || back.includes('like')) {
    score += 0.1; // Provides examples
  }

  // Check for balanced detail
  if (back.length < 20) {
    issues.push('Answer is too brief');
    suggestions.push('Expand the answer with more detail');
    score -= 0.2;
  } else if (back.length > 300) {
    suggestions.push('Consider condensing the answer to key points');
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Assess engagement and memorability
 */
function assessEngagement(
  front: string, 
  back: string, 
  category?: string, 
  type?: string, 
  issues: string[], 
  suggestions: string[]
): number {
  let score = 0.5; // Base score

  // Check for engaging question formats
  if (front.includes('Why') || front.includes('How')) {
    score += 0.1; // More engaging than simple "What is"
  }

  // Check for memorable elements
  if (back.includes('example') || back.includes('analogy') || back.includes('like')) {
    score += 0.1; // Examples make cards more memorable
  }

  // Check for active voice
  const passiveIndicators = ['is', 'are', 'was', 'were', 'been', 'being'];
  const backWords = back.toLowerCase().split(/\s+/);
  const passiveCount = passiveIndicators.filter(indicator => backWords.includes(indicator)).length;
  
  if (passiveCount / backWords.length > 0.1) {
    suggestions.push('Consider using more active voice in the answer');
  } else {
    score += 0.1;
  }

  // Check for specific vs. vague language
  const vaguePhrases = ['some', 'many', 'often', 'usually', 'sometimes', 'various'];
  const vagueCount = vaguePhrases.filter(phrase => back.toLowerCase().includes(phrase)).length;
  
  if (vagueCount > 2) {
    suggestions.push('Use more specific language instead of vague terms');
    score -= 0.1;
  }

  // Bonus for appropriate card types
  if (type === 'example' && back.includes('example')) {
    score += 0.1;
  }

  if (type === 'definition' && (back.includes('means') || back.includes('refers to'))) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Validate and filter a collection of flashcards
 */
export function validateFlashcardCollection(flashcards: any[]): FlashcardValidationResult {
  const validCards: any[] = [];
  const invalidCards: any[] = [];
  const qualityScores: number[] = [];
  const qualityDistribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  flashcards.forEach(card => {
    const assessment = assessFlashcardQuality(
      card.front,
      card.back,
      card.category,
      card.type,
      card.tags
    );

    qualityScores.push(assessment.score.overall);
    qualityDistribution[assessment.category]++;

    if (assessment.isValid) {
      validCards.push({
        ...card,
        qualityAssessment: assessment,
        qualityScore: assessment.score.overall,
      });
    } else {
      invalidCards.push({
        ...card,
        qualityAssessment: assessment,
        rejectionReasons: assessment.issues,
      });
    }
  });

  const averageQuality = qualityScores.length > 0 
    ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
    : 0;

  // Generate collection-level recommendations
  const recommendations: string[] = [];

  if (invalidCards.length > flashcards.length * 0.2) {
    recommendations.push('High number of invalid cards detected - review generation parameters');
  }

  if (averageQuality < 0.6) {
    recommendations.push('Overall card quality is low - consider regenerating with different prompts');
  }

  if (qualityDistribution.poor > flashcards.length * 0.3) {
    recommendations.push('Many cards are of poor quality - focus on clarity and relevance');
  }

  if (qualityDistribution.excellent < flashcards.length * 0.1) {
    recommendations.push('Few excellent cards - consider enhancing content depth and examples');
  }

  logger.info('Flashcard collection validated', {
    totalCards: flashcards.length,
    validCards: validCards.length,
    invalidCards: invalidCards.length,
    averageQuality,
    qualityDistribution,
  });

  return {
    validCards,
    invalidCards,
    qualityDistribution,
    averageQuality,
    recommendations,
  };
}

/**
 * Improve a flashcard based on quality assessment
 */
export function improveFlashcard(
  card: any,
  assessment: FlashcardQualityAssessment
): any {
  if (assessment.category === 'excellent' || assessment.category === 'good') {
    return card; // Already good quality
  }

  let improvedFront = card.front;
  let improvedBack = card.back;

  // Apply common improvements based on issues
  assessment.issues.forEach(issue => {
    if (issue.includes('too short')) {
      // This would typically require regeneration with more context
      logger.info('Card needs expansion - requires regeneration');
    }

    if (issue.includes('too long')) {
      // Truncate while preserving meaning
      if (improvedFront.length > 150) {
        improvedFront = improvedFront.substring(0, 147) + '...';
      }
      if (improvedBack.length > 400) {
        const sentences = improvedBack.split(/[.!?]+/);
        improvedBack = sentences.slice(0, 3).join('. ') + '.';
      }
    }

    if (issue.includes('unrelated')) {
      logger.info('Card relevance issue - requires regeneration');
    }
  });

  // Clean up formatting
  improvedFront = improvedFront.trim().replace(/\s+/g, ' ');
  improvedBack = improvedBack.trim().replace(/\s+/g, ' ');

  // Ensure proper punctuation
  if (!improvedFront.endsWith('?') && 
      (improvedFront.toLowerCase().startsWith('what') || 
       improvedFront.toLowerCase().startsWith('how') ||
       improvedFront.toLowerCase().startsWith('why'))) {
    improvedFront += '?';
  }

  return {
    ...card,
    front: improvedFront,
    back: improvedBack,
    qualityImproved: true,
    originalQuality: assessment.score.overall,
  };
}