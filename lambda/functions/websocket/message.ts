import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { createHandler } from '../../shared/handler';
import { validateRequest } from '../../shared/validation';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { WebSocketConnectionService } from '../../services/websocket-connection';
import { MessageQueueService } from '../../services/message-queue';
import { ConversationMemoryService } from '../../services/conversation-memory';

const logger = new Logger('websocket-message');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const connectionService = new WebSocketConnectionService(dynamoClient);
const messageQueueService = new MessageQueueService();
const conversationMemoryService = new ConversationMemoryService(dynamoClient);

// Initialize API Gateway Management API client
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

interface WebSocketMessage {
  action: string;
  data: any;
}

interface ChatMessageData {
  sessionId: string;
  content: string;
  type?: 'text' | 'typing' | 'stop_typing';
  metadata?: Record<string, any>;
}

const messageSchema = {
  type: 'object',
  required: ['action'],
  properties: {
    action: {
      type: 'string',
      enum: ['send_message', 'typing', 'stop_typing', 'join_session', 'leave_session', 'ping'],
    },
    data: {
      type: 'object',
    },
  },
};

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId;
    
    if (!connectionId) {
      logger.error('Missing connection ID');
      return createResponse(400, { error: 'Missing connection ID' });
    }

    // Parse message
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateRequest(body, messageSchema);
    
    if (!validationResult.isValid) {
      logger.warn('Invalid WebSocket message', { 
        errors: validationResult.errors,
        connectionId,
      });
      
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid message format',
        details: validationResult.errors,
      });
      
      return createResponse(400, { error: 'Invalid message format' });
    }

    const message: WebSocketMessage = body;
    
    logger.info('Processing WebSocket message', {
      connectionId,
      action: message.action,
    });

    // Get connection details
    const connection = await connectionService.getConnection(connectionId);
    if (!connection) {
      logger.error('Connection not found', { connectionId });
      return createResponse(404, { error: 'Connection not found' });
    }

    // Update last activity
    await connectionService.updateLastActivity(connectionId);

    // Handle different message types
    switch (message.action) {
      case 'send_message':
        await handleChatMessage(connection, message.data as ChatMessageData);
        break;
        
      case 'typing':
        await handleTypingIndicator(connection, message.data, true);
        break;
        
      case 'stop_typing':
        await handleTypingIndicator(connection, message.data, false);
        break;
        
      case 'join_session':
        await handleJoinSession(connection, message.data.sessionId);
        break;
        
      case 'leave_session':
        await handleLeaveSession(connection, message.data.sessionId);
        break;
        
      case 'ping':
        await handlePing(connectionId);
        break;
        
      default:
        logger.warn('Unknown message action', { 
          action: message.action,
          connectionId,
        });
        
        await sendToConnection(connectionId, {
          type: 'error',
          message: 'Unknown action',
        });
    }

    return createResponse(200, { message: 'Message processed' });

  } catch (error) {
    logger.error('Error processing WebSocket message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId: event.requestContext.connectionId,
    });

    // Try to send error to client
    if (event.requestContext.connectionId) {
      try {
        await sendToConnection(event.requestContext.connectionId, {
          type: 'error',
          message: 'Internal server error',
        });
      } catch (sendError) {
        logger.error('Failed to send error message to client', {
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }
    }

    return createResponse(500, { error: 'Internal server error' });
  }
});

