import {
  validateQuizQuestion,
  validateQuizCollection,
  validateAnswer,
  QuizQuestion,
} from '../quiz-validation';

describe('Quiz Validation Service', () => {
  const baseQuestion: QuizQuestion = {
    id: 'test-question-1',
    type: 'multiple-choice',
    question: 'What is machine learning?',
    options: ['AI subset', 'Programming language', 'Database system', 'Hardware component'],
    correctAnswer: 'AI subset',
    explanation: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
    difficulty: 'medium',
    points: 2,
    timeLimit: 60,
    tags: ['AI', 'ML'],
    category: 'Definitions',
  };

  describe('validateQuizQuestion', () => {
    it('should validate a well-formed multiple-choice question', () => {
      const result = validateQuizQuestion(baseQuestion);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.category).toBeOneOf(['good', 'excellent']);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify issues with short question text', () => {
      const shortQuestion = {
        ...baseQuestion,
        question: 'What?',
      };

      const result = validateQuizQuestion(shortQuestion);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Question is too short and lacks context');
      expect(result.suggestions).toContain('Expand the question to provide more context');
    });

    it('should identify issues with long question text', () => {
      const longQuestion = {
        ...baseQuestion,
        question: 'What is machine learning and how does it differ from traditional programming approaches and what are the main types of machine learning algorithms and how do they work in practice and what are their applications?',
      };

      const result = validateQuizQuestion(longQuestion);

      expect(result.issues).toContain('Question is too long and may be confusing');
      expect(result.suggestions).toContain('Simplify the question to focus on one concept');
    });

    it('should validate true-false questions correctly', () => {
      const trueFalseQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'true-false',
        question: 'Machine learning is a subset of artificial intelligence.',
        options: undefined,
        correctAnswer: 'True',
      };

      const result = validateQuizQuestion(trueFalseQuestion);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should identify invalid true-false answers', () => {
      const invalidTrueFalse: QuizQuestion = {
        ...baseQuestion,
        type: 'true-false',
        question: 'Machine learning is a subset of artificial intelligence.',
        options: undefined,
        correctAnswer: 'Maybe', // Invalid answer
      };

      const result = validateQuizQuestion(invalidTrueFalse);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('True-false question must have "True" or "False" as correct answer');
    });

    it('should validate short-answer questions', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        question: 'What enables computers to learn without explicit programming?',
        options: undefined,
        correctAnswer: 'Machine learning algorithms',
      };

      const result = validateQuizQuestion(shortAnswerQuestion);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should identify missing short-answer responses', () => {
      const invalidShortAnswer: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        question: 'What enables computers to learn without explicit programming?',
        options: undefined,
        correctAnswer: '', // Empty answer
      };

      const result = validateQuizQuestion(invalidShortAnswer);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Short-answer question must have a meaningful correct answer');
    });

    it('should validate fill-blank questions', () => {
      const fillBlankQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'fill-blank',
        question: 'Machine learning is a subset of _____.',
        options: undefined,
        correctAnswer: 'artificial intelligence',
      };

      const result = validateQuizQuestion(fillBlankQuestion);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should identify missing blanks in fill-blank questions', () => {
      const invalidFillBlank: QuizQuestion = {
        ...baseQuestion,
        type: 'fill-blank',
        question: 'Machine learning is a subset of artificial intelligence.', // No blank
        options: undefined,
        correctAnswer: 'artificial intelligence',
      };

      const result = validateQuizQuestion(invalidFillBlank);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Fill-in-the-blank question must indicate where the blank is');
    });

    it('should validate multiple-choice options', () => {
      const questionWithBadOptions = {
        ...baseQuestion,
        options: ['AI subset', 'AI subset', 'Database', 'Hardware'], // Duplicate options
      };

      const result = validateQuizQuestion(questionWithBadOptions);

      expect(result.issues).toContain('Multiple-choice options contain duplicates');
    });

    it('should identify when correct answer is not in options', () => {
      const questionWithMissingAnswer = {
        ...baseQuestion,
        correctAnswer: 'Not in options',
      };

      const result = validateQuizQuestion(questionWithMissingAnswer);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Correct answer is not found in the provided options');
    });

    it('should validate explanation quality', () => {
      const questionWithBadExplanation = {
        ...baseQuestion,
        explanation: 'Yes.', // Too brief
      };

      const result = validateQuizQuestion(questionWithBadExplanation);

      expect(result.issues).toContain('Explanation is missing or too brief');
      expect(result.suggestions).toContain('Provide a detailed explanation of the correct answer');
    });

    it('should validate difficulty appropriateness', () => {
      const questionWithMismatchedDifficulty = {
        ...baseQuestion,
        difficulty: 'easy' as const,
        points: 5, // Too many points for easy question
      };

      const result = validateQuizQuestion(questionWithMismatchedDifficulty);

      expect(result.suggestions).toContain('Consider adjusting points to match easy difficulty');
    });

    it('should handle questions with ambiguous language', () => {
      const ambiguousQuestion = {
        ...baseQuestion,
        question: 'What are some of the many things that often happen in machine learning sometimes?',
      };

      const result = validateQuizQuestion(ambiguousQuestion);

      expect(result.issues).toContain('Question contains ambiguous language');
      expect(result.suggestions).toContain('Use more specific and precise language');
    });

    it('should detect double negatives', () => {
      const doubleNegativeQuestion = {
        ...baseQuestion,
        question: 'Which of the following is not never used in machine learning?',
      };

      const result = validateQuizQuestion(doubleNegativeQuestion);

      expect(result.issues).toContain('Question contains confusing double negatives');
      expect(result.suggestions).toContain('Rephrase to avoid double negatives');
    });
  });

  describe('validateQuizCollection', () => {
    const validQuestions: QuizQuestion[] = [
      baseQuestion,
      {
        ...baseQuestion,
        id: 'test-question-2',
        type: 'true-false',
        question: 'Neural networks are inspired by biological systems.',
        options: undefined,
        correctAnswer: 'True',
        difficulty: 'easy',
        points: 1,
      },
      {
        ...baseQuestion,
        id: 'test-question-3',
        type: 'short-answer',
        question: 'What type of learning uses labeled data?',
        options: undefined,
        correctAnswer: 'Supervised learning',
        difficulty: 'hard',
        points: 3,
      },
    ];

    it('should validate a collection of good questions', () => {
      const result = validateQuizCollection(validQuestions);

      expect(result.validQuestions).toHaveLength(3);
      expect(result.invalidQuestions).toHaveLength(0);
      expect(result.overallScore).toBeGreaterThan(0.7);
      expect(result.statistics.totalQuestions).toBe(3);
      expect(result.statistics.validQuestions).toBe(3);
    });

    it('should identify invalid questions in collection', () => {
      const mixedQuestions = [
        ...validQuestions,
        {
          ...baseQuestion,
          id: 'invalid-question',
          question: 'Bad?', // Too short
          correctAnswer: '', // Empty answer
        },
      ];

      const result = validateQuizCollection(mixedQuestions);

      expect(result.validQuestions).toHaveLength(3);
      expect(result.invalidQuestions).toHaveLength(1);
      expect(result.invalidQuestions[0].question.id).toBe('invalid-question');
      expect(result.invalidQuestions[0].issues.length).toBeGreaterThan(0);
    });

    it('should calculate statistics correctly', () => {
      const result = validateQuizCollection(validQuestions);

      expect(result.statistics.difficultyBalance).toEqual({
        easy: 1,
        medium: 1,
        hard: 1,
      });

      expect(result.statistics.typeBalance).toEqual({
        'multiple-choice': 1,
        'true-false': 1,
        'short-answer': 1,
      });
    });

    it('should provide recommendations for poor quality collections', () => {
      const poorQuestions = Array(5).fill(null).map((_, i) => ({
        ...baseQuestion,
        id: `poor-question-${i}`,
        question: 'Bad?', // Too short
        explanation: 'No.', // Too brief
      }));

      const result = validateQuizCollection(poorQuestions);

      expect(result.recommendations).toContain('High number of invalid questions - review generation parameters');
      expect(result.recommendations).toContain('Overall question quality is low - consider regenerating');
    });
  });

  describe('validateAnswer', () => {
    it('should validate correct multiple-choice answer', () => {
      const result = validateAnswer(baseQuestion, 'AI subset');

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(1);
      expect(result.feedback).toBe('Correct!');
      expect(result.explanation).toBe(baseQuestion.explanation);
    });

    it('should validate incorrect multiple-choice answer', () => {
      const result = validateAnswer(baseQuestion, 'Programming language');

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Incorrect. The correct answer is: AI subset');
    });

    it('should validate true-false answers with various formats', () => {
      const trueFalseQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'true-false',
        correctAnswer: 'True',
      };

      // Test various true formats
      expect(validateAnswer(trueFalseQuestion, 'True').isCorrect).toBe(true);
      expect(validateAnswer(trueFalseQuestion, 'true').isCorrect).toBe(true);
      expect(validateAnswer(trueFalseQuestion, 'T').isCorrect).toBe(true);
      expect(validateAnswer(trueFalseQuestion, '1').isCorrect).toBe(true);
      expect(validateAnswer(trueFalseQuestion, 'yes').isCorrect).toBe(true);

      // Test false formats
      expect(validateAnswer(trueFalseQuestion, 'False').isCorrect).toBe(false);
      expect(validateAnswer(trueFalseQuestion, 'false').isCorrect).toBe(false);
      expect(validateAnswer(trueFalseQuestion, 'F').isCorrect).toBe(false);
    });

    it('should validate short-answer with exact match', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: 'Machine learning',
      };

      const result = validateAnswer(shortAnswerQuestion, 'Machine learning');

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(1);
      expect(result.feedback).toBe('Correct!');
    });

    it('should validate short-answer with partial credit', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: 'Machine learning algorithms',
      };

      const result = validateAnswer(shortAnswerQuestion, 'Machine learning', {
        allowPartialCredit: true,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.feedback).toBe('Mostly correct!');
    });

    it('should handle case sensitivity option', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: 'Machine Learning',
      };

      // Case insensitive (default)
      const insensitiveResult = validateAnswer(shortAnswerQuestion, 'machine learning');
      expect(insensitiveResult.isCorrect).toBe(true);

      // Case sensitive
      const sensitiveResult = validateAnswer(shortAnswerQuestion, 'machine learning', {
        caseSensitive: true,
      });
      expect(sensitiveResult.isCorrect).toBe(false);
    });

    it('should handle strict matching option', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: 'Machine learning algorithms',
      };

      // Non-strict (default) - allows partial matches
      const nonStrictResult = validateAnswer(shortAnswerQuestion, 'Machine learning', {
        strictMatching: false,
        allowPartialCredit: true,
      });
      expect(nonStrictResult.score).toBeGreaterThan(0);

      // Strict - requires exact match
      const strictResult = validateAnswer(shortAnswerQuestion, 'Machine learning', {
        strictMatching: true,
      });
      expect(strictResult.isCorrect).toBe(false);
      expect(strictResult.score).toBe(0);
    });

    it('should provide hints for incorrect answers', () => {
      const questionWithHints: QuizQuestion = {
        ...baseQuestion,
        hints: ['Think about AI subfields', 'It involves learning from data'],
      };

      const result = validateAnswer(questionWithHints, 'Wrong answer');

      expect(result.isCorrect).toBe(false);
      expect(result.hints).toEqual(['Think about AI subfields', 'It involves learning from data']);
    });

    it('should validate fill-blank answers', () => {
      const fillBlankQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'fill-blank',
        question: 'Machine learning is a subset of _____.',
        correctAnswer: 'artificial intelligence',
      };

      const exactResult = validateAnswer(fillBlankQuestion, 'artificial intelligence');
      expect(exactResult.isCorrect).toBe(true);

      const partialResult = validateAnswer(fillBlankQuestion, 'AI', {
        allowPartialCredit: true,
      });
      expect(partialResult.score).toBeGreaterThan(0);
    });

    it('should handle multiple correct answers', () => {
      const multiAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: ['Machine learning', 'ML', 'machine learning algorithms'],
      };

      expect(validateAnswer(multiAnswerQuestion, 'Machine learning').isCorrect).toBe(true);
      expect(validateAnswer(multiAnswerQuestion, 'ML').isCorrect).toBe(true);
      expect(validateAnswer(multiAnswerQuestion, 'machine learning algorithms').isCorrect).toBe(true);
      expect(validateAnswer(multiAnswerQuestion, 'Deep learning').isCorrect).toBe(false);
    });
  });

  describe('String similarity calculation', () => {
    it('should calculate similarity correctly for similar strings', () => {
      const shortAnswerQuestion: QuizQuestion = {
        ...baseQuestion,
        type: 'short-answer',
        correctAnswer: 'artificial intelligence',
      };

      // Very similar
      const result1 = validateAnswer(shortAnswerQuestion, 'artificial intellgence', {
        allowPartialCredit: true,
      });
      expect(result1.score).toBeGreaterThan(0.8);

      // Somewhat similar
      const result2 = validateAnswer(shortAnswerQuestion, 'artificial', {
        allowPartialCredit: true,
      });
      expect(result2.score).toBeGreaterThan(0.3);
      expect(result2.score).toBeLessThan(0.7);

      // Not similar
      const result3 = validateAnswer(shortAnswerQuestion, 'completely different', {
        allowPartialCredit: true,
      });
      expect(result3.score).toBe(0);
    });
  });
});