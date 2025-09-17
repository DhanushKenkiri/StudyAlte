import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ComprehendClient, DetectKeyPhrasesCommand, DetectEntitiesCommand, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import { handler } from '../generate-quiz';
import OpenAI from 'openai';

// Mock AWS clients
const dynamoMock = mockClient(DynamoDBDocumentClient);
const comprehendMock = mockClient(ComprehendClient);

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.OPENAI_API_KEY = 'test-api-key';

describe('Generate Quiz Lambda Function', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    dynamoMock.reset();
    comprehendMock.reset();
    jest.clearAllMocks();

    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;
    MockedOpenAI.mockImplementation(() => mockOpenAI);
  });

  const mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Machine Learning Basics',
    options: {
      language: 'en',
      questionCount: 5,
      difficulty: 'mixed' as const,
      questionTypes: ['multiple-choice', 'true-false', 'short-answer'] as const,
      includeExplanations: true,
      adaptiveDifficulty: false,
      timeLimit: 10,
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
            questions: [
              {
                type: 'multiple-choice',
                question: 'What is machine learning?',
                options: [
                  'A subset of artificial intelligence',
                  'A type of computer hardware',
                  'A programming language',
                  'A database system'
                ],
                correctAnswer: 'A subset of artificial intelligence',
                explanation: 'Machine learning is indeed a subset of artificial intelligence that enables computers to learn from data.',
                difficulty: 'medium',
                points: 2,
                timeLimit: 60,
                tags: ['AI', 'ML', 'fundamentals'],
                category: 'Definitions',
              },
              {
                type: 'true-false',
                question: 'Neural networks are inspired by biological neural networks.',
                correctAnswer: 'True',
                explanation: 'True. Neural networks in computing are indeed inspired by biological neural networks found in brains.',
                difficulty: 'easy',
                points: 1,
                timeLimit: 30,
                tags: ['neural networks', 'biology'],
                category: 'Concepts',
              },
              {
                type: 'short-answer',
                question: 'What enables computers to learn without explicit programming?',
                correctAnswer: 'Machine learning',
                explanation: 'Machine learning algorithms enable computers to learn and improve from data without being explicitly programmed for each task.',
                difficulty: 'medium',
                points: 3,
                timeLimit: 90,
                tags: ['learning', 'programming'],
                category: 'Concepts',
              },
            ],
          }),
        },
      },
    ],
  };

  it('should successfully generate quiz with OpenAI and Comprehend', async () => {
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
    expect(result.body.quiz.quiz).toHaveLength(3);
    expect(result.body.quiz.totalQuestions).toBe(3);
    expect(result.body.quiz.totalPoints).toBe(6); // 2 + 1 + 3
    expect(result.body.quiz.estimatedTime).toBeGreaterThan(0);

    // Verify question structure
    const firstQuestion = result.body.quiz.quiz[0];
    expect(firstQuestion.id).toBeDefined();
    expect(firstQuestion.type).toBe('multiple-choice');
    expect(firstQuestion.question).toBe('What is machine learning?');
    expect(firstQuestion.options).toHaveLength(4);
    expect(firstQuestion.correctAnswer).toBe('A subset of artificial intelligence');
    expect(firstQuestion.explanation).toContain('Machine learning');

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

    await expect(handler(eventWithoutContent)).rejects.toThrow('No content available for quiz generation');
  });

  it('should handle OpenAI API failure with fallback quiz', async () => {
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
    expect(result.body.quiz.quiz.length).toBeGreaterThan(0);
    // Fallback quiz should contain questions from key points and topics
    expect(result.body.quiz.categories).toContain('Key Concepts');
  });

  it('should respect question count option', async () => {
    const eventWithQuestionCount = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        questionCount: 2,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with 2 questions
    const twoQuestionResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              questions: mockOpenAIResponse.choices[0].message.content 
                ? JSON.parse(mockOpenAIResponse.choices[0].message.content).questions.slice(0, 2)
                : [],
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(twoQuestionResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(eventWithQuestionCount);

    expect(result.statusCode).toBe(200);
    expect(result.body.quiz.quiz).toHaveLength(2);
    expect(result.body.quiz.totalQuestions).toBe(2);

    // Verify OpenAI was called with correct question count
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('create 2 quiz questions');
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
    expect(result.body.quiz.difficulty).toBe('hard');

    // Verify OpenAI was called with hard difficulty
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('hard: 5 questions');
  });

  it('should handle adaptive difficulty option', async () => {
    const adaptiveEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        adaptiveDifficulty: true,
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

    const result = await handler(adaptiveEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.quiz.adaptiveSettings).toBeDefined();
    expect(result.body.quiz.adaptiveSettings.baselineScore).toBe(0.7);
    expect(result.body.quiz.adaptiveSettings.difficultyProgression).toEqual(['easy', 'medium', 'hard']);
    expect(result.body.quiz.adaptiveSettings.adaptiveRules).toHaveLength(3);

    // Verify OpenAI prompt included adaptive difficulty instruction
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Design questions that can adapt based on previous answers');
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
    // Should fallback to basic quiz
    expect(result.body.quiz.categories).toContain('Key Concepts');
  });

  it('should filter out invalid questions from OpenAI response', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with some invalid questions
    const responseWithInvalidQuestions = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              questions: [
                {
                  type: 'multiple-choice',
                  question: 'Valid question?',
                  options: ['A', 'B', 'C', 'D'],
                  correctAnswer: 'A',
                  explanation: 'Valid explanation',
                  difficulty: 'medium',
                  points: 2,
                  timeLimit: 60,
                  tags: ['test'],
                  category: 'Test',
                },
                {
                  // Missing question
                  type: 'multiple-choice',
                  options: ['A', 'B', 'C', 'D'],
                  correctAnswer: 'A',
                  explanation: 'Missing question',
                },
                {
                  type: 'true-false',
                  question: 'Another valid question?',
                  correctAnswer: 'True',
                  explanation: 'Another valid explanation',
                  difficulty: 'easy',
                  points: 1,
                  timeLimit: 30,
                  tags: ['test'],
                  category: 'Test',
                },
                {
                  type: 'short-answer',
                  question: 'Question without answer',
                  // Missing correctAnswer
                  explanation: 'Missing answer',
                },
              ],
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(responseWithInvalidQuestions as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.quiz.quiz).toHaveLength(2); // Only valid questions
    expect(result.body.quiz.totalQuestions).toBe(2);
  });

  it('should calculate question type distribution correctly', async () => {
    const eventWithSpecificTypes = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        questionCount: 6,
        questionTypes: ['multiple-choice', 'true-false'] as const,
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

    const result = await handler(eventWithSpecificTypes);

    expect(result.statusCode).toBe(200);

    // Verify OpenAI prompt included correct type distribution
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('multiple-choice: 3 questions');
    expect(openAICall.messages[1].content).toContain('true-false: 3 questions');
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

  it('should handle time limit option', async () => {
    const timedEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        timeLimit: 5, // 5 minutes
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

    const result = await handler(timedEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.quiz.estimatedTime).toBeLessThanOrEqual(5);
  });
});