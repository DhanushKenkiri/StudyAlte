import { logger } from '../shared/logger';

export interface ContentQualityMetrics {
  readability: number;
  coherence: number;
  informativeness: number;
  accuracy: number;
  overall: number;
}

export interface ContentValidationResult {
  isValid: boolean;
  quality: ContentQualityMetrics;
  issues: string[];
  recommendations: string[];
}

/**
 * Validate and assess the quality of generated summary content
 */
export function validateSummaryQuality(
  summary: string,
  originalTranscript: string,
  keyPoints: string[],
  topics: string[]
): ContentValidationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Basic validation checks
  if (!summary || summary.trim().length === 0) {
    issues.push('Summary is empty');
    return {
      isValid: false,
      quality: { readability: 0, coherence: 0, informativeness: 0, accuracy: 0, overall: 0 },
      issues,
      recommendations: ['Generate a new summary with valid content'],
    };
  }

  // Length validation
  const wordCount = summary.split(/\s+/).length;
  if (wordCount < 50) {
    issues.push('Summary is too short (less than 50 words)');
    recommendations.push('Expand the summary to include more key concepts');
  } else if (wordCount > 800) {
    issues.push('Summary is too long (more than 800 words)');
    recommendations.push('Condense the summary to focus on main points');
  }

  // Sentence structure validation
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) {
    issues.push('Summary has too few sentences');
    recommendations.push('Break down the content into multiple clear sentences');
  }

  // Calculate quality metrics
  const readability = calculateReadabilityScore(summary);
  const coherence = calculateCoherenceScore(summary, sentences);
  const informativeness = calculateInformativenessScore(summary, keyPoints, topics);
  const accuracy = calculateAccuracyScore(summary, originalTranscript);

  const overall = (readability + coherence + informativeness + accuracy) / 4;

  // Quality-based recommendations
  if (readability < 0.6) {
    recommendations.push('Simplify sentence structure and use clearer language');
  }
  if (coherence < 0.6) {
    recommendations.push('Improve logical flow and connections between ideas');
  }
  if (informativeness < 0.6) {
    recommendations.push('Include more specific details and key concepts');
  }
  if (accuracy < 0.6) {
    recommendations.push('Ensure content accurately reflects the original material');
  }

  const isValid = overall >= 0.5 && issues.length === 0;

  logger.info('Summary quality assessment completed', {
    wordCount,
    sentenceCount: sentences.length,
    quality: { readability, coherence, informativeness, accuracy, overall },
    isValid,
    issuesCount: issues.length,
  });

  return {
    isValid,
    quality: { readability, coherence, informativeness, accuracy, overall },
    issues,
    recommendations,
  };
}

/**
 * Calculate readability score based on sentence length and word complexity
 */
function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/);
  
  if (sentences.length === 0 || words.length === 0) return 0;

  // Average sentence length (optimal: 15-20 words)
  const avgSentenceLength = words.length / sentences.length;
  const sentenceLengthScore = Math.max(0, 1 - Math.abs(avgSentenceLength - 17.5) / 17.5);

  // Word complexity (percentage of words with 3+ syllables)
  const complexWords = words.filter(word => estimateSyllables(word) >= 3).length;
  const complexWordRatio = complexWords / words.length;
  const complexityScore = Math.max(0, 1 - complexWordRatio * 2); // Penalize high complexity

  // Average word length (optimal: 4-6 characters)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const wordLengthScore = Math.max(0, 1 - Math.abs(avgWordLength - 5) / 5);

  return (sentenceLengthScore + complexityScore + wordLengthScore) / 3;
}

/**
 * Calculate coherence score based on logical flow and transitions
 */
function calculateCoherenceScore(text: string, sentences: string[]): number {
  if (sentences.length < 2) return 0.5;

  let coherenceScore = 0;
  let transitionCount = 0;

  // Check for transition words and phrases
  const transitionWords = [
    'however', 'therefore', 'furthermore', 'moreover', 'additionally',
    'consequently', 'meanwhile', 'similarly', 'in contrast', 'for example',
    'specifically', 'in particular', 'as a result', 'on the other hand',
    'first', 'second', 'third', 'finally', 'in conclusion'
  ];

  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase();
    if (transitionWords.some(word => lowerSentence.includes(word))) {
      transitionCount++;
    }
  });

  // Transition score (optimal: 20-40% of sentences have transitions)
  const transitionRatio = transitionCount / sentences.length;
  const transitionScore = transitionRatio >= 0.2 && transitionRatio <= 0.4 ? 1 : 
                         Math.max(0, 1 - Math.abs(transitionRatio - 0.3) / 0.3);

  // Repetition check (penalize excessive repetition)
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words.filter(word => word.length > 3));
  const repetitionScore = Math.min(1, uniqueWords.size / (words.length * 0.7));

  coherenceScore = (transitionScore + repetitionScore) / 2;

  return Math.max(0, Math.min(1, coherenceScore));
}

