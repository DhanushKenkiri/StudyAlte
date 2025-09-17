// Lambda response utilities

import { APIGatewayProxyResult } from 'aws-lambda';
import { 
  LambdaResponse, 
  ErrorResponse, 
  SuccessResponse, 
  PaginatedResponse,
  LambdaConfig,
  DEFAULT_LAMBDA_CONFIG 
} from './types';
import { AppError } from '../../src/types/errors';

export class ResponseBuilder {
  private statusCode: number = 200;
  private headers: Record<string, string> = {};
  private body: unknown = {};
  private config: LambdaConfig;

  constructor(config: Partial<LambdaConfig> = {}) {
    this.config = { ...DEFAULT_LAMBDA_CONFIG, ...config };
    this.setCorsHeaders();
  }

  private setCorsHeaders(): this {
    this.headers = {
      ...this.headers,
      'Access-Control-Allow-Origin': this.config.cors.allowOrigin,
      'Access-Control-Allow-Methods': this.config.cors.allowMethods,
      'Access-Control-Allow-Headers': this.config.cors.allowHeaders,
      'Access-Control-Max-Age': this.config.cors.maxAge.toString(),
      'Content-Type': 'application/json',
    };
    return this;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  header(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  json(data: unknown): this {
    this.body = data;
    return this;
  }

  build(): APIGatewayProxyResult {
    return {
      statusCode: this.statusCode,
      headers: this.headers,
      body: JSON.stringify(this.body),
      isBase64Encoded: false,
    };
  }
}

// Success response helpers
export const successResponse = <T>(
  data: T,
  requestId: string,
  statusCode: number = 200,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  };

  return new ResponseBuilder(config)
    .status(statusCode)
    .json(response)
    .build();
};

export const paginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: PaginatedResponse<T> = {
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  return new ResponseBuilder(config)
    .status(200)
    .json(response)
    .build();
};

// Error response helpers
export const errorResponse = (
  error: AppError | Error,
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.metadata;
  } else {
    message = error.message || message;
  }

  const response: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(statusCode)
    .json(response)
    .build();
};

// Validation error response
export const validationErrorResponse = (
  errors: Array<{ field: string; message: string }>,
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { errors },
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(400)
    .json(response)
    .build();
};

// CORS preflight response
export const corsResponse = (
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  return new ResponseBuilder(config)
    .status(200)
    .json({ message: 'CORS preflight successful' })
    .build();
};

// Not found response
export const notFoundResponse = (
  resource: string,
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `${resource} not found`,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(404)
    .json(response)
    .build();
};

// Unauthorized response
export const unauthorizedResponse = (
  message: string = 'Authentication required',
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'UNAUTHORIZED',
      message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(401)
    .json(response)
    .build();
};

// Forbidden response
export const forbiddenResponse = (
  message: string = 'Insufficient permissions',
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'FORBIDDEN',
      message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(403)
    .json(response)
    .build();
};

// Rate limit exceeded response
export const rateLimitResponse = (
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(429)
    .header('Retry-After', '60')
    .json(response)
    .build();
};

// Method not allowed response
export const methodNotAllowedResponse = (
  allowedMethods: string[],
  requestId: string,
  config?: Partial<LambdaConfig>
): APIGatewayProxyResult => {
  const response: ErrorResponse = {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return new ResponseBuilder(config)
    .status(405)
    .header('Allow', allowedMethods.join(', '))
    .json(response)
    .build();
};