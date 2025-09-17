import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../generate-summary';
import { generateSummary } from '../../../services/summary-generation';

// Mock AWS clients
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Mock summary generation service
jest.mock('../../../services/summary-generation');
const mockGenerateSummary = generateSummary as jest.MockedFunction<typeof generateSummary>;

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.OPENAI_API_KEY = 'test-api-key';

describe('Generate Summary Lambda Function', () => {
  beforeEach(() => {
    dynamoMock.reset();
    jest.clearAllMocks();
  });

  const mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Video',
    options: {
      language: 'en',
      summaryLength: 'medium' as const,
      includeKeyPoints: true,
      includeTopics: true,
    },
    transcriptResult: {
      Payload: {
        transcript: 'This is a test transcript about machine learning and artificial intelligence. It covers neural networks, deep learning, and data science concepts. The video explains how to build models and train algorithms for predictive analytics.',
        segments: [
          { text: 'This is a test transcript', start: 0, duration: 5 },
          { text: 'about machine learning', start: 5, duration: 3 },
        ],
        language: 'en',
      },
    },
    validationResult: {
      Payload: {
        metadata: {
          title: 'Machine Learning Basics',
          description: 'An introduction to machine learning concepts',
          duration: 600,
          channelTitle: 'Tech Education',
          tags: ['machine learning', 'AI', 'education'],
        },
      },
    },
  };

  const mockComprehendResponse = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'artificial intelligence', Score: 0.92, BeginOffset: 20, EndOffset: 43 },
      { Text: 'neural networks', Score: 0.88, BeginOffset: 50, EndOffset: 65 },
    ],
    entities: [
      { Text: 'machine learning', Type: 'OTHER', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'data science', Type: 'OTHER', Score: 0.90, BeginOffset: 100, EndOffset: 112 },
    ],
    sentiment: {
      Sentiment: 'POSITIVE',
      SentimentScore: {
        Positive: 0.8,
        Negative: 0.1,
        Neutral: 0.1,
        Mixed: 0.0,
      },
    },
  };

  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: 'This video provides a comprehensive introduction to machine learning and artificial intelligence concepts. It covers neural networks, deep learning algorithms, and data science methodologies. The content explains how to build predictive models and train algorithms for various applications.',
            keyPoints: [
              'Machine learning fundamentals and core concepts',
              'Neural networks and deep learning architectures',
              'Data science methodologies and best practices',
              'Model building and training techniques',
              'Predictive analytics applications',
            ],
            topics: [
              'Machine Learning',
              'Artificial Intelligence',
              'Neural Networks',
              'Data Science',
              'Predictive Analytics',
            ],
            confidence: 0.92,
          }),
        },
      },
    ],
  };

  it('should successfully generate summary with OpenAI and Comprehend', async () => {
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
    expect(result.body.summary.summary).toContain('machine learning');
    expect(result.body.summary.keyPoints).toHaveLength(5);
    expect(result.body.summary.topics).toHaveLength(5);
    expect(result.body.summary.confidence).toBe(0.92);
    expect(result.body.summary.comprehendAnalysis).toBeDefined();
    expect(result.body.summary.comprehendAnalysis.sentiment).toBe('POSITIVE');

    // Verify OpenAI was called with correct parameters
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })
    );

    // Verify DynamoDB update was called
    expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
    const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(updateCall.args[0].input.Key.PK).toBe('USER#user-123');
    expect(updateCall.args[0].input.Key.SK).toBe('CAPSULE#capsule-123');
  });

  it('should handle missing transcript by fetching from database', async () => {
    const eventWithoutTranscript = {
      ...mockEvent,
      transcriptResult: undefined,
    };

    // Mock DynamoDB get to return capsule with transcript
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {
          transcript: {
            text: 'Database transcript content about machine learning',
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

    const result = await handler(eventWithoutTranscript);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);

    // Verify DynamoDB get was called
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('should throw error when no transcript is available', async () => {
    const eventWithoutTranscript = {
      ...mockEvent,
      transcriptResult: undefined,
    };

    // Mock DynamoDB get to return capsule without transcript
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {},
      },
    });

    await expect(handler(eventWithoutTranscript)).rejects.toThrow('No transcript available for summary generation');
  });

  it('should handle OpenAI API failure with fallback summary', async () => {
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
    expect(result.body.summary.summary).toContain('Machine Learning Basics');
    expect(result.body.summary.confidence).toBe(0.6); // Lower confidence for fallback
  });

  it('should handle different summary lengths', async () => {
    const shortSummaryEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        summaryLength: 'short' as const,
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

    const result = await handler(shortSummaryEvent);

    expect(result.statusCode).toBe(200);
    
    // Verify OpenAI was called with short summary parameters
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('short summary');
    expect(openAICall.messages[1].content).toContain('150 words');
  });

  it('should handle Comprehend service failures gracefully', async () => {
    // Mock Comprehend to fail
    comprehendMock.on(DetectKeyPhrasesCommand).rejects(new Error('Comprehend error'));
    comprehendMock.on(DetectEntitiesCommand).rejects(new Error('Comprehend error'));
    comprehendMock.on(DetectSentimentCommand).rejects(new Error('Comprehend error'));

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    // Should still work without Comprehend analysis
    expect(result.body.summary.summary).toBeDefined();
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
    // Should fallback to basic summary
    expect(result.body.summary.confidence).toBe(0.6);
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
    expect(result.body.summary.language).toBe('es');

    // Verify Comprehend was called with Spanish language code
    const comprehendCalls = comprehendMock.commandCalls(DetectKeyPhrasesCommand);
    expect(comprehendCalls[0].args[0].input.LanguageCode).toBe('es');
  });

  it('should handle options for excluding key points and topics', async () => {
    const minimalEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        includeKeyPoints: false,
        includeTopics: false,
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

    const result = await handler(minimalEvent);

    expect(result.statusCode).toBe(200);
    
    // Verify prompt doesn't include key points and topics requirements
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).not.toContain('Include specific, actionable key points');
    expect(openAICall.messages[1].content).not.toContain('Identify and categorize main topics');
  });
});  cons
t mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Video',
    options: {
      language: 'en',
      length: 'medium' as const,
      style: 'educational' as const,
      includeKeyPoints: true,
      includeTopics: true,
    },
    transcriptResult: {
      Payload: {
        transcript: 'This is a test transcript about machine learning and artificial intelligence.',
        language: 'en',
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

  const mockSummaryResult = {
    summary: 'This video provides an introduction to machine learning, covering key concepts and applications.',
    keyPoints: [
      'Machine learning is a subset of AI',
      'There are three main types of ML',
      'Data preprocessing is crucial',
    ],
    topics: ['Machine Learning', 'Artificial Intelligence', 'Data Science'],
    mainConcepts: ['machine learning', 'artificial intelligence', 'algorithms'],
    difficulty: 'intermediate' as const,
    estimatedReadingTime: 2,
    wordCount: 150,
    structure: {
      hasIntroduction: true,
      hasConclusion: true,
      mainSections: 3,
    },
    quality: {
      overallScore: 8.5,
      readabilityScore: 8.0,
      coherenceScore: 9.0,
      completenessScore: 8.5,
      issues: [],
      suggestions: [],
      metrics: {
        wordCount: 150,
        sentenceCount: 8,
        avgWordsPerSentence: 18.75,
        complexWords: 15,
        readingLevel: 'intermediate',
      },
    },
    metadata: {
      language: 'en',
      style: 'educational',
      length: 'medium',
      generatedAt: '2024-01-01T00:00:00Z',
      sourceLength: 1000,
      compressionRatio: 6.67,
    },
    insights: {
      keyPhrases: ['machine learning', 'artificial intelligence'],
      entities: { OTHER: ['Machine Learning', 'AI'] },
      sentiment: 'NEUTRAL',
      confidence: 0.8,
    },
  };

  describe('successful summary generation', () => {
    beforeEach(() => {
      mockGenerateSummary.mockResolvedValue(mockSummaryResult);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should generate summary successfully with transcript', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.summary).toEqual(mockSummaryResult);
      expect(result.body.videoId).toBe(mockEvent.videoId);
      expect(result.body.capsuleId).toBe(mockEvent.capsuleId);
    });

    it('should call generateSummary with correct parameters', async () => {
      await handler(mockEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        mockEvent.transcriptResult.Payload.transcript,
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

    it('should store summary in database', async () => {
      await handler(mockEvent);

      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
      const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
      expect(updateCall.args[0].input).toEqual({
        TableName: 'test-table',
        Key: {
          PK: 'USER#user-123',
          SK: 'CAPSULE#capsule-123',
        },
        UpdateExpression: expect.stringContaining('learningContent.summary'),
        ExpressionAttributeNames: {
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':summary': expect.objectContaining({
            ...mockSummaryResult,
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
          },
        },
      });

      await handler(eventWithoutTranscript);

      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      expect(mockGenerateSummary).toHaveBeenCalledWith(
        'Database transcript content',
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

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
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

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
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
  });

  describe('error handling', () => {
    it('should throw error when no transcript is available', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({ Item: {} });

      await expect(handler(eventWithoutTranscript)).rejects.toThrow(
        'No transcript available for summary generation'
      );
    });

    it('should handle summary generation service errors', async () => {
      mockGenerateSummary.mockRejectedValue(new Error('Summary generation failed'));

      await expect(handler(mockEvent)).rejects.toThrow('Summary generation failed');
    });

    it('should handle database update errors', async () => {
      mockGenerateSummary.mockResolvedValue(mockSummaryResult);
      dynamoMock.on(UpdateCommand).rejects(new Error('Database error'));

      await expect(handler(mockEvent)).rejects.toThrow('Database error');
    });

    it('should handle database get errors when fetching transcript', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).rejects(new Error('Database get error'));

      await expect(handler(eventWithoutTranscript)).rejects.toThrow('Database get error');
    });
  });

  describe('different summary options', () => {
    beforeEach(() => {
      mockGenerateSummary.mockResolvedValue(mockSummaryResult);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should handle brief summary length', async () => {
      const briefEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          length: 'brief' as const,
        },
      };

      await handler(briefEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          length: 'brief',
        })
      );
    });

    it('should handle detailed summary length', async () => {
      const detailedEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          length: 'detailed' as const,
        },
      };

      await handler(detailedEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          length: 'detailed',
        })
      );
    });

    it('should handle different styles', async () => {
      const academicEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          style: 'academic' as const,
        },
      };

      await handler(academicEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          style: 'academic',
        })
      );
    });

    it('should handle focus areas', async () => {
      const focusEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          focusAreas: ['algorithms', 'applications'],
        },
      };

      await handler(focusEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          focusAreas: ['algorithms', 'applications'],
        })
      );
    });

    it('should handle custom max length', async () => {
      const customLengthEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          maxLength: 500,
        },
      };

      await handler(customLengthEvent);

      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          maxLength: 500,
        })
      );
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      mockGenerateSummary.mockResolvedValue(mockSummaryResult);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should return properly formatted success response', async () => {
      const result = await handler(mockEvent);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');
      expect(result.body).toHaveProperty('success', true);
      expect(result.body).toHaveProperty('summary');
      expect(result.body).toHaveProperty('videoId');
      expect(result.body).toHaveProperty('capsuleId');
      expect(result.body.summary).toEqual(mockSummaryResult);
    });

    it('should include all summary properties', async () => {
      const result = await handler(mockEvent);

      expect(result.body.summary).toHaveProperty('summary');
      expect(result.body.summary).toHaveProperty('keyPoints');
      expect(result.body.summary).toHaveProperty('topics');
      expect(result.body.summary).toHaveProperty('mainConcepts');
      expect(result.body.summary).toHaveProperty('difficulty');
      expect(result.body.summary).toHaveProperty('estimatedReadingTime');
      expect(result.body.summary).toHaveProperty('wordCount');
      expect(result.body.summary).toHaveProperty('structure');
      expect(result.body.summary).toHaveProperty('quality');
      expect(result.body.summary).toHaveProperty('metadata');
      expect(result.body.summary).toHaveProperty('insights');
    });
  });

  describe('database operations', () => {
    beforeEach(() => {
      mockGenerateSummary.mockResolvedValue(mockSummaryResult);
    });

    it('should fetch transcript from database when not provided', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          learningContent: {
            transcript: {
              text: 'Fetched transcript',
            },
          },
        },
      });
      dynamoMock.on(UpdateCommand).resolves({});

      await handler(eventWithoutTranscript);

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

    it('should handle empty database response for transcript', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({});

      await expect(handler(eventWithoutTranscript)).rejects.toThrow(
        'No transcript available for summary generation'
      );
    });
  });
});