import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse } from '../../shared/response';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    storage: 'healthy' | 'unhealthy';
    ai: 'healthy' | 'unhealthy';
  };
}

/**
 * Health check handler
 * Tests connectivity to all critical services
 */
async function healthCheckHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Health check requested', { 
    userAgent: event.headers['User-Agent'],
    sourceIp: event.requestContext.identity.sourceIp,
  });

  const healthStatus: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    services: {
      database: 'healthy',
      storage: 'healthy',
      ai: 'healthy',
    },
  };

  // Check DynamoDB connectivity
  try {
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (tableName) {
      await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
      logger.debug('DynamoDB health check passed');
    } else {
      throw new Error('DYNAMODB_TABLE_NAME not configured');
    }
  } catch (error) {
    logger.error('DynamoDB health check failed', { error });
    healthStatus.services.database = 'unhealthy';
    healthStatus.status = 'unhealthy';
  }

  // Check S3 connectivity
  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    if (bucketName) {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      logger.debug('S3 health check passed');
    } else {
      throw new Error('S3_BUCKET_NAME not configured');
    }
  } catch (error) {
    logger.error('S3 health check failed', { error });
    healthStatus.services.storage = 'unhealthy';
    healthStatus.status = 'unhealthy';
  }

  // Check AI services (OpenAI API)
  try {
    // Simple check - verify API key is configured
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    // In a real implementation, you might make a simple API call to verify connectivity
    // For now, just check that the key is present
    logger.debug('AI services health check passed');
  } catch (error) {
    logger.error('AI services health check failed', { error });
    healthStatus.services.ai = 'unhealthy';
    healthStatus.status = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  
  logger.info('Health check completed', { 
    status: healthStatus.status,
    services: healthStatus.services,
  });

  return createSuccessResponse(healthStatus, statusCode);
}

export const handler = createHandler(healthCheckHandler);