import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { successResponse, errorResponse } from '../../shared/response';
import { initializeNotesIndex, healthCheck } from '../../services/elasticsearch-notes';

const logger = new Logger('setup-search-infrastructure');

interface SetupRequest {
  action: 'initialize' | 'health-check' | 'reindex';
  force?: boolean;
}

/**
 * Lambda function to set up and manage search infrastructure
 */
async function setupSearchInfrastructureHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const requestBody: SetupRequest = JSON.parse(event.body || '{}');
    const { action, force = false } = requestBody;

    logger.info('Setting up search infrastructure', { action, force });

    switch (action) {
      case 'initialize':
        await initializeNotesIndex();
        logger.info('Search infrastructure initialized successfully');
        return successResponse({
          message: 'Search infrastructure initialized successfully',
          timestamp: new Date().toISOString(),
        });

      case 'health-check':
        const health = await healthCheck();
        logger.info('Search infrastructure health check completed', { health });
        return successResponse({
          message: 'Health check completed',
          health,
          timestamp: new Date().toISOString(),
        });

      case 'reindex':
        // This would trigger a full reindex of all content
        logger.info('Reindexing all content (not implemented yet)');
        return successResponse({
          message: 'Reindexing initiated (placeholder)',
          timestamp: new Date().toISOString(),
        });

      default:
        return errorResponse(400, 'INVALID_ACTION', `Invalid action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to set up search infrastructure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return errorResponse(500, 'SETUP_FAILED', 'Failed to set up search infrastructure');
  }
}

export const handler = createHandler(setupSearchInfrastructureHandler);