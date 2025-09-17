import { generateFlashcards, FlashcardOptions, VideoMetadata } from '../flashcard-generation';
import { bedrockClient } from '../bedrock-client';

// Mock dependencies
jest.mock('../bedrock-client');
jest.mock('../../shared/logger');

const mockBedrockClient = bedrockClient as jest.Mocked<typeof bedrockClient>;

describe('Flashcard Generation Service', () => {
  const mockVideoMetadata: VideoMetadata = {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning concepts',
    duration: 3600,
    channelTitle: 'Tech Education',
    tags: ['machine learning', 'AI', 'data science'],
  };

  const mockContent = {
    transcript: 'Machine learning is a subset of artificial intelligence that focuses on building systems that can learn from data.',
    summary: 'This video introduces machine learning concepts and applications.',
    keyTopics: ['Machine Learning', 'Artificial Intelligence', 'Data Science'],
  };

  const mockFlashcardOptions: FlashcardOptions = {
    language: 'en',
    difficulty: 'intermediate',
    cardTypes: ['definition', 'concept'],
    maxCards: 10,
    includeExamples: true,
    focusAreas: ['key concepts'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFlashcards', () => {
    it('should generate flashcards using Bedrock', async () => {
      const mockFlashcards = [
        {
          id: 'flashcard-1',
          front: 'What is machine learning?',
          back: 'A subset of AI that enables systems to learn from data',
          type: 'definition',
          difficulty: 'intermediate',
          tags: ['ML', 'AI'],
        },
      ];

      mockBedrockClient.generateStructuredResponse.mockResolvedValue({
        flashcards: mockFlashcards,
      });

      const result = await generateFlashcards(mockContent, mockVideoMetadata, mockFlashcardOptions);

      expect(mockBedrockClient.generateStructuredResponse).toHaveBeenCalledWith(
        expect.stringContaining('educational flashcard creator'),
        expect.any(String),
        expect.objectContaining({
          temperature: 0.4,
          maxTokens: 4000,
        })
      );

      expect(result).toBeDefined();
    });

    it('should handle Bedrock errors gracefully', async () => {
      mockBedrockClient.generateStructuredResponse.mockRejectedValue(new Error('Bedrock service unavailable'));

      const result = await generateFlashcards(mockContent, mockVideoMetadata, mockFlashcardOptions);

      expect(result).toBeDefined();
      // Should fall back to basic flashcard generation
    });
  });
});

