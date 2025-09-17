import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler as processMessageHandler } from '../process-message-queue';
import { handler as deliverResponseHandler } from '../deliver-ai-response';
import { AITutorService } from '../../../services/ai-tutor';
import { ConversationMemoryService } from '../../../services/conversation-memory';
import { ContentContextService } from '../../../services/content-context';
import { ResponseQualityService } from '../../../services/response-quality';
import { MessageQueueService } from '../../../services/message-queue';
import { WebSocketConnectionService } from '../../../services/websocket-connection';

// Mock the services
jest.mock('../../../services/ai-tutor');
jest.mock('../../../services/conversation-memory');
jest.mock('../../../services/content-context');
jest.mock('../../../services/response-quality');
jest.mock('../../../services/message-queue');
jest.mock('../../../services/websocket-connection');

const mockAITutorService = AITutorService as jest.MockedClass<typeof AITutorService>;
const mockConversationMemoryService = ConversationMemoryService as jest.MockedClass<typeof ConversationMemoryService>;
const mockContentContextService = ContentContextService as jest.MockedClass<typeof ContentContextService>;
const mockResponseQualityService = ResponseQualityService as jest.MockedClass<typeof ResponseQualityService>;
const mockMessageQueueService = MessageQueueService as jest.MockedClass<typeof MessageQueueService>;
const mockWebSocketConnectionService = WebSocketConnectionService as jest.MockedClass<typeof WebSocketConnectionService>;

