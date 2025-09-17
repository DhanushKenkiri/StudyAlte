import { logger } from '../shared/logger';

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  timeLimit?: number;
  tags: string[];
  category: string;
  hints?: string[];
}

export interface QuizValidationResult {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  category: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface QuizCollectionValidation {
  validQuestions: QuizQuestion[];
  invalidQuestions: Array<{ question: QuizQuestion; issues: string[] }>;
  overallScore: number;
  qualityDistribution: Record<string, number>;
  recommendations: string[];
  statistics: {
    totalQuestions: number;
    validQuestions: number;
    averageScore: number;
    difficultyBalance: Record<string, number>;
    typeBalance: Record<string, number>;
  };
}

export interface AnswerValidationResult {
  isCorrect: boolean;
  score: number; // 0-1 for partial credit
  feedback: string;
  explanation?: string;
  hints?: string[];
}

/**
 * Validate a single quiz question for quality and correctness
 */
export function validateQuizQuestion(question: QuizQuestion): QuizValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0.5; // Base score

  // Validate question text
  const questionScore = validateQuestionText(question.question, issues, suggestions);
  score += questionScore * 0.3;

  // Validate answer format
  const answerScore = validateAnswerFormat(question, issues, suggestions);
  score += answerScore * 0.25;

  // Validate options (for multiple-choice)
  const optionsScore = validateOptions(question, issues, suggestions);
  score += optionsScore * 0.2;

  // Validate explanation
  const explanationScore = validateExplanation(question.explanation, issues, suggestions);
  score += explanationScore * 0.15;

  // Validate difficulty appropriateness
  const difficultyScore = validateDifficulty(question, issues, suggestions);
  score += difficultyScore * 0.1;

  // Determine category
  let category: QuizValidationResult['category'];
  if (score >= 0.85) category = 'excellent';
  else if (score >= 0.7) category = 'good';
  else if (score >= 0.5) category = 'fair';
  else category = 'poor';

  const isValid = score >= 0.4 && issues.length < 3;

  logger.debug('Quiz question validated', {
    questionId: question.id,
    type: question.type,
    score,
    category,
    issuesCount: issues.length,
    isValid,
  });

  return {
    isValid,
    score,
    issues,
    suggestions,
    category,
  };
}

/**
 * Validate question text quality
 */
