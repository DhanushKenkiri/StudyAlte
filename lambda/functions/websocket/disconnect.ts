import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { WebSocketConnectionService } from '../../services/websocket-connection';

const logger = new Logger('websocket-disconnect');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const connectionService = new WebSocketConnectionService(dynamoClient);

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const connectionId = event.requestContext.connectionId;

    if (!connectionId) {
      logger.error('Missing connection ID');
      return createResponse(400, { error: 'Missing connection ID' });
    }

    logger.info('WebSocket disconnection request', { connectionId });

    // Get connection details before removing
    const connection = await connectionService.getConnection(connectionId);
    
    if (connection) {
      // Leave all session rooms
      if (connection.sessionId) {
        await connectionService.leaveSessionRoom(connectionId, connection.sessionId);
      }

      // Update user presence if this was their last connection
      const userConnections = await connectionService.getUserConnections(connection.userId);
      if (userConnections.length <= 1) {
        await connectionService.updateUserPresence(connection.userId, 'offline');
      }

      // Remove connection
      await connectionService.removeConnection(connectionId);

      logger.info('WebSocket connection removed successfully', {
        connectionId,
        userId: connection.userId,
        sessionId: connection.sessionId,
      });
    } else {
      logger.warn('Connection not found in database', { connectionId });
    }

    return createResponse(200, { message: 'Disconnected' });

  } catch (error) {
    logger.error('Error handling WebSocket disconnection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId: event.requestContext.connectionId,
    });

    return createResponse(500, {
      error: 'Failed to handle disconnection',
    });
  }
});