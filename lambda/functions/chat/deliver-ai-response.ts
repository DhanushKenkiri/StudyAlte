import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { WebSocketConnectionService } from '../../services/websocket-connection';
import { ProcessedMessage } from '../../services/message-queue';

const logger = new Logger('deliver-ai-response');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const connectionService = new WebSocketConnectionService(dynamoClient);

// Initialize API Gateway Management API client
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

export const handler = createHandler(async (event: SQSEvent): Promise<void> => {
  logger.info('Processing AI response delivery batch', {
    recordCount: event.Records.length,
  });

  // Process responses in parallel with controlled concurrency
  const deliveryPromises = event.Records.map(record => 
    deliverResponse(record).catch(error => {
      logger.error('Error delivering individual response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: record.messageId,
      });
      // Don't throw to avoid failing the entire batch
      return null;
    })
  );

  await Promise.allSettled(deliveryPromises);

  logger.info('AI response delivery batch completed', {
    recordCount: event.Records.length,
  });
});

async function deliverResponse(record: SQSRecord): Promise<void> {
  try {
    const processedMessage: ProcessedMessage = JSON.parse(record.body);
    
    logger.info('Delivering AI response', {
      messageId: processedMessage.messageId,
      sessionId: processedMessage.sessionId,
      userId: processedMessage.userId,
      confidence: processedMessage.confidence,
    });

    // Get session connections
    const sessionConnections = await connectionService.getSessionConnections(processedMessage.sessionId);
    
    if (sessionConnections.length === 0) {
      logger.warn('No active connections found for session', {
        sessionId: processedMessage.sessionId,
        messageId: processedMessage.messageId,
      });
      return;
    }

    // Prepare response message
    const responseData = {
      type: 'ai_response',
      data: {
        messageId: processedMessage.messageId,
        sessionId: processedMessage.sessionId,
        content: processedMessage.aiResponse,
        timestamp: processedMessage.timestamp,
        role: 'assistant',
        metadata: {
          confidence: processedMessage.confidence,
          processingTime: processedMessage.processingTime,
          sources: processedMessage.metadata?.sources,
          relatedConcepts: processedMessage.metadata?.relatedConcepts,
          suggestedActions: processedMessage.metadata?.suggestedActions,
          relatedTopics: processedMessage.metadata?.relatedTopics,
          wasFiltered: processedMessage.metadata?.wasFiltered,
        },
        suggestions: processedMessage.metadata?.suggestions,
        originalMessageId: processedMessage.metadata?.originalMessageId,
      },
    };

    // Send response to all session participants
    const deliveryPromises = sessionConnections.map(connection => 
      sendToConnection(connection.connectionId, responseData).catch(error => {
        logger.warn('Failed to deliver response to connection', {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionId: connection.connectionId,
          userId: connection.userId,
          sessionId: processedMessage.sessionId,
        });
        
        // If connection is stale, it will be cleaned up by the connection service
        return null;
      })
    );

    const results = await Promise.allSettled(deliveryPromises);
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;

    logger.info('AI response delivered to session participants', {
      messageId: processedMessage.messageId,
      sessionId: processedMessage.sessionId,
      totalConnections: sessionConnections.length,
      successfulDeliveries: successCount,
      failedDeliveries: failureCount,
    });

    // Send delivery confirmation to original sender if they have a different connection
    const originalConnectionId = processedMessage.metadata?.originalConnectionId;
    if (originalConnectionId) {
      const isOriginalConnectionInSession = sessionConnections.some(
        conn => conn.connectionId === originalConnectionId
      );

      if (!isOriginalConnectionInSession) {
        try {
          await sendToConnection(originalConnectionId, {
            type: 'message_delivered',
            data: {
              messageId: processedMessage.messageId,
              timestamp: new Date().toISOString(),
              deliveredTo: successCount,
            },
          });
        } catch (error) {
          logger.warn('Failed to send delivery confirmation to original sender', {
            error: error instanceof Error ? error.message : 'Unknown error',
            originalConnectionId,
            messageId: processedMessage.messageId,
          });
        }
      }
    }

  } catch (error) {
    logger.error('Error delivering AI response', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: record.messageId,
    });
    throw error;
  }
}

async function sendToConnection(connectionId: string, data: any): Promise<void> {
  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));

    logger.debug('Message sent to connection successfully', {
      connectionId,
      messageType: data.type,
    });

  } catch (error) {
    logger.error('Failed to send message to connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
      messageType: data.type,
    });
    
    // If connection is stale (GoneException), remove it
    if (error instanceof Error && error.name === 'GoneException') {
      try {
        await connectionService.removeConnection(connectionId);
        logger.info('Removed stale connection', { connectionId });
      } catch (cleanupError) {
        logger.warn('Failed to remove stale connection', {
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
          connectionId,
        });
      }
    }
    
    throw error;
  }
}