function validateQuestionText(questionText: string, issues: string[], suggestions: string[]): number {
  let score = 0.5;

  // Length validation
  if (questionText.length < 10) {
    issues.push('Question is too short and lacks context');
    suggestions.push('Expand the question to provide more context');
    score -= 0.3;
  } else if (questionText.length > 200) {
    issues.push('Question is too long and may be confusing');
    suggestions.push('Simplify the question to focus on one concept');
    score -= 0.2;
  } else {
    score += 0.2;
  }

  // Question format validation
  if (questionText.includes('?') || 
      questionText.toLowerCase().match(/^(what|how|why|when|where|which|who)/)) {
    score += 0.1;
  } else {
    suggestions.push('Consider phrasing as a clear question');
  }

  // Clarity indicators
  if (questionText.includes('according to') || questionText.includes('based on')) {
    score += 0.1; // Good context reference
  }

  // Avoid ambiguous language
  const ambiguousWords = ['some', 'many', 'often', 'usually', 'sometimes'];
  const ambiguousCount = ambiguousWords.filter(word => 
    questionText.toLowerCase().includes(word)
  ).length;
  
  if (ambiguousCount > 1) {
    issues.push('Question contains ambiguous language');
    suggestions.push('Use more specific and precise language');
    score -= 0.1;
  }

  // Check for double negatives
  if (questionText.toLowerCase().includes('not') && 
      questionText.toLowerCase().includes('never')) {
    issues.push('Question contains confusing double negatives');
    suggestions.push('Rephrase to avoid double negatives');
    score -= 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Validate answer format based on question type
 */
function validateAnswerFormat(question: QuizQuestion, issues: string[], suggestions: string[]): number {
  let score = 0.5;

  switch (question.type) {
    case 'multiple-choice':
      if (!question.options || question.options.length < 2) {
        issues.push('Multiple-choice question must have at least 2 options');
        score = 0;
      } else if (question.options.length > 5) {
        suggestions.push('Consider limiting to 4-5 options for better usability');
        score += 0.2;
      } else if (question.options.length === 4) {
        score += 0.3; // Optimal number of options
      }

      // Check for option quality
      if (question.options) {
        const optionLengths = question.options.map(opt => opt.length);
        const avgLength = optionLengths.reduce((sum, len) => sum + len, 0) / optionLengths.length;
        const lengthVariance = optionLengths.some(len => Math.abs(len - avgLength) > avgLength * 0.5);
        
        if (lengthVariance) {
          suggestions.push('Try to keep option lengths similar to avoid giving away the answer');
        } else {
          score += 0.1;
        }
      }
      break;

    case 'true-false':
      if (typeof question.correctAnswer !== 'string' || 
          !['true', 'false', 'True', 'False'].includes(question.correctAnswer)) {
        issues.push('True-false question must have "True" or "False" as correct answer');
        score = 0;
      } else {
        score += 0.3;
      }
      break;

    case 'short-answer':
      if (!question.correctAnswer || question.correctAnswer.toString().length < 2) {
        issues.push('Short-answer question must have a meaningful correct answer');
        score = 0;
      } else if (question.correctAnswer.toString().length > 100) {
        suggestions.push('Consider shortening the expected answer for easier grading');
        score += 0.1;
      } else {
        score += 0.3;
      }
      break;

    case 'fill-blank':
      if (!question.question.includes('_____') && !question.question.includes('[blank]')) {
        issues.push('Fill-in-the-blank question must indicate where the blank is');
        score = 0;
      } else {
        score += 0.3;
      }
      break;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Validate multiple-choice options quality
 */
function validateOptions(question: QuizQuestion, issues: string[], suggestions: string[]): number {
  if (question.type !== 'multiple-choice' || !question.options) {
    return 1; // Not applicable
  }

  let score = 0.5;
  const options = question.options;

  // Check for duplicate options
  const uniqueOptions = new Set(options.map(opt => opt.toLowerCase().trim()));
  if (uniqueOptions.size !== options.length) {
    issues.push('Multiple-choice options contain duplicates');
    score -= 0.3;
  }

  // Check if correct answer exists in options
  const correctAnswerInOptions = options.some(opt => 
    opt.toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim()
  );
  
  if (!correctAnswerInOptions) {
    issues.push('Correct answer is not found in the provided options');
    score = 0;
  } else {
    score += 0.2;
  }

  // Check for plausible distractors
  const shortOptions = options.filter(opt => opt.length < 5).length;
  if (shortOptions > options.length * 0.5) {
    suggestions.push('Consider making distractors more detailed and plausible');
  } else {
    score += 0.1;
  }

  // Check for "all of the above" or "none of the above"
  const hasAllNone = options.some(opt => 
    opt.toLowerCase().includes('all of the above') || 
    opt.toLowerCase().includes('none of the above')
  );
  
  if (hasAllNone) {
    suggestions.push('Avoid "all/none of the above" options when possible');
  } else {
    score += 0.1;
  }

  // Check option ordering (should not give away answer)
  const correctIndex = options.findIndex(opt => 
    opt.toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim()
  );
  
  if (correctIndex === 0 || correctIndex === options.length - 1) {
    suggestions.push('Consider placing correct answer in middle positions');
  } else {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Validate explanation quality
 */
function validateExplanation(explanation: string, issues: string[], suggestions: string[]): number {
  let score = 0.5;

  if (!explanation || explanation.length < 10) {
    issues.push('Explanation is missing or too brief');
    suggestions.push('Provide a detailed explanation of the correct answer');
    score = 0;
  } else if (explanation.length > 300) {
    suggestions.push('Consider shortening the explanation to key points');
    score += 0.2;
  } else {
    score += 0.3;
  }

  // Check for explanation quality indicators
  if (explanation.includes('because') || explanation.includes('since') || 
      explanation.includes('due to') || explanation.includes('therefore')) {
    score += 0.1; // Good reasoning
  }

  if (explanation.includes('example') || explanation.includes('for instance')) {
    score += 0.1; // Provides examples
  }

  // Check if explanation just repeats the answer
  const explanationWords = explanation.toLowerCase().split(/\s+/);
  const answerWords = explanation.toLowerCase().split(/\s+/);
  const overlap = explanationWords.filter(word => answerWords.includes(word)).length;
  
  if (overlap / explanationWords.length > 0.8) {
    issues.push('Explanation mostly repeats the answer without adding value');
    suggestions.push('Provide additional context and reasoning in the explanation');
    score -= 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Validate difficulty appropriateness
 */
function validateDifficulty(question: QuizQuestion, issues: string[], suggestions: string[]): number {
  let score = 0.5;

  // Check if points match difficulty
  const expectedPoints = {
    easy: [1, 2],
    medium: [2, 3],
    hard: [3, 4, 5],
  };

  if (!expectedPoints[question.difficulty].includes(question.points)) {
    suggestions.push(`Consider adjusting points to match ${question.difficulty} difficulty`);
  } else {
    score += 0.2;
  }

  // Check if time limit matches difficulty
  const expectedTime = {
    easy: [15, 45],
    medium: [30, 90],
    hard: [60, 180],
  };

  const timeLimit = question.timeLimit || 60;
  const [minTime, maxTime] = expectedTime[question.difficulty];
  
  if (timeLimit < minTime || timeLimit > maxTime) {
    suggestions.push(`Consider adjusting time limit for ${question.difficulty} difficulty`);
  } else {
    score += 0.2;
  }

  // Assess question complexity
  const questionComplexity = assessQuestionComplexity(question.question);
  const difficultyMap = { easy: 0.3, medium: 0.6, hard: 0.9 };
  const expectedComplexity = difficultyMap[question.difficulty];
  
  if (Math.abs(questionComplexity - expectedComplexity) > 0.3) {
    suggestions.push(`Question complexity doesn't match ${question.difficulty} difficulty`);
  } else {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Assess question complexity based on various factors
 */
function assessQuestionComplexity(questionText: string): number {
  let complexity = 0.3; // Base complexity

  // Word count factor
  const wordCount = questionText.split(/\s+/).length;
  if (wordCount > 20) complexity += 0.2;
  else if (wordCount > 10) complexity += 0.1;

  // Complex words factor
  const complexWords = questionText.split(/\s+/).filter(word => word.length > 8).length;
  complexity += (complexWords / wordCount) * 0.3;

  // Question type complexity
  if (questionText.toLowerCase().includes('analyze') || 
      questionText.toLowerCase().includes('evaluate') ||
      questionText.toLowerCase().includes('compare')) {
    complexity += 0.2;
  } else if (questionText.toLowerCase().includes('explain') ||
             questionText.toLowerCase().includes('describe')) {
    complexity += 0.1;
  }

  return Math.min(1, complexity);
}

/**
 * Validate a collection of quiz questions
 */
export function validateQuizCollection(questions: QuizQuestion[]): QuizCollectionValidation {
  const validQuestions: QuizQuestion[] = [];
  const invalidQuestions: Array<{ question: QuizQuestion; issues: string[] }> = [];
  const scores: number[] = [];
  const qualityDistribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  // Validate each question
  questions.forEach(question => {
    const validation = validateQuizQuestion(question);
    scores.push(validation.score);
    qualityDistribution[validation.category]++;

    if (validation.isValid) {
      validQuestions.push(question);
    } else {
      invalidQuestions.push({
        question,
        issues: validation.issues,
      });
    }
  });

  const overallScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

  // Calculate statistics
  const difficultyBalance = questions.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeBalance = questions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Generate recommendations
  const recommendations: string[] = [];

  if (invalidQuestions.length > questions.length * 0.2) {
    recommendations.push('High number of invalid questions - review generation parameters');
  }

  if (overallScore < 0.6) {
    recommendations.push('Overall question quality is low - consider regenerating');
  }

  if (qualityDistribution.poor > questions.length * 0.3) {
    recommendations.push('Many questions are of poor quality - focus on clarity and accuracy');
  }

  // Check balance
  const difficultyEntries = Object.entries(difficultyBalance);
  const isBalanced = difficultyEntries.every(([, count]) => count >= questions.length * 0.2);
  
  if (!isBalanced && questions.length > 5) {
    recommendations.push('Consider better difficulty distribution across questions');
  }

  logger.info('Quiz collection validated', {
    totalQuestions: questions.length,
    validQuestions: validQuestions.length,
    invalidQuestions: invalidQuestions.length,
    overallScore,
    qualityDistribution,
  });

  return {
    validQuestions,
    invalidQuestions,
    overallScore,
    qualityDistribution,
    recommendations,
    statistics: {
      totalQuestions: questions.length,
      validQuestions: validQuestions.length,
      averageScore: overallScore,
      difficultyBalance,
      typeBalance,
    },
  };
}

/**
 * Validate a user's answer to a quiz question
 */
export function validateAnswer(
  question: QuizQuestion,
  userAnswer: string | string[],
  options?: {
    caseSensitive?: boolean;
    allowPartialCredit?: boolean;
    strictMatching?: boolean;
  }
): AnswerValidationResult {
  const {
    caseSensitive = false,
    allowPartialCredit = true,
    strictMatching = false,
  } = options || {};

  let isCorrect = false;
  let score = 0;
  let feedback = '';
  const hints: string[] = [];

  const correctAnswer = Array.isArray(question.correctAnswer) 
    ? question.correctAnswer 
    : [question.correctAnswer.toString()];

  const userAnswerArray = Array.isArray(userAnswer) 
    ? userAnswer 
    : [userAnswer.toString()];

  switch (question.type) {
    case 'multiple-choice':
      isCorrect = validateMultipleChoice(correctAnswer[0], userAnswerArray[0], caseSensitive);
      score = isCorrect ? 1 : 0;
      feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer[0]}`;
      break;

    case 'true-false':
      isCorrect = validateTrueFalse(correctAnswer[0], userAnswerArray[0], caseSensitive);
      score = isCorrect ? 1 : 0;
      feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer[0]}`;
      break;

    case 'short-answer':
      const shortAnswerResult = validateShortAnswer(
        correctAnswer,
        userAnswerArray[0],
        { caseSensitive, allowPartialCredit, strictMatching }
      );
      isCorrect = shortAnswerResult.isCorrect;
      score = shortAnswerResult.score;
      feedback = shortAnswerResult.feedback;
      break;

    case 'fill-blank':
      const fillBlankResult = validateFillBlank(
        correctAnswer,
        userAnswerArray[0],
        { caseSensitive, allowPartialCredit }
      );
      isCorrect = fillBlankResult.isCorrect;
      score = fillBlankResult.score;
      feedback = fillBlankResult.feedback;
      break;
  }

  // Add hints for incorrect answers
  if (!isCorrect && question.hints) {
    hints.push(...question.hints);
  }

  return {
    isCorrect,
    score,
    feedback,
    explanation: question.explanation,
    hints: hints.length > 0 ? hints : undefined,
  };
}

/**
 * Validate multiple-choice answer
 */
function validateMultipleChoice(correct: string, user: string, caseSensitive: boolean): boolean {
  const correctNormalized = caseSensitive ? correct : correct.toLowerCase().trim();
  const userNormalized = caseSensitive ? user : user.toLowerCase().trim();
  return correctNormalized === userNormalized;
}

/**
 * Validate true-false answer
 */
function validateTrueFalse(correct: string, user: string, caseSensitive: boolean): boolean {
  const correctNormalized = caseSensitive ? correct : correct.toLowerCase().trim();
  const userNormalized = caseSensitive ? user : user.toLowerCase().trim();
  
  // Handle various true/false formats
  const trueValues = ['true', 't', '1', 'yes', 'y'];
  const falseValues = ['false', 'f', '0', 'no', 'n'];
  
  const correctIsTrueish = trueValues.includes(correctNormalized);
  const userIsTrueish = trueValues.includes(userNormalized);
  
  return correctIsTrueish === userIsTrueish;
}

/**
 * Validate short-answer response
 */
function validateShortAnswer(
  correctAnswers: string[],
  userAnswer: string,
  options: { caseSensitive: boolean; allowPartialCredit: boolean; strictMatching: boolean }
): { isCorrect: boolean; score: number; feedback: string } {
  const { caseSensitive, allowPartialCredit, strictMatching } = options;
  
  const userNormalized = caseSensitive ? userAnswer.trim() : userAnswer.toLowerCase().trim();
  
  // Check for exact matches first
  for (const correct of correctAnswers) {
    const correctNormalized = caseSensitive ? correct.trim() : correct.toLowerCase().trim();
    if (userNormalized === correctNormalized) {
      return { isCorrect: true, score: 1, feedback: 'Correct!' };
    }
  }

  if (strictMatching) {
    return { 
      isCorrect: false, 
      score: 0, 
      feedback: `Incorrect. Expected: ${correctAnswers.join(' or ')}` 
    };
  }

  // Check for partial matches if allowed
  if (allowPartialCredit) {
    let bestScore = 0;
    let bestMatch = '';

    for (const correct of correctAnswers) {
      const correctNormalized = caseSensitive ? correct.trim() : correct.toLowerCase().trim();
      const similarity = calculateStringSimilarity(userNormalized, correctNormalized);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = correct;
      }
    }

    if (bestScore >= 0.8) {
      return { isCorrect: true, score: bestScore, feedback: 'Mostly correct!' };
    } else if (bestScore >= 0.6) {
      return { 
        isCorrect: false, 
        score: bestScore * 0.5, 
        feedback: `Partially correct. Expected: ${bestMatch}` 
      };
    }
  }

  return { 
    isCorrect: false, 
    score: 0, 
    feedback: `Incorrect. Expected: ${correctAnswers.join(' or ')}` 
  };
}

/**
 * Validate fill-in-the-blank answer
 */
function validateFillBlank(
  correctAnswers: string[],
  userAnswer: string,
  options: { caseSensitive: boolean; allowPartialCredit: boolean }
): { isCorrect: boolean; score: number; feedback: string } {
  // Fill-blank is similar to short-answer but typically more lenient
  return validateShortAnswer(correctAnswers, userAnswer, {
    ...options,
    strictMatching: false,
  });
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
}