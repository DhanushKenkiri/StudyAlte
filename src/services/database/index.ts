// Database service exports

// Client and utilities
export { 
  docClient, 
  DynamoDBOperations, 
  ConditionBuilder, 
  UpdateBuilder,
  generateTTL,
  TABLE_NAME 
} from './client';

export { checkDatabaseConnection } from './client';

// Schema and transformers
export {
  KeyGenerator,
  DataTransformer,
  validateDynamoItem,
  validateAndTransformItem,
  type DynamoDBItem,
  userItemSchema,
  capsuleItemSchema,
  progressItemSchema,
  dailyStatsItemSchema,
  goalItemSchema,
  achievementItemSchema,
  studySessionItemSchema,
  activityItemSchema,
  processingJobItemSchema,
} from './schema';

// Repositories
export { UserRepository } from './repositories/UserRepository';
export { CapsuleRepository } from './repositories/CapsuleRepository';

// Repository types
export type { GetCapsulesOptions, SearchCapsulesOptions } from './repositories/CapsuleRepository';

// Database initialization and health check
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    const isHealthy = await checkDatabaseConnection();
    if (!isHealthy) {
      console.error('Database connection failed during initialization');
      return false;
    }

    console.log('Database connection established successfully');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
};

// Database configuration
export const DATABASE_CONFIG = {
  tableName: TABLE_NAME,
  region: process.env.AWS_REGION || 'us-east-1',
  maxRetries: 3,
  timeout: 30000,
} as const;