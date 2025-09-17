import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../generate-flashcards';
import { generateFlashcards } from '../../../services/flashcard-generation';

// Mock AWS clients
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Mock flashcard generation service
jest.mock('../../../services/flashcard-generation');
const mockGenerateFlashcards = generateFlashcards as jest.MockedFunction<typeof generateFlashcards>;

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.OPENAI_API_KEY = 'test-api-key';

describe('Generate Flashcards Lambda Function', () => {
  beforeEach(() => {
    dynamoMock.reset();
    jest.clearAllMocks();
  });

  const mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Machine Learning Basics',
    options: {
      language: 'en',
      cardCount: 10,
      difficulty: 'mixed' as const,
      categories: ['Definitions', 'Concepts'],
      includeDefinitions: true,
      includeExamples: true,
      includeConceptual: true,
    },
    transcriptResult: {
      Payload: {
        transcript: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. Neural networks are computing systems inspired by biological neural networks.',
        segments: [
          { text: 'Machine learning is a subset of artificial intelligence', start: 0, duration: 5 },
          { text: 'Neural networks are computing systems', start: 10, duration: 4 },
        ],
        language: 'en',
      },
    },
    summaryResult: {
      Payload: {
        summary: 'This video covers machine learning fundamentals and neural network concepts.',
        keyPoints: [
          'Machine learning enables computers to learn from data',
          'Neural networks are inspired by biological systems',
          'AI systems can make decisions without explicit programming',
        ],
        topics: ['Machine Learning', 'Neural Networks', 'Artificial Intelligence'],
      },
    },
    validationResult: {
      Payload: {
        metadata: {
          title: 'Machine Learning Basics',
          description: 'Introduction to ML concepts',
          duration: 600,
          channelTitle: 'Tech Education',
          tags: ['machine learning', 'AI'],
        },
      },
    },
  };

  const mockComprehendResponse = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'artificial intelligence', Score: 0.92, BeginOffset: 30, EndOffset: 53 },
      { Text: 'neural networks', Score: 0.88, BeginOffset: 100, EndOffset: 115 },
    ],
    entities: [
      { Text: 'machine learning', Type: 'OTHER', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'neural networks', Type: 'OTHER', Score: 0.88, BeginOffset: 100, EndOffset: 115 },
    ],
    sentiment: {
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.4, Negative: 0.1, Neutral: 0.5, Mixed: 0.0 },
    },
  };

  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            flashcards: [
              {
                front: 'What is machine learning?',
                back: 'Machine learning is a subset of AI that enables computers to learn from data without explicit programming.',
                category: 'Definitions',
                difficulty: 'medium',
                type: 'definition',
                tags: ['AI', 'ML', 'fundamentals'],
                confidence: 0.95,
              },
              {
                front: 'How do neural networks work?',
                back: 'Neural networks are computing systems inspired by biological neural networks that process information through interconnected nodes.',
                category: 'Concepts',
                difficulty: 'hard',
                type: 'concept',
                tags: ['neural networks', 'AI', 'biology'],
                confidence: 0.88,
              },
              {
                front: 'What is the main advantage of ML?',
                back: 'Machine learning allows systems to automatically improve performance through experience without being explicitly programmed for each task.',
                category: 'Concepts',
                difficulty: 'medium',
                type: 'concept',
                tags: ['advantages', 'automation'],
                confidence: 0.90,
              },
            ],
          }),
        },
      },
    ],
  };

  it('should successfully generate flashcards with OpenAI and Comprehend', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: mockComprehendResponse.keyPhrases });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: mockComprehendResponse.entities });
    comprehendMock.on(DetectSentimentCommand).resolves(mockComprehendResponse.sentiment);

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.flashcards.flashcards).toHaveLength(3);
    expect(result.body.flashcards.totalCount).toBe(3);
    expect(result.body.flashcards.categories).toContain('Definitions');
    expect(result.body.flashcards.categories).toContain('Concepts');
    expect(result.body.flashcards.averageQuality).toBeGreaterThan(0.5);

    // Verify flashcard structure
    const firstCard = result.body.flashcards.flashcards[0];
    expect(firstCard.id).toBeDefined();
    expect(firstCard.front).toBe('What is machine learning?');
    expect(firstCard.back).toContain('Machine learning');
    expect(firstCard.spacedRepetition).toBeDefined();
    expect(firstCard.spacedRepetition.interval).toBeGreaterThan(0);
    expect(firstCard.spacedRepetition.nextReview).toBeDefined();

    // Verify DynamoDB update was called
    expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
    const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(updateCall.args[0].input.Key.PK).toBe('USER#user-123');
    expect(updateCall.args[0].input.Key.SK).toBe('CAPSULE#capsule-123');
  });

  it('should handle missing content by fetching from database', async () => {
    const eventWithoutContent = {
      ...mockEvent,
      transcriptResult: undefined,
      summaryResult: undefined,
    };

    // Mock DynamoDB get to return capsule with content
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {
          transcript: {
            text: 'Database transcript about machine learning concepts',
          },
          summary: {
            summary: 'Database summary of ML concepts',
            keyPoints: ['Key point from database'],
            topics: ['Database Topic'],
          },
        },
      },
    });

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(eventWithoutContent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);

    // Verify DynamoDB get was called
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('should throw error when no content is available', async () => {
    const eventWithoutContent = {
      ...mockEvent,
      transcriptResult: undefined,
      summaryResult: undefined,
    };

    // Mock DynamoDB get to return capsule without content
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {},
      },
    });

    await expect(handler(eventWithoutContent)).rejects.toThrow('No content available for flashcard generation');
  });

  it('should handle OpenAI API failure with fallback flashcards', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: mockComprehendResponse.keyPhrases });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: mockComprehendResponse.entities });
    comprehendMock.on(DetectSentimentCommand).resolves(mockComprehendResponse.sentiment);

    // Mock OpenAI to throw error
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.flashcards.flashcards.length).toBeGreaterThan(0);
    expect(result.body.flashcards.averageQuality).toBe(0.55); // Fallback quality score
  });

  it('should respect card count option', async () => {
    const eventWithCardCount = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        cardCount: 5,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with 5 cards
    const fiveCardResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: Array(5).fill(null).map((_, i) => ({
                front: `Question ${i + 1}?`,
                back: `Answer ${i + 1}`,
                category: 'Test',
                difficulty: 'medium',
                type: 'concept',
                tags: ['test'],
                confidence: 0.8,
              })),
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(fiveCardResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(eventWithCardCount);

    expect(result.statusCode).toBe(200);
    expect(result.body.flashcards.flashcards).toHaveLength(5);
    expect(result.body.flashcards.totalCount).toBe(5);

    // Verify OpenAI was called with correct card count
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('create 5 flashcards');
  });

  it('should handle different difficulty settings', async () => {
    const hardDifficultyEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        difficulty: 'hard' as const,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(hardDifficultyEvent);

    expect(result.statusCode).toBe(200);

    // Verify OpenAI was called with hard difficulty
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Target difficulty: hard');
  });

  it('should handle invalid OpenAI JSON response', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI to return invalid JSON
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Invalid JSON response' } }],
    } as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    // Should fallback to basic flashcards
    expect(result.body.flashcards.averageQuality).toBe(0.55);
  });

  it('should filter out invalid flashcards from OpenAI response', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with some invalid cards
    const responseWithInvalidCards = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: [
                {
                  front: 'Valid question?',
                  back: 'Valid answer',
                  category: 'Test',
                  difficulty: 'medium',
                  type: 'concept',
                  tags: ['test'],
                  confidence: 0.8,
                },
                {
                  // Missing front
                  back: 'Answer without question',
                  category: 'Test',
                },
                {
                  front: 'Another valid question?',
                  back: 'Another valid answer',
                  category: 'Test',
                  difficulty: 'easy',
                  type: 'definition',
                  tags: ['test'],
                  confidence: 0.9,
                },
                {
                  front: 'Question without back',
                  // Missing back
                  category: 'Test',
                },
              ],
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(responseWithInvalidCards as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.flashcards.flashcards).toHaveLength(2); // Only valid cards
    expect(result.body.flashcards.totalCount).toBe(2);
  });

  it('should calculate spaced repetition schedule correctly', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.flashcards.spacedRepetitionSchedule).toBeDefined();
    expect(result.body.flashcards.spacedRepetitionSchedule.today).toBeGreaterThanOrEqual(0);
    expect(result.body.flashcards.spacedRepetitionSchedule.thisWeek).toBeGreaterThanOrEqual(0);
    expect(result.body.flashcards.spacedRepetitionSchedule.thisMonth).toBeGreaterThanOrEqual(0);

    // Verify each flashcard has spaced repetition data
    result.body.flashcards.flashcards.forEach((card: any) => {
      expect(card.spacedRepetition).toBeDefined();
      expect(card.spacedRepetition.interval).toBeGreaterThan(0);
      expect(card.spacedRepetition.repetition).toBe(0); // New cards
      expect(card.spacedRepetition.easeFactor).toBe(2.5); // Default ease factor
      expect(card.spacedRepetition.nextReview).toBeDefined();
    });
  });

  it('should respect language option', async () => {
    const spanishEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        language: 'es',
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(spanishEvent);

    expect(result.statusCode).toBe(200);

    // Verify Comprehend was called with Spanish language code
    const comprehendCalls = comprehendMock.commandCalls(DetectKeyPhrasesCommand);
    expect(comprehendCalls[0].args[0].input.LanguageCode).toBe('es');

    // Verify OpenAI prompt included Spanish language instruction
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Write in es');
  });

  it('should handle content type options correctly', async () => {
    const limitedOptionsEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        includeDefinitions: true,
        includeExamples: false,
        includeConceptual: false,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(limitedOptionsEvent);

    expect(result.statusCode).toBe(200);

    // Verify OpenAI prompt only included definitions
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Definitions');
    expect(openAICall.messages[1].content).not.toContain('Examples');
    expect(openAICall.messages[1].content).not.toContain('Conceptual understanding');
  });
}); 
 const mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Machine Learning Basics',
    options: {
      language: 'en',
      maxCards: 10,
      difficulty: 'mixed' as const,
      cardTypes: ['definition', 'concept'],
      includeImages: false,
      focusAreas: ['machine learning'],
      avoidDuplicates: true,
    },
    transcriptResult: {
      Payload: {
        transcript: 'This is a test transcript about machine learning and artificial intelligence.',
        language: 'en',
      },
    },
    summaryResult: {
      Payload: {
        summary: 'Machine learning is a subset of AI that learns from data.',
        keyPoints: [
          'Machine learning is a subset of AI',
          'It learns from data without explicit programming',
          'There are three main types of ML',
        ],
        topics: ['Machine Learning', 'Artificial Intelligence', 'Data Science'],
      },
    },
    validationResult: {
      Payload: {
        metadata: {
          title: 'Introduction to Machine Learning',
          description: 'A comprehensive guide to ML concepts',
          duration: 3600,
          channelTitle: 'Tech Education',
          tags: ['machine learning', 'AI'],
        },
      },
    },
  };

  const mockFlashcardSet = {
    cards: [
      {
        id: 'card-1',
        front: 'What is machine learning?',
        back: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
        type: 'definition',
        difficulty: 'beginner',
        category: 'Machine Learning Fundamentals',
        tags: ['machine learning', 'AI', 'definition'],
        hints: ['Think about computers learning from data'],
        explanation: 'ML allows computers to improve performance through experience.',
        relatedConcepts: ['artificial intelligence'],
        examples: ['Email spam detection'],
        mnemonics: 'ML = Machines Learning',
        metadata: {
          confidence: 0.9,
          importance: 9,
          complexity: 5,
          memorability: 8,
        },
        spacedRepetition: {
          interval: 1,
          repetition: 0,
          easeFactor: 2.5,
          nextReviewDate: '2024-01-02T00:00:00Z',
          performanceHistory: [],
        },
        quality: {
          overallScore: 8.5,
          clarityScore: 8.0,
          accuracyScore: 9.0,
          difficultyScore: 8.5,
          engagementScore: 8.0,
          issues: [],
          suggestions: [],
        },
      },
      {
        id: 'card-2',
        front: 'Name three types of machine learning',
        back: 'Supervised learning, unsupervised learning, and reinforcement learning.',
        type: 'concept',
        difficulty: 'intermediate',
        category: 'ML Types',
        tags: ['types', 'classification'],
        hints: ['Think about different learning approaches'],
        explanation: 'Each type uses different methods to learn from data.',
        relatedConcepts: ['machine learning'],
        examples: ['Classification', 'Clustering', 'Game playing'],
        metadata: {
          confidence: 0.8,
          importance: 8,
          complexity: 6,
          memorability: 7,
        },
        spacedRepetition: {
          interval: 1,
          repetition: 0,
          easeFactor: 2.5,
          nextReviewDate: '2024-01-02T00:00:00Z',
          performanceHistory: [],
        },
        quality: {
          overallScore: 8.0,
          clarityScore: 8.5,
          accuracyScore: 8.0,
          difficultyScore: 8.0,
          engagementScore: 7.5,
          issues: [],
          suggestions: [],
        },
      },
    ],
    metadata: {
      totalCards: 2,
      difficultyDistribution: { beginner: 1, intermediate: 1 },
      typeDistribution: { definition: 1, concept: 1 },
      categoryDistribution: { 'Machine Learning Fundamentals': 1, 'ML Types': 1 },
      averageQuality: 8.25,
      estimatedStudyTime: 5,
      learningObjectives: ['Understand ML basics', 'Learn ML types'],
      prerequisites: ['Basic computer science knowledge'],
    },
    organization: {
      byDifficulty: {
        beginner: [expect.any(Object)],
        intermediate: [expect.any(Object)],
      },
      byType: {
        definition: [expect.any(Object)],
        concept: [expect.any(Object)],
      },
      byCategory: {
        'Machine Learning Fundamentals': [expect.any(Object)],
        'ML Types': [expect.any(Object)],
      },
      studySequence: ['card-1', 'card-2'],
    },
    analytics: {
      conceptCoverage: 80,
      redundancyScore: 10,
      coherenceScore: 75,
      completenessScore: 85,
    },
  };

  describe('successful flashcard generation', () => {
    beforeEach(() => {
      mockGenerateFlashcards.mockResolvedValue(mockFlashcardSet);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should generate flashcards successfully with transcript and summary', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.flashcards).toEqual(mockFlashcardSet);
      expect(result.body.videoId).toBe(mockEvent.videoId);
      expect(result.body.capsuleId).toBe(mockEvent.capsuleId);
    });

    it('should call generateFlashcards with correct parameters', async () => {
      await handler(mockEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        mockEvent.transcriptResult.Payload.transcript,
        mockEvent.summaryResult.Payload.summary,
        mockEvent.summaryResult.Payload.keyPoints,
        mockEvent.summaryResult.Payload.topics,
        {
          title: mockEvent.validationResult.Payload.metadata.title,
          description: mockEvent.validationResult.Payload.metadata.description,
          duration: mockEvent.validationResult.Payload.metadata.duration,
          channelTitle: mockEvent.validationResult.Payload.metadata.channelTitle,
          tags: mockEvent.validationResult.Payload.metadata.tags,
        },
        mockEvent.options
      );
    });

    it('should store flashcards in database', async () => {
      await handler(mockEvent);

      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
      const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
      expect(updateCall.args[0].input).toEqual({
        TableName: 'test-table',
        Key: {
          PK: 'USER#user-123',
          SK: 'CAPSULE#capsule-123',
        },
        UpdateExpression: expect.stringContaining('learningContent.flashcards'),
        ExpressionAttributeNames: {
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':flashcards': expect.objectContaining({
            ...mockFlashcardSet,
            generatedAt: expect.any(String),
            videoTitle: mockEvent.validationResult.Payload.metadata.title,
            videoId: mockEvent.videoId,
          }),
          ':updatedAt': expect.any(String),
        },
      });
    });

    it('should handle missing transcript by fetching from database', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          learningContent: {
            transcript: {
              text: 'Database transcript content',
            },
            summary: {
              summary: 'Database summary',
              keyPoints: ['Point 1', 'Point 2'],
              topics: ['Topic 1'],
            },
          },
        },
      });

      await handler(eventWithoutTranscript);

      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        'Database transcript content',
        'Database summary',
        ['Point 1', 'Point 2'],
        ['Topic 1'],
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use event title when metadata title is missing', async () => {
      const eventWithoutMetadataTitle = {
        ...mockEvent,
        validationResult: {
          Payload: {
            metadata: {
              ...mockEvent.validationResult.Payload.metadata,
              title: '',
            },
          },
        },
      };

      await handler(eventWithoutMetadataTitle);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          title: mockEvent.title,
        }),
        expect.any(Object)
      );
    });

    it('should handle missing validation result', async () => {
      const eventWithoutValidation = {
        ...mockEvent,
        validationResult: undefined,
      };

      await handler(eventWithoutValidation);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          title: mockEvent.title,
          description: '',
          duration: 0,
          channelTitle: '',
          tags: [],
        }),
        expect.any(Object)
      );
    });

    it('should handle missing summary result', async () => {
      const eventWithoutSummary = {
        ...mockEvent,
        summaryResult: undefined,
      };

      await handler(eventWithoutSummary);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        '',
        [],
        [],
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when no content is available', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({ Item: {} });

      await expect(handler(eventWithoutContent)).rejects.toThrow(
        'No content available for flashcard generation'
      );
    });

    it('should handle flashcard generation service errors', async () => {
      mockGenerateFlashcards.mockRejectedValue(new Error('Flashcard generation failed'));

      await expect(handler(mockEvent)).rejects.toThrow('Flashcard generation failed');
    });

    it('should handle database update errors', async () => {
      mockGenerateFlashcards.mockResolvedValue(mockFlashcardSet);
      dynamoMock.on(UpdateCommand).rejects(new Error('Database error'));

      await expect(handler(mockEvent)).rejects.toThrow('Database error');
    });

    it('should handle database get errors when fetching content', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).rejects(new Error('Database get error'));

      await expect(handler(eventWithoutContent)).rejects.toThrow('Database get error');
    });
  });

  describe('different flashcard options', () => {
    beforeEach(() => {
      mockGenerateFlashcards.mockResolvedValue(mockFlashcardSet);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should handle different difficulty levels', async () => {
      const beginnerEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          difficulty: 'beginner' as const,
        },
      };

      await handler(beginnerEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          difficulty: 'beginner',
        })
      );
    });

    it('should handle different card types', async () => {
      const definitionEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          cardTypes: ['definition', 'example'],
        },
      };

      await handler(definitionEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          cardTypes: ['definition', 'example'],
        })
      );
    });

    it('should handle custom max cards', async () => {
      const customEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          maxCards: 15,
        },
      };

      await handler(customEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          maxCards: 15,
        })
      );
    });

    it('should handle focus areas', async () => {
      const focusEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          focusAreas: ['supervised learning', 'neural networks'],
        },
      };

      await handler(focusEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          focusAreas: ['supervised learning', 'neural networks'],
        })
      );
    });

    it('should handle learning objectives', async () => {
      const objectivesEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          learningObjectives: ['Understand ML basics', 'Apply ML concepts'],
        },
      };

      await handler(objectivesEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          learningObjectives: ['Understand ML basics', 'Apply ML concepts'],
        })
      );
    });

    it('should handle image inclusion option', async () => {
      const imageEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          includeImages: true,
        },
      };

      await handler(imageEvent);

      expect(mockGenerateFlashcards).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          includeImages: true,
        })
      );
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      mockGenerateFlashcards.mockResolvedValue(mockFlashcardSet);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should return properly formatted success response', async () => {
      const result = await handler(mockEvent);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');
      expect(result.body).toHaveProperty('success', true);
      expect(result.body).toHaveProperty('flashcards');
      expect(result.body).toHaveProperty('videoId');
      expect(result.body).toHaveProperty('capsuleId');
      expect(result.body.flashcards).toEqual(mockFlashcardSet);
    });

    it('should include all flashcard set properties', async () => {
      const result = await handler(mockEvent);

      expect(result.body.flashcards).toHaveProperty('cards');
      expect(result.body.flashcards).toHaveProperty('metadata');
      expect(result.body.flashcards).toHaveProperty('organization');
      expect(result.body.flashcards).toHaveProperty('analytics');
      expect(result.body.flashcards.cards).toHaveLength(2);
    });
  });

  describe('database operations', () => {
    beforeEach(() => {
      mockGenerateFlashcards.mockResolvedValue(mockFlashcardSet);
    });

    it('should fetch content from database when not provided', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          learningContent: {
            transcript: {
              text: 'Fetched transcript',
            },
            summary: {
              summary: 'Fetched summary',
              keyPoints: ['Fetched point'],
              topics: ['Fetched topic'],
            },
          },
        },
      });
      dynamoMock.on(UpdateCommand).resolves({});

      await handler(eventWithoutContent);

      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      const getCall = dynamoMock.commandCalls(GetCommand)[0];
      expect(getCall.args[0].input).toEqual({
        TableName: 'test-table',
        Key: {
          PK: 'USER#user-123',
          SK: 'CAPSULE#capsule-123',
        },
      });
    });

    it('should handle empty database response for content', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({});

      await expect(handler(eventWithoutContent)).rejects.toThrow(
        'No content available for flashcard generation'
      );
    });
  });
});