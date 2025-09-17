// Base Lambda handler with middleware support

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { 
  EnhancedAPIGatewayEvent, 
  LambdaHandler, 
  MiddlewareFunction,
  LambdaConfig,
  DEFAULT_LAMBDA_CONFIG 
} from './types';
import {
  initializeContext,
  corsMiddleware,
  methodMiddleware,
  bodyParsingMiddleware,
  authMiddleware,
  validationMiddleware,
  rateLimitMiddleware,
  errorHandlingMiddleware,
  compose,
} from './middleware';
import { errorResponse } from './response';
import { getLogger } from './logger';

export interface HandlerOptions {
  config?: Partial<LambdaConfig>;
  allowedMethods?: string[];
  middleware?: MiddlewareFunction[];
}

// Create a Lambda handler with automatic middleware setup
export const createHandler = (
  handler: LambdaHandler,
  options: HandlerOptions = {}
): ((event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) => {
  const config: LambdaConfig = { ...DEFAULT_LAMBDA_CONFIG, ...options.config };
  const allowedMethods = options.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const customMiddleware = options.middleware || [];

  // Build middleware stack
  const middlewareStack: MiddlewareFunction[] = [
    // Error handling should be first (outermost)
    errorHandlingMiddleware(config),
    
    // Initialize context and logging
    initializeContext(),
    
    // CORS handling
    corsMiddleware(config),
    
    // Method validation
    methodMiddleware(allowedMethods),
    
    // Body parsing
    bodyParsingMiddleware(),
    
    // Rate limiting
    rateLimitMiddleware(config),
    
    // Authentication
    authMiddleware(config),
    
    // Request validation
    validationMiddleware(config),
    
    // Custom middleware
    ...customMiddleware,
  ];

  const composedMiddleware = compose(...middlewareStack);

  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    // Convert to enhanced event
    const enhancedEvent: EnhancedAPIGatewayEvent = {
      ...event,
      body: event.body,
      requestId: context.awsRequestId,
      correlationId: event.headers['x-correlation-id'] || context.awsRequestId,
    };

    try {
      return await composedMiddleware(enhancedEvent, context, async () => {
        return handler(enhancedEvent, context);
      });
    } catch (error) {
      // Fallback error handling if middleware fails
      console.error('Critical error in Lambda handler:', error);
      return errorResponse(error as Error, context.awsRequestId, config);
    }
  };
};

// Utility function to create handlers for specific HTTP methods
export const createGetHandler = (
  handler: LambdaHandler,
  options: Omit<HandlerOptions, 'allowedMethods'> = {}
) => createHandler(handler, { ...options, allowedMethods: ['GET', 'OPTIONS'] });

export const createPostHandler = (
  handler: LambdaHandler,
  options: Omit<HandlerOptions, 'allowedMethods'> = {}
) => createHandler(handler, { ...options, allowedMethods: ['POST', 'OPTIONS'] });

export const createPutHandler = (
  handler: LambdaHandler,
  options: Omit<HandlerOptions, 'allowedMethods'> = {}
) => createHandler(handler, { ...options, allowedMethods: ['PUT', 'OPTIONS'] });

export const createDeleteHandler = (
  handler: LambdaHandler,
  options: Omit<HandlerOptions, 'allowedMethods'> = {}
) => createHandler(handler, { ...options, allowedMethods: ['DELETE', 'OPTIONS'] });

// Utility function to create public handlers (no authentication required)
export const createPublicHandler = (
  handler: LambdaHandler,
  options: HandlerOptions = {}
) => createHandler(handler, {
  ...options,
  config: {
    ...options.config,
    auth: { required: false, allowUnverified: true },
  },
});

// Utility function to create admin handlers (enterprise subscription required)
export const createAdminHandler = (
  handler: LambdaHandler,
  options: HandlerOptions = {}
) => {
  const { subscriptionMiddleware } = require('./middleware');
  
  return createHandler(handler, {
    ...options,
    middleware: [
      subscriptionMiddleware('enterprise'),
      ...(options.middleware || []),
    ],
  });
};

// Health check handler
export const healthCheckHandler = createPublicHandler(
  async (event, context) => {
    const logger = getLogger();
    
    logger.info('Health check requested');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.FUNCTION_VERSION || '1.0.0',
        requestId: event.requestId,
      }),
    };
  },
  {
    config: {
      rateLimit: { enabled: false, requestsPerMinute: 0 },
    },
  }
);

// Metrics collection utility
export const collectMetrics = (
  metricName: string,
  value: number,
  unit: string = 'Count',
  dimensions?: Record<string, string>
) => {
  const logger = getLogger();
  
  logger.info('Custom metric', {
    metricName,
    value,
    unit,
    dimensions,
  });
  
  // In a real implementation, you would send this to CloudWatch
  // using the AWS SDK CloudWatch client
};

// Performance monitoring decorator
export const withPerformanceMonitoring = (
  operationName: string,
  handler: LambdaHandler
): LambdaHandler => {
  return async (event, context) => {
    const startTime = Date.now();
    const logger = getLogger();
    
    try {
      const result = await handler(event, context);
      const duration = Date.now() - startTime;
      
      logger.logPerformance(operationName, duration);
      collectMetrics(`${operationName}.Duration`, duration, 'Milliseconds');
      collectMetrics(`${operationName}.Success`, 1);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`${operationName} failed`, error as Error, { duration });
      collectMetrics(`${operationName}.Duration`, duration, 'Milliseconds');
      collectMetrics(`${operationName}.Error`, 1);
      
      throw error;
    }
  };
};

// Database connection warming utility
export const warmDatabaseConnections = async (): Promise<void> => {
  const logger = getLogger();
  
  try {
    // Import database utilities
    const { checkDatabaseConnection } = await import('../../src/services/database');
    
    const isHealthy = await checkDatabaseConnection();
    if (!isHealthy) {
      logger.warn('Database connection check failed during warming');
    } else {
      logger.debug('Database connections warmed successfully');
    }
  } catch (error) {
    logger.error('Failed to warm database connections', error as Error);
  }
};

// Lambda cold start optimization
export const optimizeForColdStart = (handler: LambdaHandler): LambdaHandler => {
  let isWarm = false;
  
  return async (event, context) => {
    const logger = getLogger();
    
    if (!isWarm) {
      logger.info('Cold start detected, warming up...');
      const warmupStart = Date.now();
      
      // Warm up database connections
      await warmDatabaseConnections();
      
      const warmupDuration = Date.now() - warmupStart;
      logger.logPerformance('ColdStartWarmup', warmupDuration);
      collectMetrics('ColdStart.WarmupDuration', warmupDuration, 'Milliseconds');
      
      isWarm = true;
    }
    
    return handler(event, context);
  };
};