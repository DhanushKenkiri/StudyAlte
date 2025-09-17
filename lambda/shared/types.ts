// Shared types for Lambda functions

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Enhanced API Gateway event with parsed body and user context
export interface EnhancedAPIGatewayEvent extends Omit<APIGatewayProxyEvent, 'body'> {
  body: unknown;
  user?: {
    userId: string;
    email: string;
    subscription: 'free' | 'premium' | 'enterprise';
    emailVerified: boolean;
  };
  requestId: string;
  correlationId: string;
}

// Lambda handler type with enhanced event
export type LambdaHandler = (
  event: EnhancedAPIGatewayEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

// Middleware function type
export type MiddlewareFunction = (
  event: EnhancedAPIGatewayEvent,
  context: Context,
  next: () => Promise<APIGatewayProxyResult>
) => Promise<APIGatewayProxyResult>;

// Lambda response helpers
export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

// Error response structure
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

// Success response structure
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

// Pagination response structure
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  requestId: string;
  timestamp: string;
}

// Lambda configuration
export interface LambdaConfig {
  cors: {
    allowOrigin: string;
    allowMethods: string;
    allowHeaders: string;
    maxAge: number;
  };
  auth: {
    required: boolean;
    allowUnverified: boolean;
  };
  validation: {
    body?: unknown; // Zod schema
    queryParams?: unknown; // Zod schema
    pathParams?: unknown; // Zod schema
  };
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
  };
}

// Default Lambda configuration
export const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  cors: {
    allowOrigin: '*',
    allowMethods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowHeaders: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    maxAge: 86400,
  },
  auth: {
    required: true,
    allowUnverified: false,
  },
  validation: {},
  rateLimit: {
    enabled: true,
    requestsPerMinute: 100,
  },
};

// Lambda environment variables
export interface LambdaEnvironment {
  NODE_ENV: string;
  AWS_REGION: string;
  DYNAMODB_TABLE_NAME: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  YOUTUBE_API_KEY: string;
  // AWS Bedrock is used instead of OpenAI for all AI services
  AWS_REGION: string;
  S3_BUCKET_NAME: string;
  LOG_LEVEL: string;
}

// Logging levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Structured log entry
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId: string;
  correlationId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Metrics data
export interface MetricData {
  name: string;
  value: number;
  unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'Percent';
  dimensions?: Record<string, string>;
  timestamp: Date;
}

// Lambda execution context
export interface ExecutionContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  startTime: number;
  functionName: string;
  functionVersion: string;
  memoryLimit: string;
  remainingTime: number;
}