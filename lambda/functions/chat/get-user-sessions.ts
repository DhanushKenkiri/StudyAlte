import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { ConversationMemoryService } from '../../services/conversation-memory';

const logger = new Logger('get-user-sessions');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const conversationMemoryService = new ConversationMemoryService(dynamoClient);

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.userId;
    const limit = parseInt(event.queryStringParameters?.limit || '20');

    if (!userId) {
      logger.warn('Missing userId parameter');
      return createResponse(400, {
        error: 'Missing required parameter',
        message: 'userId is required',
      });
    }

    if (limit < 1 || limit > 100) {
      logger.warn('Invalid limit parameter', { limit });
      return createResponse(400, {
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 100',
      });
    }

    logger.info('Retrieving user chat sessions', { userId, limit });

    // Get user sessions
    const sessions = await conversationMemoryService.getUserSessions(userId, limit);

    logger.info('User chat sessions retrieved successfully', {
      userId,
      sessionCount: sessions.length,
    });

    return createResponse(200, {
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        context: session.context,
        isActive: session.isActive,
      })),
      total: sessions.length,
    });

  } catch (error) {
    logger.error('Error retrieving user chat sessions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to retrieve user chat sessions',
    });
  }
});