describe('Flashcard Generation Service', () => {
  const mockVideoMetadata: VideoMetadata = {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning concepts and applications',
    duration: 3600,
    channelTitle: 'Tech Education',
    tags: ['machine learning', 'AI', 'data science', 'algorithms'],
  };

  const mockTranscript = `
Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. This field has revolutionized many industries and continues to grow rapidly.

There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Supervised learning uses labeled data to train models, making it ideal for classification and regression problems.

Unsupervised learning finds patterns in data without labeled examples. This approach is useful for clustering, dimensionality reduction, and anomaly detection.

Reinforcement learning involves agents learning through interaction with an environment, receiving rewards or penalties for their actions.

Data preprocessing is crucial for successful machine learning projects. This includes cleaning data, handling missing values, feature selection, and normalization.
  `.trim();

  const mockSummary = 'Machine learning is a subset of AI with three main types: supervised, unsupervised, and reinforcement learning. Data preprocessing is crucial for success.';

  const mockKeyPoints = [
    'Machine learning is a subset of artificial intelligence',
    'Three main types: supervised, unsupervised, and reinforcement learning',
    'Supervised learning uses labeled data for classification and regression',
    'Unsupervised learning finds patterns without labeled examples',
    'Reinforcement learning involves agents learning through environmental interaction',
    'Data preprocessing is crucial for successful ML projects',
  ];

  const mockTopics = [
    'Machine Learning Fundamentals',
    'Supervised Learning',
    'Unsupervised Learning',
    'Reinforcement Learning',
    'Data Preprocessing',
  ];

  const mockComprehendAnalysis = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95 },
      { Text: 'supervised learning', Score: 0.90 },
      { Text: 'unsupervised learning', Score: 0.88 },
      { Text: 'reinforcement learning', Score: 0.85 },
      { Text: 'data preprocessing', Score: 0.82 },
      { Text: 'artificial intelligence', Score: 0.80 },
    ],
    entities: [
      { Text: 'Machine Learning', Type: 'OTHER', Score: 0.95 },
      { Text: 'AI', Type: 'OTHER', Score: 0.90 },
    ],
    sentiment: {
      Sentiment: 'NEUTRAL',
      SentimentScore: {
        Positive: 0.1,
        Negative: 0.05,
        Neutral: 0.8,
        Mixed: 0.05,
      },
    },
  };

  const mockOpenAIResponse = {
    flashcards: [
      {
        front: 'What is machine learning?',
        back: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.',
        type: 'definition',
        difficulty: 'beginner',
        category: 'Machine Learning Fundamentals',
        tags: ['machine learning', 'AI', 'definition'],
        hints: ['Think about computers learning from data'],
        explanation: 'Machine learning allows computers to improve their performance on tasks through experience.',
        relatedConcepts: ['artificial intelligence', 'data science'],
        examples: ['Email spam detection', 'Image recognition'],
        mnemonics: 'ML = Machines Learning from data',
        importance: 9,
        complexity: 5,
        memorability: 8,
      },
      {
        front: 'Name the three main types of machine learning',
        back: 'The three main types are: supervised learning, unsupervised learning, and reinforcement learning.',
        type: 'concept',
        difficulty: 'intermediate',
        category: 'Machine Learning Types',
        tags: ['types', 'classification'],
        hints: ['Think about different ways machines can learn'],
        explanation: 'Each type uses different approaches to learn from data.',
        relatedConcepts: ['machine learning'],
        examples: ['Classification (supervised)', 'Clustering (unsupervised)', 'Game playing (reinforcement)'],
        importance: 8,
        complexity: 6,
        memorability: 7,
      },
      {
        front: 'How does supervised learning work?',
        back: 'Supervised learning uses labeled data to train models, making it ideal for classification and regression problems.',
        type: 'concept',
        difficulty: 'intermediate',
        category: 'Supervised Learning',
        tags: ['supervised learning', 'labeled data'],
        hints: ['Think about learning with examples and answers'],
        explanation: 'The algorithm learns from input-output pairs to make predictions on new data.',
        relatedConcepts: ['classification', 'regression'],
        examples: ['Email classification', 'House price prediction'],
        importance: 8,
        complexity: 7,
        memorability: 6,
      },
    ],
  };

  const mockQualityResult = {
    overallScore: 8.5,
    clarityScore: 8.0,
    accuracyScore: 9.0,
    difficultyScore: 8.5,
    engagementScore: 8.0,
    issues: [],
    suggestions: ['Consider adding more examples'],
  };

  const mockSpacedRepetitionData = {
    interval: 1,
    repetition: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    performanceHistory: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAnalyzeTextWithComprehend.mockResolvedValue(mockComprehendAnalysis);
    mockValidateFlashcardQuality.mockResolvedValue(mockQualityResult);
    mockCalculateSpacedRepetitionSchedule.mockReturnValue(mockSpacedRepetitionData);
    
    const mockCompletion = {
      choices: [
        {
          message: {
            content: JSON.stringify(mockOpenAIResponse),
          },
        },
      ],
    };
    
    mockOpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue(mockCompletion),
      },
    } as any;
  });

  describe('generateFlashcards', () => {
    it('should generate flashcards with default options', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.cards).toHaveLength(3);
      expect(result.metadata.totalCards).toBe(3);
      expect(result.metadata.averageQuality).toBeGreaterThan(0);
      expect(result.organization.studySequence).toHaveLength(3);
    });

    it('should generate flashcards with custom options', async () => {
      const options: FlashcardOptions = {
        language: 'en',
        difficulty: 'intermediate',
        cardTypes: ['definition', 'concept'],
        maxCards: 5,
        includeImages: true,
        focusAreas: ['supervised learning'],
        learningObjectives: ['Understand ML basics'],
        avoidDuplicates: true,
      };

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        options
      );

      expect(result).toBeDefined();
      expect(result.cards.length).toBeLessThanOrEqual(5);
      expect(mockOpenAI.prototype.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          temperature: 0.4,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should analyze content with Comprehend', async () => {
      await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(mockAnalyzeTextWithComprehend).toHaveBeenCalledWith(mockTranscript, 'en');
    });

    it('should validate flashcard quality', async () => {
      await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(mockValidateFlashcardQuality).toHaveBeenCalledTimes(3);
    });

    it('should calculate spaced repetition schedules', async () => {
      await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(mockCalculateSpacedRepetitionSchedule).toHaveBeenCalledTimes(3);
    });

    it('should organize flashcards by difficulty, type, and category', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.organization.byDifficulty).toBeDefined();
      expect(result.organization.byType).toBeDefined();
      expect(result.organization.byCategory).toBeDefined();
      expect(result.organization.studySequence).toBeDefined();
    });

    it('should calculate metadata correctly', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.metadata).toEqual(
        expect.objectContaining({
          totalCards: expect.any(Number),
          difficultyDistribution: expect.any(Object),
          typeDistribution: expect.any(Object),
          categoryDistribution: expect.any(Object),
          averageQuality: expect.any(Number),
          estimatedStudyTime: expect.any(Number),
          learningObjectives: expect.any(Array),
          prerequisites: expect.any(Array),
        })
      );
    });

    it('should calculate analytics', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.analytics).toEqual(
        expect.objectContaining({
          conceptCoverage: expect.any(Number),
          redundancyScore: expect.any(Number),
          coherenceScore: expect.any(Number),
          completenessScore: expect.any(Number),
        })
      );
    });

    it('should handle different difficulty levels', async () => {
      const beginnerOptions: FlashcardOptions = { difficulty: 'beginner' };
      const advancedOptions: FlashcardOptions = { difficulty: 'advanced' };

      const beginnerResult = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        beginnerOptions
      );

      const advancedResult = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        advancedOptions
      );

      expect(beginnerResult.cards).toBeDefined();
      expect(advancedResult.cards).toBeDefined();
    });

    it('should handle different card types', async () => {
      const definitionOptions: FlashcardOptions = { cardTypes: ['definition'] };
      const conceptOptions: FlashcardOptions = { cardTypes: ['concept', 'application'] };

      const definitionResult = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        definitionOptions
      );

      const conceptResult = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        conceptOptions
      );

      expect(definitionResult.cards).toBeDefined();
      expect(conceptResult.cards).toBeDefined();
    });

    it('should remove duplicates when requested', async () => {
      // Mock OpenAI to return duplicate cards
      const duplicateResponse = {
        flashcards: [
          mockOpenAIResponse.flashcards[0],
          { ...mockOpenAIResponse.flashcards[0], front: 'What is machine learning exactly?' }, // Similar card
          mockOpenAIResponse.flashcards[1],
        ],
      };

      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(duplicateResponse) } }],
          }),
        },
      } as any;

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { avoidDuplicates: true }
      );

      expect(result.cards.length).toBeLessThan(3); // Some duplicates should be removed
    });

    it('should include image prompts when requested', async () => {
      const options: FlashcardOptions = { includeImages: true };

      await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        options
      );

      const callArgs = (mockOpenAI.prototype.chat.completions.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('Include image prompts');
    });

    it('should filter out low-quality flashcards', async () => {
      // Mock one card with low quality
      mockValidateFlashcardQuality
        .mockResolvedValueOnce({ ...mockQualityResult, overallScore: 8.5 })
        .mockResolvedValueOnce({ ...mockQualityResult, overallScore: 4.0 }) // Low quality
        .mockResolvedValueOnce({ ...mockQualityResult, overallScore: 7.5 });

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.cards.length).toBe(2); // One card should be filtered out
    });
  });

  describe('error handling', () => {
    it('should throw error when no content is provided', async () => {
      await expect(
        generateFlashcards('', '', [], [], mockVideoMetadata)
      ).rejects.toThrow('Either transcript or summary is required for flashcard generation');
    });

    it('should throw error when content is too short', async () => {
      await expect(
        generateFlashcards('Short', '', [], [], mockVideoMetadata)
      ).rejects.toThrow('Content is too short for meaningful flashcard generation');
    });

    it('should handle OpenAI API failure gracefully', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      } as any;

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.cards.length).toBeGreaterThan(0);
    });

    it('should handle invalid OpenAI response', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: 'invalid json',
            },
          },
        ],
      };
      
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockCompletion),
        },
      } as any;

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.cards.length).toBeGreaterThan(0);
    });

    it('should handle Comprehend analysis failure', async () => {
      mockAnalyzeTextWithComprehend.mockRejectedValue(new Error('Comprehend error'));

      await expect(
        generateFlashcards(mockTranscript, mockSummary, mockKeyPoints, mockTopics, mockVideoMetadata)
      ).rejects.toThrow();
    });

    it('should handle quality validation failure gracefully', async () => {
      mockValidateFlashcardQuality.mockRejectedValue(new Error('Quality validation error'));

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.cards.length).toBeGreaterThan(0);
      // Cards should have default quality scores
      result.cards.forEach(card => {
        expect(card.quality.overallScore).toBe(5.0);
      });
    });
  });

  describe('updateFlashcardPerformance', () => {
    it('should update flashcard performance and spaced repetition', async () => {
      const mockFlashcard = {
        id: 'card-1',
        front: 'What is ML?',
        back: 'Machine Learning',
        type: 'definition' as const,
        difficulty: 'beginner' as const,
        category: 'ML Basics',
        tags: ['ml'],
        metadata: {
          confidence: 0.8,
          importance: 7,
          complexity: 5,
          memorability: 6,
        },
        spacedRepetition: mockSpacedRepetitionData,
        quality: mockQualityResult,
      };

      const performance = {
        correct: true,
        responseTime: 5.2,
        difficulty: 2,
        confidence: 4,
      };

      const updatedSpacedRepetition = {
        ...mockSpacedRepetitionData,
        interval: 2,
        repetition: 1,
        performanceHistory: [
          {
            date: expect.any(String),
            correct: true,
            responseTime: 5.2,
            difficulty: 2,
            confidence: 4,
          },
        ],
      };

      mockCalculateSpacedRepetitionSchedule.mockReturnValue(updatedSpacedRepetition);

      const result = await updateFlashcardPerformance(mockFlashcard, performance);

      expect(result.spacedRepetition).toEqual(updatedSpacedRepetition);
      expect(mockCalculateSpacedRepetitionSchedule).toHaveBeenCalledWith({
        difficulty: 'beginner',
        previousPerformance: expect.arrayContaining([
          expect.objectContaining({
            correct: true,
            responseTime: 5.2,
            difficulty: 2,
            confidence: 4,
          }),
        ]),
      });
    });
  });

  describe('fallback generation', () => {
    it('should generate fallback flashcards when OpenAI fails', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API error')),
        },
      } as any;

      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.cards.length).toBeGreaterThan(0);
      expect(result.cards.some(card => card.tags.includes('key-point'))).toBe(true);
      expect(result.cards.some(card => card.tags.includes('topic'))).toBe(true);
    });
  });

  describe('study sequence optimization', () => {
    it('should create optimal study sequence', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.organization.studySequence).toBeDefined();
      expect(result.organization.studySequence.length).toBe(result.cards.length);
      
      // Should start with beginner cards
      const firstCardId = result.organization.studySequence[0];
      const firstCard = result.cards.find(card => card.id === firstCardId);
      expect(firstCard?.difficulty).toBe('beginner');
    });
  });

  describe('content analysis integration', () => {
    it('should enhance cards with insights from content analysis', async () => {
      const result = await generateFlashcards(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      // Cards should have tags enhanced with key phrases
      const allTags = result.cards.flatMap(card => card.tags);
      expect(allTags).toContain('machine learning');
    });
  });
});