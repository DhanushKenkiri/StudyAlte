import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as connectHandler } from '../connect';
import { handler as disconnectHandler } from '../disconnect';
import { handler as messageHandler } from '../message';
import { WebSocketConnectionService } from '../../../services/websocket-connection';
import { MessageQueueService } from '../../../services/message-queue';
import { ConversationMemoryService } from '../../../services/conversation-memory';

// Mock the services
jest.mock('../../../services/websocket-connection');
jest.mock('../../../services/message-queue');
jest.mock('../../../services/conversation-memory');

const mockConnectionService = WebSocketConnectionService as jest.MockedClass<typeof WebSocketConnectionService>;
const mockMessageQueueService = MessageQueueService as jest.MockedClass<typeof MessageQueueService>;
const mockConversationMemoryService = ConversationMemoryService as jest.MockedClass<typeof ConversationMemoryService>;

describe('WebSocket Integration Tests', () => {
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEvent = {
      requestContext: {
        connectionId: 'test-connection-123',
        routeKey: '$connect',
      } as any,
      queryStringParameters: {
        userId: 'test-user-456',
        sessionId: 'test-session-789',
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 Test Browser',
        'Origin': 'https://example.com',
      },
      body: null,
      pathParameters: null,
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/',
      resource: '/',
      stageVariables: null,
      multiValueQueryStringParameters: null,
    };

    // Setup default mocks
    mockConnectionService.prototype.storeConnection.mockResolvedValue();
    mockConnectionService.prototype.updateUserPresence.mockResolvedValue();
    mockConnectionService.prototype.joinSessionRoom.mockResolvedValue();
    mockConnectionService.prototype.getConnection.mockResolvedValue({
      connectionId: 'test-connection-123',
      userId: 'test-user-456',
      sessionId: 'test-session-789',
      connectedAt: '2024-01-01T10:00:00Z',
      lastActivity: '2024-01-01T10:00:00Z',
      status: 'connected',
    });
    mockConnectionService.prototype.removeConnection.mockResolvedValue();
    mockConnectionService.prototype.leaveSessionRoom.mockResolvedValue();
    mockConnectionService.prototype.getUserConnections.mockResolvedValue([]);
    mockConnectionService.prototype.updateLastActivity.mockResolvedValue();
    mockConnectionService.prototype.getSessionConnections.mockResolvedValue([]);
    
    mockMessageQueueService.prototype.queueMessage.mockResolvedValue();
    mockConversationMemoryService.prototype.storeMessage.mockResolvedValue();
  });

  describe('WebSocket Connection', () => {
    it('should handle connection successfully', async () => {
      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.storeConnection).toHaveBeenCalledWith({
        connectionId: 'test-connection-123',
        userId: 'test-user-456',
        sessionId: 'test-session-789',
        connectedAt: expect.any(String),
        lastActivity: expect.any(String),
        status: 'connected',
        metadata: {
          userAgent: 'Mozilla/5.0 Test Browser',
          origin: 'https://example.com',
        },
      });
      expect(mockConnectionService.prototype.updateUserPresence).toHaveBeenCalledWith('test-user-456', 'online');
      expect(mockConnectionService.prototype.joinSessionRoom).toHaveBeenCalledWith('test-connection-123', 'test-session-789');
    });

    it('should handle connection without sessionId', async () => {
      mockEvent.queryStringParameters = {
        userId: 'test-user-456',
      };

      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.storeConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'test-connection-123',
          userId: 'test-user-456',
          sessionId: undefined,
        })
      );
      expect(mockConnectionService.prototype.joinSessionRoom).not.toHaveBeenCalled();
    });

    it('should reject connection without userId', async () => {
      mockEvent.queryStringParameters = {};

      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Missing user ID');
    });

    it('should handle connection service errors', async () => {
      mockConnectionService.prototype.storeConnection.mockRejectedValue(new Error('DynamoDB error'));

      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Failed to establish connection');
    });
  });

  describe('WebSocket Disconnection', () => {
    it('should handle disconnection successfully', async () => {
      const result = await disconnectHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.getConnection).toHaveBeenCalledWith('test-connection-123');
      expect(mockConnectionService.prototype.leaveSessionRoom).toHaveBeenCalledWith('test-connection-123', 'test-session-789');
      expect(mockConnectionService.prototype.removeConnection).toHaveBeenCalledWith('test-connection-123');
    });

    it('should update user presence when last connection', async () => {
      mockConnectionService.prototype.getUserConnections.mockResolvedValue([
        {
          connectionId: 'test-connection-123',
          userId: 'test-user-456',
          connectedAt: '2024-01-01T10:00:00Z',
          lastActivity: '2024-01-01T10:00:00Z',
          status: 'connected',
        },
      ]);

      const result = await disconnectHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.updateUserPresence).toHaveBeenCalledWith('test-user-456', 'offline');
    });

    it('should handle disconnection when connection not found', async () => {
      mockConnectionService.prototype.getConnection.mockResolvedValue(null);

      const result = await disconnectHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.removeConnection).not.toHaveBeenCalled();
    });

    it('should handle disconnection service errors', async () => {
      mockConnectionService.prototype.getConnection.mockRejectedValue(new Error('DynamoDB error'));

      const result = await disconnectHandler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Failed to handle disconnection');
    });
  });

  describe('WebSocket Message Handling', () => {
    beforeEach(() => {
      mockEvent.body = JSON.stringify({
        action: 'send_message',
        data: {
          sessionId: 'test-session-789',
          content: 'Hello, AI tutor!',
          type: 'text',
        },
      });
    });

    it('should handle chat message successfully', async () => {
      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.getConnection).toHaveBeenCalledWith('test-connection-123');
      expect(mockConnectionService.prototype.updateLastActivity).toHaveBeenCalledWith('test-connection-123');
      expect(mockConversationMemoryService.prototype.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-789',
          userId: 'test-user-456',
          role: 'user',
          content: 'Hello, AI tutor!',
        })
      );
      expect(mockMessageQueueService.prototype.queueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-789',
          userId: 'test-user-456',
          content: 'Hello, AI tutor!',
          connectionId: 'test-connection-123',
        })
      );
    });

    it('should handle typing indicator', async () => {
      mockEvent.body = JSON.stringify({
        action: 'typing',
        data: {
          sessionId: 'test-session-789',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('test-session-789');
    });

    it('should handle stop typing indicator', async () => {
      mockEvent.body = JSON.stringify({
        action: 'stop_typing',
        data: {
          sessionId: 'test-session-789',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('test-session-789');
    });

    it('should handle join session', async () => {
      mockEvent.body = JSON.stringify({
        action: 'join_session',
        data: {
          sessionId: 'new-session-123',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.joinSessionRoom).toHaveBeenCalledWith('test-connection-123', 'new-session-123');
      expect(mockConnectionService.prototype.updateConnectionSession).toHaveBeenCalledWith('test-connection-123', 'new-session-123');
    });

    it('should handle leave session', async () => {
      mockEvent.body = JSON.stringify({
        action: 'leave_session',
        data: {
          sessionId: 'test-session-789',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.leaveSessionRoom).toHaveBeenCalledWith('test-connection-123', 'test-session-789');
      expect(mockConnectionService.prototype.updateConnectionSession).toHaveBeenCalledWith('test-connection-123', null);
    });

    it('should handle ping message', async () => {
      mockEvent.body = JSON.stringify({
        action: 'ping',
        data: {},
      });

      // Mock the API Gateway client
      const mockApiGatewayClient = {
        send: jest.fn().mockResolvedValue({}),
      };
      
      // This would require mocking the API Gateway client properly
      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
    });

    it('should reject invalid message format', async () => {
      mockEvent.body = JSON.stringify({
        // Missing required 'action' field
        data: {
          sessionId: 'test-session-789',
          content: 'Hello',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(400);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Invalid message format');
    });

    it('should handle unknown action', async () => {
      mockEvent.body = JSON.stringify({
        action: 'unknown_action',
        data: {},
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200); // Still returns 200 but sends error to client
    });

    it('should handle connection not found', async () => {
      mockConnectionService.prototype.getConnection.mockResolvedValue(null);

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(404);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Connection not found');
    });

    it('should handle message processing errors', async () => {
      mockConversationMemoryService.prototype.storeMessage.mockRejectedValue(new Error('Storage error'));

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(500);
      const response = JSON.parse(result.body);
      expect(response.error).toBe('Internal server error');
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast to session participants', async () => {
      mockConnectionService.prototype.getSessionConnections.mockResolvedValue([
        {
          sessionId: 'test-session-789',
          connectionId: 'connection-1',
          userId: 'user-1',
          joinedAt: '2024-01-01T10:00:00Z',
        },
        {
          sessionId: 'test-session-789',
          connectionId: 'connection-2',
          userId: 'user-2',
          joinedAt: '2024-01-01T10:00:00Z',
        },
      ]);

      mockEvent.body = JSON.stringify({
        action: 'send_message',
        data: {
          sessionId: 'test-session-789',
          content: 'Hello everyone!',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(mockConnectionService.prototype.getSessionConnections).toHaveBeenCalledWith('test-session-789');
    });

    it('should handle broadcasting errors gracefully', async () => {
      mockConnectionService.prototype.getSessionConnections.mockResolvedValue([
        {
          sessionId: 'test-session-789',
          connectionId: 'stale-connection',
          userId: 'user-1',
          joinedAt: '2024-01-01T10:00:00Z',
        },
      ]);

      mockEvent.body = JSON.stringify({
        action: 'typing',
        data: {
          sessionId: 'test-session-789',
        },
      });

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(200);
      // Should not fail even if broadcasting to some connections fails
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in message body', async () => {
      mockEvent.body = 'invalid json';

      const result = await messageHandler(mockEvent);

      expect(result.statusCode).toBe(500);
    });

    it('should handle missing connection ID', async () => {
      mockEvent.requestContext.connectionId = undefined as any;

      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(400);
    });

    it('should handle service unavailability', async () => {
      mockConnectionService.prototype.storeConnection.mockRejectedValue(new Error('Service unavailable'));

      const result = await connectHandler(mockEvent);

      expect(result.statusCode).toBe(500);
    });
  });
});