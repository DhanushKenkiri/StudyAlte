import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { successResponse, errorResponse } from '../../shared/response';
import { indexOrganizedNotes, deleteNotesForCapsule } from '../../services/elasticsearch-notes';

const logger = new Logger('index-content');

interface IndexContentRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  action: 'index' | 'delete' | 'update';
  organizedNotes?: any;
}

/**
 * Lambda function to index content for search
 * Can be triggered by API Gateway or DynamoDB streams
 */
async function indexContentHandler(
  event: APIGatewayProxyEvent | DynamoDBStreamEvent
): Promise<APIGatewayProxyResult | void> {
  try {
    // Handle DynamoDB stream events
    if ('Records' in event && event.Records[0]?.eventSource === 'aws:dynamodb') {
      return await handleDynamoDBStreamEvent(event as DynamoDBStreamEvent);
    }

    // Handle API Gateway events
    const apiEvent = event as APIGatewayProxyEvent;
    const requestBody: IndexContentRequest = JSON.parse(apiEvent.body || '{}');
    const { userId, capsuleId, videoId, action, organizedNotes } = requestBody;

    logger.info('Processing content indexing request', {
      userId,
      capsuleId,
      videoId,
      action,
    });

    // Validate required parameters
    if (!userId || !capsuleId || !videoId || !action) {
      return errorResponse(400, 'MISSING_PARAMETERS', 'Missing required parameters');
    }

    switch (action) {
      case 'index':
        if (!organizedNotes) {
          return errorResponse(400, 'MISSING_NOTES', 'Organized notes are required for indexing');
        }
        await indexOrganizedNotes(userId, capsuleId, videoId, organizedNotes);
        logger.info('Content indexed successfully', { userId, capsuleId });
        return successResponse({
          message: 'Content indexed successfully',
          userId,
          capsuleId,
          timestamp: new Date().toISOString(),
        });

      case 'delete':
        await deleteNotesForCapsule(userId, capsuleId);
        logger.info('Content deleted from index', { userId, capsuleId });
        return successResponse({
          message: 'Content deleted from index',
          userId,
          capsuleId,
          timestamp: new Date().toISOString(),
        });

      case 'update':
        if (!organizedNotes) {
          return errorResponse(400, 'MISSING_NOTES', 'Organized notes are required for updating');
        }
        // Delete old content and index new content
        await deleteNotesForCapsule(userId, capsuleId);
        await indexOrganizedNotes(userId, capsuleId, videoId, organizedNotes);
        logger.info('Content updated in index', { userId, capsuleId });
        return successResponse({
          message: 'Content updated in index',
          userId,
          capsuleId,
          timestamp: new Date().toISOString(),
        });

      default:
        return errorResponse(400, 'INVALID_ACTION', `Invalid action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to process content indexing', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return errorResponse(500, 'INDEXING_FAILED', 'Failed to process content indexing');
  }
}

/**
 * Handle DynamoDB stream events for automatic indexing
 */
async function handleDynamoDBStreamEvent(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Processing DynamoDB stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    try {
      await processStreamRecord(record);
    } catch (error) {
      logger.error('Failed to process stream record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventName: record.eventName,
        dynamodb: record.dynamodb,
      });
      // Continue processing other records even if one fails
    }
  }
}

/**
 * Process individual DynamoDB stream record
 */
async function processStreamRecord(record: DynamoDBRecord): Promise<void> {
  const { eventName, dynamodb } = record;

  if (!dynamodb || !dynamodb.Keys) {
    logger.warn('Invalid stream record - missing keys', { record });
    return;
  }

  // Extract keys from the record
  const pk = dynamodb.Keys.PK?.S;
  const sk = dynamodb.Keys.SK?.S;

  if (!pk || !sk) {
    logger.warn('Invalid stream record - missing PK or SK', { pk, sk });
    return;
  }

  // Only process learning capsule records
  if (!pk.startsWith('USER#') || !sk.startsWith('CAPSULE#')) {
    return;
  }

  const userId = pk.replace('USER#', '');
  const capsuleId = sk.replace('CAPSULE#', '');

  logger.info('Processing capsule stream record', {
    eventName,
    userId,
    capsuleId,
  });

  switch (eventName) {
    case 'INSERT':
    case 'MODIFY':
      // Check if the record has organized notes
      const newImage = dynamodb.NewImage;
      if (newImage?.learningContent?.M?.organizedNotes?.M) {
        const organizedNotes = unmarshallDynamoDBItem(newImage.learningContent.M.organizedNotes.M);
        const videoId = newImage.videoId?.S || '';
        
        try {
          await indexOrganizedNotes(userId, capsuleId, videoId, organizedNotes);
          logger.info('Automatically indexed content from stream', {
            userId,
            capsuleId,
            videoId,
          });
        } catch (error) {
          logger.error('Failed to auto-index content from stream', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            capsuleId,
          });
        }
      }
      break;

    case 'REMOVE':
      try {
        await deleteNotesForCapsule(userId, capsuleId);
        logger.info('Automatically deleted content from index', {
          userId,
          capsuleId,
        });
      } catch (error) {
        logger.error('Failed to auto-delete content from index', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          capsuleId,
        });
      }
      break;

    default:
      logger.debug('Unhandled stream event', { eventName });
  }
}

/**
 * Simple DynamoDB item unmarshalling (basic implementation)
 */
function unmarshallDynamoDBItem(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const result: any = {};
  
  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'object' && value !== null) {
      const typedValue = value as any;
      
      if (typedValue.S !== undefined) {
        result[key] = typedValue.S;
      } else if (typedValue.N !== undefined) {
        result[key] = Number(typedValue.N);
      } else if (typedValue.BOOL !== undefined) {
        result[key] = typedValue.BOOL;
      } else if (typedValue.L !== undefined) {
        result[key] = typedValue.L.map((item: any) => unmarshallDynamoDBItem({ temp: item }).temp);
      } else if (typedValue.M !== undefined) {
        result[key] = unmarshallDynamoDBItem(typedValue.M);
      } else if (typedValue.SS !== undefined) {
        result[key] = typedValue.SS;
      } else if (typedValue.NS !== undefined) {
        result[key] = typedValue.NS.map(Number);
      }
    }
  }
  
  return result;
}

export const handler = createHandler(indexContentHandler);