/**
 * Calculate informativeness score based on key concepts coverage
 */
function calculateInformativenessScore(
  summary: string,
  keyPoints: string[],
  topics: string[]
): number {
  const summaryLower = summary.toLowerCase();
  
  // Check coverage of key points
  let keyPointsCovered = 0;
  keyPoints.forEach(point => {
    const pointWords = point.toLowerCase().split(/\s+/);
    const coverage = pointWords.filter(word => 
      word.length > 3 && summaryLower.includes(word)
    ).length;
    if (coverage / pointWords.length >= 0.5) {
      keyPointsCovered++;
    }
  });

  // Check coverage of topics
  let topicsCovered = 0;
  topics.forEach(topic => {
    const topicWords = topic.toLowerCase().split(/\s+/);
    const coverage = topicWords.filter(word => 
      word.length > 3 && summaryLower.includes(word)
    ).length;
    if (coverage / topicWords.length >= 0.5) {
      topicsCovered++;
    }
  });

  const keyPointsScore = keyPoints.length > 0 ? keyPointsCovered / keyPoints.length : 0.5;
  const topicsScore = topics.length > 0 ? topicsCovered / topics.length : 0.5;

  // Information density (unique meaningful words per sentence)
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const meaningfulWords = summary.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !isCommonWord(word));
  const uniqueMeaningfulWords = new Set(meaningfulWords);
  const densityScore = sentences.length > 0 ? 
    Math.min(1, uniqueMeaningfulWords.size / sentences.length / 5) : 0;

  return (keyPointsScore * 0.4 + topicsScore * 0.4 + densityScore * 0.2);
}

/**
 * Calculate accuracy score by comparing with original transcript
 */
function calculateAccuracyScore(summary: string, originalTranscript: string): number {
  const summaryWords = summary.toLowerCase().split(/\s+/)
    .filter(word => word.length > 3 && !isCommonWord(word));
  const transcriptWords = originalTranscript.toLowerCase().split(/\s+/)
    .filter(word => word.length > 3 && !isCommonWord(word));

  if (summaryWords.length === 0) return 0;

  // Calculate overlap of meaningful words
  const transcriptWordSet = new Set(transcriptWords);
  const accurateWords = summaryWords.filter(word => transcriptWordSet.has(word));
  const accuracyRatio = accurateWords.length / summaryWords.length;

  // Penalize if summary is too different from original content
  const uniqueSummaryWords = summaryWords.filter(word => !transcriptWordSet.has(word));
  const noveltyRatio = uniqueSummaryWords.length / summaryWords.length;
  
  // Some novelty is good (paraphrasing), but too much suggests inaccuracy
  const noveltyScore = noveltyRatio <= 0.3 ? 1 : Math.max(0, 1 - (noveltyRatio - 0.3) / 0.4);

  return (accuracyRatio * 0.7 + noveltyScore * 0.3);
}

/**
 * Estimate syllables in a word (simple heuristic)
 */
function estimateSyllables(word: string): number {
  if (word.length <= 3) return 1;
  
  const vowels = word.toLowerCase().match(/[aeiouy]+/g);
  let syllables = vowels ? vowels.length : 1;
  
  // Adjust for silent 'e'
  if (word.toLowerCase().endsWith('e')) {
    syllables--;
  }
  
  return Math.max(1, syllables);
}

/**
 * Check if a word is a common stop word
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
    'did', 'she', 'use', 'way', 'will', 'with', 'this', 'that', 'they',
    'have', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some',
    'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make',
    'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'
  ]);
  
  return commonWords.has(word.toLowerCase());
}

/**
 * Filter and improve summary based on quality assessment
 */
export function improveSummaryQuality(
  summary: string,
  qualityResult: ContentValidationResult
): string {
  if (qualityResult.isValid && qualityResult.quality.overall >= 0.8) {
    return summary; // Already high quality
  }

  let improvedSummary = summary;

  // Fix common issues
  if (qualityResult.issues.includes('Summary is too short (less than 50 words)')) {
    // This would typically require regeneration with more content
    logger.info('Summary too short - requires regeneration');
  }

  if (qualityResult.issues.includes('Summary is too long (more than 800 words)')) {
    // Truncate to reasonable length while preserving sentence boundaries
    const sentences = improvedSummary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let truncated = '';
    let wordCount = 0;
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      if (wordCount + sentenceWords <= 400) { // Target ~400 words
        truncated += sentence.trim() + '. ';
        wordCount += sentenceWords;
      } else {
        break;
      }
    }
    
    improvedSummary = truncated.trim();
  }

  // Clean up formatting
  improvedSummary = improvedSummary
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\.\s*\./g, '.') // Remove double periods
    .trim();

  return improvedSummary;
}