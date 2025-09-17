// Lambda middleware functions

import { Context } from 'aws-lambda';
import { z } from 'zod';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { 
  EnhancedAPIGatewayEvent, 
  MiddlewareFunction, 
  LambdaConfig,
  ExecutionContext 
} from './types';
import { 
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  forbiddenResponse,
  corsResponse,
  rateLimitResponse,
  methodNotAllowedResponse 
} from './response';
import { initializeLogger, getLogger } from './logger';
import { ValidationError, AuthenticationError, AuthorizationError } from '../../src/types/errors';
import { generateId } from '../../src/utils/helpers';

// JWT Verifier instance (cached)
let jwtVerifier: CognitoJwtVerifier | null = null;

const getJwtVerifier = () => {
  if (!jwtVerifier) {
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
  }
  return jwtVerifier;
};

// Initialize execution context and logger
export const initializeContext = (): MiddlewareFunction => {
  return async (event, context, next) => {
    // Generate correlation ID if not present
    const correlationId = event.headers['x-correlation-id'] || generateId();
    
    // Create execution context
    const executionContext: ExecutionContext = {
      requestId: context.awsRequestId,
      correlationId,
      userId: event.user?.userId,
      startTime: Date.now(),
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      memoryLimit: context.memoryLimitInMB.toString(),
      remainingTime: context.getRemainingTimeInMillis(),
    };

    // Initialize logger
    initializeLogger(executionContext);
    const logger = getLogger();

    // Add context to event
    event.requestId = context.awsRequestId;
    event.correlationId = correlationId;

    logger.logRequest(event.httpMethod, event.path, {
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext.identity.sourceIp,
      userId: event.user?.userId,
    });

    const startTime = Date.now();
    
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      
      logger.logResponse(result.statusCode, duration, {
        responseSize: result.body.length,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Request failed', error as Error, { duration });
      throw error;
    }
  };
};

// CORS middleware
export const corsMiddleware = (config: LambdaConfig): MiddlewareFunction => {
  return async (event, context, next) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse(config);
    }

    // Continue with request and add CORS headers to response
    const result = await next();
    
    // CORS headers are already added in response helpers
    return result;
  };
};

// Method validation middleware
export const methodMiddleware = (allowedMethods: string[]): MiddlewareFunction => {
  return async (event, context, next) => {
    if (!allowedMethods.includes(event.httpMethod)) {
      return methodNotAllowedResponse(allowedMethods, event.requestId);
    }
    
    return next();
  };
};

// Body parsing middleware
export const bodyParsingMiddleware = (): MiddlewareFunction => {
  return async (event, context, next) => {
    const logger = getLogger();
    
    try {
      if (event.body && typeof event.body === 'string') {
        // Parse JSON body
        if (event.headers['Content-Type']?.includes('application/json')) {
          event.body = JSON.parse(event.body);
        }
        // Handle form data if needed
        else if (event.headers['Content-Type']?.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(event.body);
          const formData: Record<string, string> = {};
          for (const [key, value] of params.entries()) {
            formData[key] = value;
          }
          event.body = formData;
        }
      } else if (!event.body) {
        event.body = {};
      }
    } catch (error) {
      logger.error('Failed to parse request body', error as Error);
      return errorResponse(
        new ValidationError('Invalid JSON in request body'),
        event.requestId
      );
    }

    return next();
  };
};

// Authentication middleware
export const authMiddleware = (config: LambdaConfig): MiddlewareFunction => {
  return async (event, context, next) => {
    const logger = getLogger();
    
    // Skip authentication if not required
    if (!config.auth.required) {
      return next();
    }

    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.logSecurityEvent('Missing or invalid authorization header');
      return unauthorizedResponse('Authorization header required', event.requestId);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const verifier = getJwtVerifier();
      const payload = await verifier.verify(token);
      
      // Extract user information from JWT payload
      event.user = {
        userId: payload.sub!,
        email: payload.email as string,
        subscription: (payload['custom:subscription'] as 'free' | 'premium' | 'enterprise') || 'free',
        emailVerified: payload.email_verified as boolean,
      };

      // Check if email verification is required
      if (!config.auth.allowUnverified && !event.user.emailVerified) {
        logger.logSecurityEvent('Unverified email access attempt', { userId: event.user.userId });
        return forbiddenResponse('Email verification required', event.requestId);
      }

      logger.debug('User authenticated successfully', { 
        userId: event.user.userId,
        email: event.user.email,
      });

    } catch (error) {
      logger.logSecurityEvent('JWT verification failed', { error: (error as Error).message });
      return unauthorizedResponse('Invalid or expired token', event.requestId);
    }

    return next();
  };
};

