// Sample Lambda function: Get user profile

import { z } from 'zod';
import { createGetHandler, withPerformanceMonitoring } from '../../shared/handler';
import { successResponse, notFoundResponse } from '../../shared/response';
import { getLogger } from '../../shared/logger';
import { getMetricsCollector } from '../../shared/metrics';
import { UserRepository } from '../../../src/services/database';
import { NotFoundError } from '../../../src/types/errors';

// Path parameters validation schema
const pathParamsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// Query parameters validation schema
const queryParamsSchema = z.object({
  includeStats: z.string().optional().transform(val => val === 'true'),
});

// Main handler function
const getUserProfileHandler = withPerformanceMonitoring(
  'GetUserProfile',
  async (event, context) => {
    const logger = getLogger();
    const metrics = getMetricsCollector();
    
    logger.info('Getting user profile', {
      userId: event.pathParameters?.userId,
      requestedBy: event.user?.userId,
    });

    try {
      // Validate path parameters
      const { userId } = pathParamsSchema.parse(event.pathParameters);
      const { includeStats } = queryParamsSchema.parse(event.queryStringParameters);

      // Check if user is requesting their own profile or has admin access
      const isOwnProfile = event.user?.userId === userId;
      const isAdmin = event.user?.subscription === 'enterprise';

      if (!isOwnProfile && !isAdmin) {
        logger.logSecurityEvent('Unauthorized profile access attempt', {
          requestedUserId: userId,
          requestingUserId: event.user?.userId,
        });
        
        metrics.recordError('Unauthorized', 'PROFILE_ACCESS_DENIED', event.user?.userId);
        
        return notFoundResponse('User not found', event.requestId);
      }

      // Get user profile from database
      const startTime = Date.now();
      const user = await UserRepository.getById(userId);
      const dbDuration = Date.now() - startTime;

      metrics.recordDatabaseOperation('GetUser', 'Users', dbDuration, !!user);

      if (!user) {
        logger.warn('User not found', { userId });
        metrics.recordError('NotFound', 'USER_NOT_FOUND');
        return notFoundResponse('User not found', event.requestId);
      }

      // Prepare response data
      let responseData: any = {
        id: user.id,
        email: user.email,
        profile: user.profile,
        subscription: user.subscription,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Include additional stats if requested and authorized
      if (includeStats && (isOwnProfile || isAdmin)) {
        try {
          const statsStartTime = Date.now();
          // This would typically come from a separate analytics service
          const stats = {
            totalStudyTime: 0, // Placeholder
            capsulesCompleted: 0, // Placeholder
            currentStreak: 0, // Placeholder
          };
          const statsDuration = Date.now() - statsStartTime;

          metrics.recordDatabaseOperation('GetUserStats', 'Progress', statsDuration, true);
          
          responseData = {
            ...responseData,
            stats,
          };
        } catch (error) {
          logger.warn('Failed to fetch user stats', error as Error, { userId });
          // Don't fail the entire request if stats fail
        }
      }

      // Record successful operation
      metrics.recordUserAction('ProfileViewed', event.user?.userId);
      
      logger.info('User profile retrieved successfully', {
        userId,
        includeStats,
        responseSize: JSON.stringify(responseData).length,
      });

      return successResponse(responseData, event.requestId);

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid request parameters', { errors: error.errors });
        metrics.recordError('ValidationError', 'INVALID_PARAMETERS');
        throw error; // Will be handled by validation middleware
      }

      if (error instanceof NotFoundError) {
        logger.warn('User not found', { userId: event.pathParameters?.userId });
        metrics.recordError('NotFound', 'USER_NOT_FOUND');
        return notFoundResponse('User not found', event.requestId);
      }

      logger.error('Failed to get user profile', error as Error, {
        userId: event.pathParameters?.userId,
      });
      
      metrics.recordError('InternalError', 'GET_PROFILE_FAILED', event.user?.userId);
      throw error; // Will be handled by error middleware
    }
  }
);

// Export the configured handler
export const handler = createGetHandler(getUserProfileHandler, {
  config: {
    auth: {
      required: true,
      allowUnverified: false,
    },
    validation: {
      pathParams: pathParamsSchema,
      queryParams: queryParamsSchema,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 60, // Allow 60 requests per minute for profile access
    },
  },
});