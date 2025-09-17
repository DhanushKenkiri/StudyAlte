import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ComprehendClient, DetectKeyPhrasesCommand, DetectEntitiesCommand, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import { handler } from '../generate-notes';
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

describe('Generate Notes Lambda Function', () => {
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
      format: 'markdown' as const,
      includeTimestamps: true,
      includeHighlights: true,
      includeAnnotations: false,
      categorizeByTopics: true,
      generateTags: true,
      includeKeyQuotes: true,
      detailLevel: 'detailed' as const,
    },
    transcriptResult: {
      Payload: {
        transcript: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. Neural networks are computing systems inspired by biological neural networks. Deep learning uses multiple layers of neural networks to process complex data.',
        segments: [
          { text: 'Machine learning is a subset of artificial intelligence', start: 0, duration: 5 },
          { text: 'Neural networks are computing systems inspired by biological neural networks', start: 10, duration: 6 },
          { text: 'Deep learning uses multiple layers of neural networks', start: 20, duration: 4 },
        ],
        language: 'en',
      },
    },
    summaryResult: {
      Payload: {
        summary: 'This video covers machine learning fundamentals, neural networks, and deep learning concepts.',
        keyPoints: [
          'Machine learning enables computers to learn from data',
          'Neural networks are inspired by biological systems',
          'Deep learning uses multiple layers of neural networks',
        ],
        topics: ['Machine Learning', 'Neural Networks', 'Deep Learning'],
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
      { Text: 'deep learning', Score: 0.85, BeginOffset: 150, EndOffset: 163 },
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
            sections: [
              {
                id: 'intro',
                title: 'Introduction to Machine Learning',
                content: 'Machine learning is a powerful subset of artificial intelligence that enables computers to learn and make decisions from data without explicit programming.',
                type: 'introduction',
                level: 0,
                order: 0,
                tags: ['introduction', 'overview'],
                highlights: ['machine learning', 'artificial intelligence'],
              },
              {
                id: 'neural-networks',
                title: 'Neural Networks',
                content: 'Neural networks are computing systems inspired by biological neural networks found in animal brains. They consist of interconnected nodes that process information.',
                type: 'main-point',
                level: 1,
                order: 1,
                tags: ['neural networks', 'biology'],
                highlights: ['neural networks', 'biological inspiration'],
              },
              {
                id: 'deep-learning',
                title: 'Deep Learning',
                content: 'Deep learning is a specialized form of machine learning that uses multiple layers of neural networks to process complex data and identify patterns.',
                type: 'main-point',
                level: 1,
                order: 2,
                tags: ['deep learning', 'layers'],
                highlights: ['deep learning', 'multiple layers'],
              },
            ],
            tags: ['machine learning', 'AI', 'neural networks', 'deep learning', 'education'],
            categories: ['Machine Learning', 'Neural Networks', 'Deep Learning'],
            keyQuotes: ['Machine learning enables computers to learn from data without explicit programming'],
            keywords: ['machine learning', 'neural networks', 'deep learning', 'artificial intelligence'],
          }),
        },
      },
    ],
  };

  it('should successfully generate notes with OpenAI and Comprehend', async () => {
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
    expect(result.body.notes.sections).toHaveLength(3);
    expect(result.body.notes.format).toBe('markdown');
    expect(result.body.notes.content).toContain('# Introduction to Machine Learning');
    expect(result.body.notes.metadata.totalSections).toBe(3);
    expect(result.body.notes.metadata.wordCount).toBeGreaterThan(0);
    expect(result.body.notes.metadata.readingTime).toBeGreaterThan(0);

    // Verify sections structure
    const introSection = result.body.notes.sections.find((s: any) => s.type === 'introduction');
    expect(introSection).toBeDefined();
    expect(introSection.title).toBe('Introduction to Machine Learning');
    expect(introSection.level).toBe(0);
    expect(introSection.highlights).toContain('machine learning');

    // Verify search index
    expect(result.body.notes.searchIndex).toBeDefined();
    expect(result.body.notes.searchIndex.keywords).toContain('machine learning');
    expect(result.body.notes.searchIndex.topics).toContain('Machine Learning');

    // Verify structure
    expect(result.body.notes.structure).toBeDefined();
    expect(result.body.notes.structure.outline).toBeDefined();
    expect(result.body.notes.structure.hierarchy).toBeDefined();

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

    await expect(handler(eventWithoutContent)).rejects.toThrow('No content available for notes generation');
  });

  it('should handle OpenAI API failure with fallback notes', async () => {
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
    expect(result.body.notes.sections.length).toBeGreaterThan(0);
    
    // Fallback should have introduction and conclusion
    const introSection = result.body.notes.sections.find((s: any) => s.type === 'introduction');
    const conclusionSection = result.body.notes.sections.find((s: any) => s.type === 'conclusion');
    expect(introSection).toBeDefined();
    expect(conclusionSection).toBeDefined();
  });

  it('should respect format option', async () => {
    const outlineEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        format: 'outline' as const,
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

    const result = await handler(outlineEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.notes.format).toBe('outline');
    expect(result.body.notes.content).toMatch(/^\s*1\./m); // Should start with numbered outline

    // Verify OpenAI was called with outline format
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Format: outline');
  });

  it('should handle different detail levels', async () => {
    const briefEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        detailLevel: 'brief' as const,
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

    const result = await handler(briefEvent);

    expect(result.statusCode).toBe(200);

    // Verify OpenAI was called with brief detail level
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Detail level: brief');
  });

  it('should include timestamps when requested', async () => {
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
    expect(result.body.notes.content).toContain('Timestamp:'); // Should include timestamp markers
  });

  it('should handle different format types', async () => {
    const formats = ['markdown', 'outline', 'structured', 'bullet-points'];

    for (const format of formats) {
      const formatEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          format: format as any,
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

      const result = await handler(formatEvent);

      expect(result.statusCode).toBe(200);
      expect(result.body.notes.format).toBe(format);
      expect(result.body.notes.content).toBeDefined();
      expect(result.body.notes.content.length).toBeGreaterThan(0);

      // Reset mocks for next iteration
      dynamoMock.reset();
      comprehendMock.reset();
      mockOpenAI.chat.completions.create.mockClear();
    }
  });

  it('should create search index correctly', async () => {
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
    expect(result.body.notes.searchIndex).toBeDefined();
    expect(Array.isArray(result.body.notes.searchIndex.keywords)).toBe(true);
    expect(Array.isArray(result.body.notes.searchIndex.phrases)).toBe(true);
    expect(Array.isArray(result.body.notes.searchIndex.topics)).toBe(true);
    expect(result.body.notes.searchIndex.keywords.length).toBeGreaterThan(0);
  });

  it('should create structure outline correctly', async () => {
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
    expect(result.body.notes.structure).toBeDefined();
    expect(Array.isArray(result.body.notes.structure.outline)).toBe(true);
    expect(typeof result.body.notes.structure.hierarchy).toBe('object');
    expect(result.body.notes.structure.outline.length).toBeGreaterThan(0);
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
    // Should fallback to basic notes
    expect(result.body.notes.sections.length).toBeGreaterThan(0);
    expect(result.body.notes.metadata.tags).toContain('fallback');
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

  it('should filter out invalid sections from OpenAI response', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with some invalid sections
    const responseWithInvalidSections = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              sections: [
                {
                  id: 'valid-section',
                  title: 'Valid Section',
                  content: 'Valid content',
                  type: 'main-point',
                  level: 1,
                  order: 0,
                  tags: ['valid'],
                  highlights: ['highlight'],
                },
                {
                  // Missing title
                  id: 'invalid-section-1',
                  content: 'Content without title',
                  type: 'main-point',
                },
                {
                  id: 'another-valid-section',
                  title: 'Another Valid Section',
                  content: 'Another valid content',
                  type: 'detail',
                  level: 2,
                  order: 1,
                  tags: ['valid'],
                  highlights: [],
                },
                {
                  // Missing content
                  id: 'invalid-section-2',
                  title: 'Title without content',
                  type: 'main-point',
                },
              ],
              tags: ['test'],
              categories: ['Test'],
              keyQuotes: [],
              keywords: ['test'],
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(responseWithInvalidSections as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.notes.sections).toHaveLength(2); // Only valid sections
    expect(result.body.notes.metadata.totalSections).toBe(2);
  });

  it('should calculate reading time correctly', async () => {
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
    expect(result.body.notes.metadata.readingTime).toBeGreaterThan(0);
    expect(typeof result.body.notes.metadata.readingTime).toBe('number');
    
    // Reading time should be reasonable (based on word count / 200 words per minute)
    const expectedTime = Math.ceil(result.body.notes.metadata.wordCount / 200);
    expect(result.body.notes.metadata.readingTime).toBe(expectedTime);
  });
});