// Request validation middleware
export const validationMiddleware = (config: LambdaConfig): MiddlewareFunction => {
  return async (event, context, next) => {
    const logger = getLogger();
    const errors: Array<{ field: string; message: string }> = [];

    try {
      // Validate request body
      if (config.validation.body) {
        try {
          (config.validation.body as z.ZodSchema).parse(event.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })));
          }
        }
      }

      // Validate query parameters
      if (config.validation.queryParams) {
        try {
          (config.validation.queryParams as z.ZodSchema).parse(event.queryStringParameters || {});
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(err => ({
              field: `query.${err.path.join('.')}`,
              message: err.message,
            })));
          }
        }
      }

      // Validate path parameters
      if (config.validation.pathParams) {
        try {
          (config.validation.pathParams as z.ZodSchema).parse(event.pathParameters || {});
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(err => ({
              field: `path.${err.path.join('.')}`,
              message: err.message,
            })));
          }
        }
      }

      if (errors.length > 0) {
        logger.warn('Request validation failed', { errors });
        return validationErrorResponse(errors, event.requestId);
      }

    } catch (error) {
      logger.error('Validation middleware error', error as Error);
      return errorResponse(
        new ValidationError('Validation error'),
        event.requestId
      );
    }

    return next();
  };
};

// Rate limiting middleware (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (config: LambdaConfig): MiddlewareFunction => {
  return async (event, context, next) => {
    if (!config.rateLimit.enabled) {
      return next();
    }

    const logger = getLogger();
    const identifier = event.user?.userId || event.requestContext.identity.sourceIp;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    const key = `${identifier}:${Math.floor(now / windowMs)}`;
    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
    
    // Clean up old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
    
    if (current.count >= config.rateLimit.requestsPerMinute) {
      logger.logSecurityEvent('Rate limit exceeded', { 
        identifier,
        count: current.count,
        limit: config.rateLimit.requestsPerMinute,
      });
      return rateLimitResponse(event.requestId);
    }
    
    current.count++;
    rateLimitStore.set(key, current);
    
    return next();
  };
};

// Error handling middleware (should be the outermost middleware)
export const errorHandlingMiddleware = (config: LambdaConfig): MiddlewareFunction => {
  return async (event, context, next) => {
    const logger = getLogger();
    
    try {
      return await next();
    } catch (error) {
      logger.error('Unhandled error in Lambda execution', error as Error);
      
      // Return appropriate error response
      return errorResponse(error as Error, event.requestId, config);
    }
  };
};

// Subscription tier validation middleware
export const subscriptionMiddleware = (
  requiredTier: 'free' | 'premium' | 'enterprise'
): MiddlewareFunction => {
  return async (event, context, next) => {
    const logger = getLogger();
    
    if (!event.user) {
      return unauthorizedResponse('Authentication required', event.requestId);
    }

    const tierLevels = { free: 0, premium: 1, enterprise: 2 };
    const userLevel = tierLevels[event.user.subscription];
    const requiredLevel = tierLevels[requiredTier];

    if (userLevel < requiredLevel) {
      logger.logSecurityEvent('Insufficient subscription tier', {
        userId: event.user.userId,
        userTier: event.user.subscription,
        requiredTier,
      });
      return forbiddenResponse(
        `${requiredTier} subscription required`,
        event.requestId
      );
    }

    return next();
  };
};

// Middleware composer utility
export const compose = (...middlewares: MiddlewareFunction[]): MiddlewareFunction => {
  return async (event, context, next) => {
    let index = 0;

    const dispatch = async (): Promise<any> => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      return middleware(event, context, dispatch);
    };

    return dispatch();
  };
};