import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../ai-tutor';
import { AITutorService } from '../../../services/ai-tutor';
import { ConversationMemoryService } from '../../../services/conversation-memory';
import { ContentContextService } from '../../../services/content-context';
import { ResponseQualityService } from '../../../services/response-quality';

// Mock the services
jest.mock('../../../services/ai-tutor');
jest.mock('../../../services/conversation-memory');
jest.mock('../../../services/content-context');
jest.mock('../../../services/response-quality');

const mockAITutorService = AITutorService as jest.MockedClass<typeof AITutorService>;
const mockConversationMemoryService = ConversationMemoryService as jest.MockedClass<typeof ConversationMemoryService>;
const mockContentContextService = ContentContextService as jest.MockedClass<typeof ContentContextService>;
const mockResponseQualityService = ResponseQualityService as jest.MockedClass<typeof ResponseQualityService>;

describe('AI Tutor Lambda Function', () => {
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEvent = {
      body: JSON.stringify({
        message: 'What is machine learning?',
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        context: {
          capsuleId: 'test-capsule-789',
          videoId: 'test-video-101',
          difficulty: 'intermediate',
          learningGoals: ['Understand ML basics'],
        },
      }),
      pathParameters: null,
      queryStringParameters: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/chat/ai-tutor',
      resource: '/chat/ai-tutor',
      requestContext: {} as any,
      stageVariables: null,
      multiValueQueryStringParameters: null,
    };

    // Setup default mocks
    mockConversationMemoryService.prototype.getConversationHistory.mockResolvedValue([
      {
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        messageId: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        messageId: 'msg-2',
        role: 'assistant',
        content: 'Hello! How can I help you learn today?',
        timestamp: '2024-01-01T10:00:30Z',
      },
    ]);

    mockContentContextService.prototype.enhanceContext.mockResolvedValue({
      capsuleId: 'test-capsule-789',
      videoId: 'test-video-101',
      videoTitle: 'Introduction to Machine Learning',
      currentTranscript: 'Machine learning is a subset of artificial intelligence...',
      difficulty: 'intermediate',
      learningGoals: ['Understand ML basics'],
      sessionId: 'test-session-123',
      userId: 'test-user-456',
      conversationHistory: [],
      relatedConcepts: ['artificial intelligence', 'algorithms', 'data science'],
    });

    mockAITutorService.prototype.generateResponse.mockResolvedValue({
      content: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions or decisions based on those patterns.',
      confidence: 0.9,
      sources: ['Video: Introduction to Machine Learning'],
      relatedConcepts: ['artificial intelligence', 'algorithms', 'data science'],
      relatedTopics: ['supervised learning', 'unsupervised learning'],
      suggestedActions: ['Practice with examples', 'Take a quiz'],
    });

    mockResponseQualityService.prototype.filterResponse.mockResolvedValue({
      content: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions or decisions based on those patterns.',
      confidence: 0.9,
      sources: ['Video: Introduction to Machine Learning'],
      relatedConcepts: ['artificial intelligence', 'algorithms', 'data science'],
      relatedTopics: ['supervised learning', 'unsupervised learning'],
      suggestedActions: ['Practice with examples', 'Take a quiz'],
      wasFiltered: false,
    });

    mockAITutorService.prototype.generateSuggestions.mockResolvedValue([
      'Can you give me an example?',
      'What are the different types of machine learning?',
      'How is it used in real applications?',
    ]);

    mockConversationMemoryService.prototype.storeMessage.mockResolvedValue();
  });

  describe('Successful AI Tutor Interactions', () => {
    it('should generate AI response successfully', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response.messageId).toBeDefined();
      expect(response.content).toContain('Machine learning is a subset');
      expect(response.metadata.confidence).toBe(0.9);
      expect(response.suggestions).toHaveLength(3);
      expect(response.metadata.sources).toContain('Video: Introduction to Machine Learning');
    });

    it('should handle context enhancement', async () => {
      await handler(mockEvent);

      expect(mockContentContextService.prototype.enhanceContext).toHaveBeenCalledWith({
        capsuleId: 'test-capsule-789',
        videoId: 'test-video-101',
        difficulty: 'intermediate',
        learningGoals: ['Understand ML basics'],
        conversationHistory: expect.any(Array),
        sessionId: 'test-session-123',
        userId: 'test-user-456',
      });
    });

    it('should store conversation messages', async () => {
      await handler(mockEvent);

      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledTimes(2);
      
      // Check user message storage
      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          userId: 'test-user-456',
          role: 'user',
          content: 'What is machine learning?',
        })
      );

      // Check AI response storage
      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          userId: 'test-user-456',
          role: 'assistant',
          content: expect.stringContaining('Machine learning is a subset'),
        })
      );
    });

    it('should apply response quality filtering', async () => {
      await handler(mockEvent);

      expect(mockResponseQualityService.prototype.filterResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Machine learning is a subset'),
          confidence: 0.9,
        }),
        {
          userId: 'test-user-456',
          sessionId: 'test-session-123',
          originalMessage: 'What is machine learning?',
        }
      );
    });

    it('should generate follow-up suggestions', async () => {
      await handler(mockEvent);

      expect(mockAITutorService.prototype.generateSuggestions).toHaveBeenCalledWith({
        message: 'What is machine learning?',
        response: expect.stringContaining('Machine learning is a subset'),
        context: expect.objectContaining({
          sessionId: 'test-session-123',
          userId: 'test-user-456',
        }),
      });
    });
  });

  describe('Request Validation', () => {
    it('should reject invalid request body', async () => {
      mockEvent.body = JSON.stringify({
        message: '', // Empty message
        sessionId: 'test-session-123',
        userId: 'test-user-456',
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Invalid request');
    });

    it('should reject missing required fields', async () => {
      mockEvent.body = JSON.stringify({
        message: 'What is machine learning?',
        // Missing sessionId and userId
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Invalid request');
    });

    it('should reject message that is too long', async () => {
      mockEvent.body = JSON.stringify({
        message: 'a'.repeat(2001), // Exceeds max length
        sessionId: 'test-session-123',
        userId: 'test-user-456',
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Invalid request');
    });

    it('should validate context structure', async () => {
      mockEvent.body = JSON.stringify({
        message: 'What is machine learning?',
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        context: {
          difficulty: 'invalid-difficulty', // Invalid enum value
        },
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Invalid request');
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service errors gracefully', async () => {
      mockAITutorService.prototype.generateResponse.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Internal server error');
    });

    it('should handle conversation memory errors', async () => {
      mockConversationMemoryService.prototype.getConversationHistory.mockRejectedValue(
        new Error('DynamoDB error')
      );

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Internal server error');
    });

    it('should handle context enhancement errors', async () => {
      mockContentContextService.prototype.enhanceContext.mockRejectedValue(
        new Error('Context service error')
      );

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Internal server error');
    });

    it('should handle response filtering errors', async () => {
      mockResponseQualityService.prototype.filterResponse.mockRejectedValue(
        new Error('Filtering error')
      );

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Internal server error');
    });
  });

  describe('Context Variations', () => {
    it('should handle request without context', async () => {
      mockEvent.body = JSON.stringify({
        message: 'What is machine learning?',
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        // No context provided
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockContentContextService.prototype.enhanceContext).toHaveBeenCalledWith({
        conversationHistory: expect.any(Array),
        sessionId: 'test-session-123',
        userId: 'test-user-456',
      });
    });

    it('should handle partial context', async () => {
      mockEvent.body = JSON.stringify({
        message: 'What is machine learning?',
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        context: {
          difficulty: 'beginner',
          // Only difficulty provided
        },
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockContentContextService.prototype.enhanceContext).toHaveBeenCalledWith({
        difficulty: 'beginner',
        conversationHistory: expect.any(Array),
        sessionId: 'test-session-123',
        userId: 'test-user-456',
      });
    });

    it('should handle context with previous messages', async () => {
      mockEvent.body = JSON.stringify({
        message: 'What is machine learning?',
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        context: {
          previousMessages: [
            {
              role: 'user',
              content: 'Hello',
              timestamp: '2024-01-01T10:00:00Z',
            },
            {
              role: 'assistant',
              content: 'Hi there!',
              timestamp: '2024-01-01T10:00:30Z',
            },
          ],
        },
      });

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockContentContextService.prototype.enhanceContext).toHaveBeenCalledWith(
        expect.objectContaining({
          previousMessages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello',
            }),
          ]),
        })
      );
    });
  });

  describe('Response Structure', () => {
    it('should return properly structured response', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response).toHaveProperty('messageId');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('metadata');
      expect(response).toHaveProperty('suggestions');
      expect(response).toHaveProperty('relatedTopics');

      expect(response.metadata).toHaveProperty('confidence');
      expect(response.metadata).toHaveProperty('sources');
      expect(response.metadata).toHaveProperty('relatedConcepts');
      expect(response.metadata).toHaveProperty('suggestedActions');
      expect(response.metadata).toHaveProperty('processingTime');
    });

    it('should limit suggestions to maximum of 3', async () => {
      mockAITutorService.prototype.generateSuggestions.mockResolvedValue([
        'Suggestion 1',
        'Suggestion 2',
        'Suggestion 3',
        'Suggestion 4',
        'Suggestion 5',
      ]);

      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response.suggestions).toHaveLength(3);
    });

    it('should include processing time in metadata', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      
      const response = JSON.parse(result.body);
      expect(response.metadata.processingTime).toBeGreaterThan(0);
      expect(typeof response.metadata.processingTime).toBe('number');
    });
  });
});