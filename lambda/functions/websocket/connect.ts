import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { WebSocketConnectionService } from '../../services/websocket-connection';

const logger = new Logger('websocket-connect');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const connectionService = new WebSocketConnectionService(dynamoClient);

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId;
    const userId = event.queryStringParameters?.userId;
    const sessionId = event.queryStringParameters?.sessionId;

    if (!connectionId) {
      logger.error('Missing connection ID');
      return createResponse(400, { error: 'Missing connection ID' });
    }

    if (!userId) {
      logger.error('Missing user ID');
      return createResponse(400, { error: 'Missing user ID' });
    }

    logger.info('WebSocket connection request', {
      connectionId,
      userId,
      sessionId,
    });

    // Store connection information
    await connectionService.storeConnection({
      connectionId,
      userId,
      sessionId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'connected',
      metadata: {
        userAgent: event.headers?.['User-Agent'],
        origin: event.headers?.Origin,
      },
    });

    // Update user presence
    await connectionService.updateUserPresence(userId, 'online');

    // Join session room if sessionId provided
    if (sessionId) {
      await connectionService.joinSessionRoom(connectionId, sessionId);
    }

    logger.info('WebSocket connection established successfully', {
      connectionId,
      userId,
      sessionId,
    });

    return createResponse(200, { message: 'Connected' });

  } catch (error) {
    logger.error('Error establishing WebSocket connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId: event.requestContext.connectionId,
    });

    return createResponse(500, {
      error: 'Failed to establish connection',
    });
  }
});