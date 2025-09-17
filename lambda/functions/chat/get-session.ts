import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { ConversationMemoryService } from '../../services/conversation-memory';

const logger = new Logger('get-session');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const conversationMemoryService = new ConversationMemoryService(dynamoClient);

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const sessionId = event.pathParameters?.sessionId;
    const userId = event.queryStringParameters?.userId;

    if (!sessionId || !userId) {
      logger.warn('Missing required parameters', { sessionId, userId });
      return createResponse(400, {
        error: 'Missing required parameters',
        message: 'sessionId and userId are required',
      });
    }

    logger.info('Retrieving chat session', { sessionId, userId });

    // Get session details
    const session = await conversationMemoryService.getSession(sessionId, userId);

    if (!session) {
      logger.info('Session not found', { sessionId, userId });
      return createResponse(404, {
        error: 'Session not found',
        message: 'The requested chat session does not exist',
      });
    }

    // Get conversation history
    const messages = await conversationMemoryService.getConversationHistory(
      sessionId,
      userId,
      50 // Get last 50 messages
    );

    logger.info('Chat session retrieved successfully', {
      sessionId,
      userId,
      messageCount: messages.length,
    });

    return createResponse(200, {
      session: {
        sessionId: session.sessionId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        context: session.context,
        isActive: session.isActive,
      },
      messages: messages.map(msg => ({
        messageId: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
      })),
    });

  } catch (error) {
    logger.error('Error retrieving chat session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to retrieve chat session',
    });
  }
});