// Shared Lambda utilities exports

// Types
export * from './types';

// Response utilities
export * from './response';

// Logging
export * from './logger';

// Metrics and monitoring
export * from './metrics';
export * from './monitoring';

// Middleware
export * from './middleware';

// Handler utilities
export * from './handler';

// Re-export commonly used AWS SDK clients
export { DynamoDBClient } from '@aws-sdk/client-dynamodb';
export { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export { S3Client } from '@aws-sdk/client-s3';
export { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

// Re-export validation library
export { z } from 'zod';