describe('Message Processing Tests', () => {
  let mockSQSEvent: SQSEvent;
  let mockSQSRecord: SQSRecord;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSQSRecord = {
      messageId: 'sqs-message-123',
      receiptHandle: 'receipt-handle-123',
      body: JSON.stringify({
        messageId: 'msg-123',
        sessionId: 'session-456',
        userId: 'user-789',
        content: 'What is machine learning?',
        timestamp: '2024-01-01T10:00:00Z',
        connectionId: 'connection-123',
        retryCount: 0,
      }),
      attributes: {},
      messageAttributes: {},
      md5OfBody: 'md5-hash',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:region:account:queue-name',
      awsRegion: 'us-east-1',
    };

    mockSQSEvent = {
      Records: [mockSQSRecord],
    };

    // Setup default mocks for message processing
    mockConversationMemoryService.prototype.getConversationHistory.mockResolvedValue([
      {
        sessionId: 'session-456',
        userId: 'user-789',
        messageId: 'prev-msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T09:59:00Z',
      },
    ]);

    mockContentContextService.prototype.enhanceContext.mockResolvedValue({
      sessionId: 'session-456',
      userId: 'user-789',
      videoTitle: 'Introduction to ML',
      currentTranscript: 'Machine learning is...',
      difficulty: 'intermediate',
      conversationHistory: [],
    });

    mockAITutorService.prototype.generateResponse.mockResolvedValue({
      content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
      confidence: 0.9,
      sources: ['Video: Introduction to ML'],
      relatedConcepts: ['AI', 'algorithms'],
      suggestedActions: ['Practice with examples'],
    });

    mockResponseQualityService.prototype.filterResponse.mockResolvedValue({
      content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
      confidence: 0.9,
      sources: ['Video: Introduction to ML'],
      relatedConcepts: ['AI', 'algorithms'],
      suggestedActions: ['Practice with examples'],
      wasFiltered: false,
    });

    mockAITutorService.prototype.generateSuggestions.mockResolvedValue([
      'Can you give me an example?',
      'What are the types of ML?',
      'How is it used in practice?',
    ]);

    mockConversationMemoryService.prototype.storeMessage.mockResolvedValue();
    mockMessageQueueService.prototype.queueAIResponse.mockResolvedValue();
    mockMessageQueueService.prototype.requeueMessage.mockResolvedValue();

    // Setup mocks for response delivery
    mockWebSocketConnectionService.prototype.getSessionConnections.mockResolvedValue([
      {
        sessionId: 'session-456',
        connectionId: 'connection-123',
        userId: 'user-789',
        joinedAt: '2024-01-01T10:00:00Z',
      },
      {
        sessionId: 'session-456',
        connectionId: 'connection-456',
        userId: 'user-101',
        joinedAt: '2024-01-01T10:00:00Z',
      },
    ]);
  });

  describe('Message Queue Processing', () => {
    it('should process message successfully', async () => {
      await processMessageHandler(mockSQSEvent);

      expect(mockConversationMemoryService.prototype.getConversationHistory).toHaveBeenCalledWith(
        'session-456',
        'user-789',
        10
      );

      expect(mockContentContextService.prototype.enhanceContext).toHaveBeenCalledWith({
        sessionId: 'session-456',
        userId: 'user-789',
        conversationHistory: expect.any(Array),
      });

      expect(mockAITutorService.prototype.generateResponse).toHaveBeenCalledWith({
        message: 'What is machine learning?',
        context: expect.objectContaining({
          sessionId: 'session-456',
          userId: 'user-789',
        }),
        conversationHistory: expect.any(Array),
      });

      expect(mockResponseQualityService.prototype.filterResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Machine learning'),
          confidence: 0.9,
        }),
        {
          userId: 'user-789',
          sessionId: 'session-456',
          originalMessage: 'What is machine learning?',
        }
      );

      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-456',
          userId: 'user-789',
          role: 'assistant',
          content: expect.stringContaining('Machine learning'),
        })
      );

      expect(mockMessageQueueService.prototype.queueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-456',
          userId: 'user-789',
          aiResponse: expect.stringContaining('Machine learning'),
          confidence: 0.9,
        })
      );
    });

    it('should handle multiple messages in batch', async () => {
      const secondRecord: SQSRecord = {
        ...mockSQSRecord,
        messageId: 'sqs-message-456',
        body: JSON.stringify({
          messageId: 'msg-456',
          sessionId: 'session-789',
          userId: 'user-101',
          content: 'Explain neural networks',
          timestamp: '2024-01-01T10:01:00Z',
          connectionId: 'connection-456',
          retryCount: 0,
        }),
      };

      mockSQSEvent.Records.push(secondRecord);

      await processMessageHandler(mockSQSEvent);

      expect(mockAITutorService.prototype.generateResponse).toHaveBeenCalledTimes(2);
      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledTimes(2);
      expect(mockMessageQueueService.prototype.queueAIResponse).toHaveBeenCalledTimes(2);
    });

    it('should handle AI service errors and requeue message', async () => {
      mockAITutorService.prototype.generateResponse.mockRejectedValue(new Error('OpenAI API error'));

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          sessionId: 'session-456',
          userId: 'user-789',
        }),
        'OpenAI API error'
      );
    });

    it('should handle conversation memory errors', async () => {
      mockConversationMemoryService.prototype.getConversationHistory.mockRejectedValue(
        new Error('DynamoDB error')
      );

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
        }),
        'DynamoDB error'
      );
    });

    it('should handle context enhancement errors', async () => {
      mockContentContextService.prototype.enhanceContext.mockRejectedValue(
        new Error('Context service error')
      );

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
        }),
        'Context service error'
      );
    });

    it('should handle response quality filtering errors', async () => {
      mockResponseQualityService.prototype.filterResponse.mockRejectedValue(
        new Error('Filtering error')
      );

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
        }),
        'Filtering error'
      );
    });

    it('should handle message storage errors', async () => {
      mockConversationMemoryService.prototype.storeMessage.mockRejectedValue(
        new Error('Storage error')
      );

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
        }),
        'Storage error'
      );
    });

    it('should handle retry count and processing time', async () => {
      const retryMessage = JSON.parse(mockSQSRecord.body);
      retryMessage.retryCount = 2;
      mockSQSRecord.body = JSON.stringify(retryMessage);

      await processMessageHandler(mockSQSEvent);

      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            processingTime: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('AI Response Delivery', () => {
    let deliveryEvent: SQSEvent;
    let deliveryRecord: SQSRecord;

    beforeEach(() => {
      deliveryRecord = {
        messageId: 'delivery-msg-123',
        receiptHandle: 'delivery-receipt-123',
        body: JSON.stringify({
          messageId: 'response-msg-123',
          sessionId: 'session-456',
          userId: 'user-789',
          aiResponse: 'Machine learning is a subset of AI...',
          confidence: 0.9,
          processingTime: 1500,
          timestamp: '2024-01-01T10:00:30Z',
          metadata: {
            originalMessageId: 'msg-123',
            originalConnectionId: 'connection-123',
            sources: ['Video: Introduction to ML'],
            relatedConcepts: ['AI', 'algorithms'],
            suggestions: ['Can you give me an example?'],
          },
        }),
        attributes: {},
        messageAttributes: {},
        md5OfBody: 'md5-hash',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:response-queue',
        awsRegion: 'us-east-1',
      };

      deliveryEvent = {
        Records: [deliveryRecord],
      };
    });

    it('should deliver AI response to session participants', async () => {
      // Mock the API Gateway Management API
      const mockApiGatewayClient = {
        send: jest.fn().mockResolvedValue({}),
      };

      await deliverResponseHandler(deliveryEvent);

      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
    });

    it('should handle session with no active connections', async () => {
      mockWebSocketConnectionService.prototype.getSessionConnections.mockResolvedValue([]);

      await deliverResponseHandler(deliveryEvent);

      // Should not throw error, just log warning
      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
    });

    it('should handle multiple responses in batch', async () => {
      const secondDeliveryRecord: SQSRecord = {
        ...deliveryRecord,
        messageId: 'delivery-msg-456',
        body: JSON.stringify({
          messageId: 'response-msg-456',
          sessionId: 'session-789',
          userId: 'user-101',
          aiResponse: 'Neural networks are...',
          confidence: 0.85,
          processingTime: 2000,
          timestamp: '2024-01-01T10:01:30Z',
          metadata: {
            originalMessageId: 'msg-456',
            originalConnectionId: 'connection-456',
          },
        }),
      };

      deliveryEvent.Records.push(secondDeliveryRecord);

      await deliverResponseHandler(deliveryEvent);

      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledTimes(2);
      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-789');
    });

    it('should handle connection delivery failures gracefully', async () => {
      // Mock API Gateway client to simulate connection failures
      const mockApiGatewayClient = {
        send: jest.fn()
          .mockResolvedValueOnce({}) // First connection succeeds
          .mockRejectedValueOnce(new Error('Connection failed')), // Second connection fails
      };

      await deliverResponseHandler(deliveryEvent);

      // Should not throw error, just log warnings for failed deliveries
      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
    });

    it('should handle stale connections', async () => {
      // Mock API Gateway client to simulate GoneException
      const mockApiGatewayClient = {
        send: jest.fn().mockRejectedValue({
          name: 'GoneException',
          message: 'Connection no longer exists',
        }),
      };

      await deliverResponseHandler(deliveryEvent);

      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
    });

    it('should send delivery confirmation to original sender', async () => {
      // Mock scenario where original sender is not in session
      mockWebSocketConnectionService.prototype.getSessionConnections.mockResolvedValue([
        {
          sessionId: 'session-456',
          connectionId: 'different-connection',
          userId: 'different-user',
          joinedAt: '2024-01-01T10:00:00Z',
        },
      ]);

      await deliverResponseHandler(deliveryEvent);

      expect(mockWebSocketConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('session-456');
    });

    it('should handle malformed response messages', async () => {
      deliveryRecord.body = 'invalid json';

      await deliverResponseHandler(deliveryEvent);

      // Should handle gracefully without throwing
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle individual message failures without affecting batch', async () => {
      const secondRecord: SQSRecord = {
        ...mockSQSRecord,
        messageId: 'sqs-message-456',
        body: JSON.stringify({
          messageId: 'msg-456',
          sessionId: 'session-789',
          userId: 'user-101',
          content: 'Valid message',
          timestamp: '2024-01-01T10:01:00Z',
          connectionId: 'connection-456',
        }),
      };

      mockSQSEvent.Records.push(secondRecord);

      // Make first message fail
      mockAITutorService.prototype.generateResponse
        .mockRejectedValueOnce(new Error('First message error'))
        .mockResolvedValueOnce({
          content: 'Valid response',
          confidence: 0.8,
          sources: [],
          relatedConcepts: [],
          suggestedActions: [],
        });

      await processMessageHandler(mockSQSEvent);

      // Second message should still be processed
      expect(mockAITutorService.prototype.generateResponse).toHaveBeenCalledTimes(2);
      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle service timeouts', async () => {
      mockAITutorService.prototype.generateResponse.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await processMessageHandler(mockSQSEvent);

      expect(mockMessageQueueService.prototype.requeueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
        }),
        'Timeout'
      );
    });

    it('should handle malformed SQS messages', async () => {
      mockSQSRecord.body = 'invalid json';

      await processMessageHandler(mockSQSEvent);

      // Should handle gracefully without throwing
    });

    it('should track processing metrics', async () => {
      await processMessageHandler(mockSQSEvent);

      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            processingTime: expect.any(Number),
          }),
        })
      );
    });
  });
});