async function handleChatMessage(
  connection: any,
  data: ChatMessageData
): Promise<void> {
  const { sessionId, content, type = 'text', metadata } = data;
  
  logger.info('Handling chat message', {
    connectionId: connection.connectionId,
    userId: connection.userId,
    sessionId,
    type,
  });

  // Store message in conversation history
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await conversationMemoryService.storeMessage({
    sessionId,
    userId: connection.userId,
    messageId,
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      connectionId: connection.connectionId,
      type,
    },
  });

  // Queue message for AI processing
  await messageQueueService.queueMessage({
    messageId,
    sessionId,
    userId: connection.userId,
    content,
    timestamp: new Date().toISOString(),
    connectionId: connection.connectionId,
  });

  // Broadcast message to session participants
  await broadcastToSession(sessionId, {
    type: 'message',
    data: {
      messageId,
      sessionId,
      userId: connection.userId,
      content,
      timestamp: new Date().toISOString(),
      role: 'user',
    },
  }, connection.connectionId);

  // Send acknowledgment to sender
  await sendToConnection(connection.connectionId, {
    type: 'message_sent',
    data: {
      messageId,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleTypingIndicator(
  connection: any,
  data: any,
  isTyping: boolean
): Promise<void> {
  const { sessionId } = data;
  
  if (!sessionId) {
    logger.warn('Missing sessionId for typing indicator', {
      connectionId: connection.connectionId,
    });
    return;
  }

  logger.info('Handling typing indicator', {
    connectionId: connection.connectionId,
    userId: connection.userId,
    sessionId,
    isTyping,
  });

  // Broadcast typing status to session participants
  await broadcastToSession(sessionId, {
    type: isTyping ? 'user_typing' : 'user_stopped_typing',
    data: {
      userId: connection.userId,
      sessionId,
      timestamp: new Date().toISOString(),
    },
  }, connection.connectionId);
}

async function handleJoinSession(
  connection: any,
  sessionId: string
): Promise<void> {
  if (!sessionId) {
    logger.warn('Missing sessionId for join session', {
      connectionId: connection.connectionId,
    });
    return;
  }

  logger.info('Handling join session', {
    connectionId: connection.connectionId,
    userId: connection.userId,
    sessionId,
  });

  // Join session room
  await connectionService.joinSessionRoom(connection.connectionId, sessionId);

  // Update connection with session info
  await connectionService.updateConnectionSession(connection.connectionId, sessionId);

  // Notify session participants
  await broadcastToSession(sessionId, {
    type: 'user_joined',
    data: {
      userId: connection.userId,
      sessionId,
      timestamp: new Date().toISOString(),
    },
  }, connection.connectionId);

  // Send confirmation to user
  await sendToConnection(connection.connectionId, {
    type: 'session_joined',
    data: {
      sessionId,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleLeaveSession(
  connection: any,
  sessionId: string
): Promise<void> {
  if (!sessionId) {
    logger.warn('Missing sessionId for leave session', {
      connectionId: connection.connectionId,
    });
    return;
  }

  logger.info('Handling leave session', {
    connectionId: connection.connectionId,
    userId: connection.userId,
    sessionId,
  });

  // Leave session room
  await connectionService.leaveSessionRoom(connection.connectionId, sessionId);

  // Update connection
  await connectionService.updateConnectionSession(connection.connectionId, null);

  // Notify session participants
  await broadcastToSession(sessionId, {
    type: 'user_left',
    data: {
      userId: connection.userId,
      sessionId,
      timestamp: new Date().toISOString(),
    },
  }, connection.connectionId);

  // Send confirmation to user
  await sendToConnection(connection.connectionId, {
    type: 'session_left',
    data: {
      sessionId,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handlePing(connectionId: string): Promise<void> {
  await sendToConnection(connectionId, {
    type: 'pong',
    timestamp: new Date().toISOString(),
  });
}

async function sendToConnection(connectionId: string, data: any): Promise<void> {
  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
  } catch (error) {
    logger.error('Failed to send message to connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });
    
    // If connection is stale, remove it
    if (error instanceof Error && error.name === 'GoneException') {
      await connectionService.removeConnection(connectionId);
    }
    
    throw error;
  }
}

async function broadcastToSession(
  sessionId: string,
  data: any,
  excludeConnectionId?: string
): Promise<void> {
  try {
    const sessionConnections = await connectionService.getSessionConnections(sessionId);
    
    const broadcastPromises = sessionConnections
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(conn => sendToConnection(conn.connectionId, data).catch(error => {
        logger.warn('Failed to send message to session participant', {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionId: conn.connectionId,
          sessionId,
        });
      }));

    await Promise.allSettled(broadcastPromises);
    
    logger.info('Broadcasted message to session', {
      sessionId,
      recipientCount: sessionConnections.length,
      excludedConnection: excludeConnectionId,
    });
    
  } catch (error) {
    logger.error('Failed to broadcast to session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId,
    });
  }
}