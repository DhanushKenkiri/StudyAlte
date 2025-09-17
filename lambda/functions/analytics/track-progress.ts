import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import {
  trackProgressEvent,
  startStudySession,
  endStudySession,
  getLearningProgress,
  ProgressEvent,
  StudySession,
  LearningProgress,
  ProgressEventType,
} from '../../services/progress-tracking';

interface ProgressRequest {
  userId: string;
  action: 'track_event' | 'start_session' | 'end_session' | 'get_progress';
  capsuleId?: string;
  sessionId?: string;
  
  // For track_event
  eventType?: ProgressEventType;
  eventData?: Record<string, any>;
  duration?: number;
  completionPercentage?: number;
  metadata?: {
    deviceType?: string;
    userAgent?: string;
    location?: string;
  };
  
  // For start_session
  deviceType?: string;
  
  // For end_session
  sessionMetrics?: {
    activitiesCompleted: number;
    focusTime: number;
    breakTime: number;
  };
}

/**
 * Handle progress tracking requests
 */
async function progressTrackingHandler(event: ProgressRequest) {
  const { userId, action } = event;

  try {
    logger.info('Processing progress tracking request', {
      userId,
      action,
      capsuleId: event.capsuleId,
    });

    switch (action) {
      case 'track_event':
        return await handleTrackEvent(event);
      
      case 'start_session':
        return await handleStartSession(event);
      
      case 'end_session':
        return await handleEndSession(event);
      
      case 'get_progress':
        return await handleGetProgress(event);
      
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to process progress tracking request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Handle tracking a progress event
 */
async function handleTrackEvent(event: ProgressRequest) {
  const {
    userId,
    capsuleId,
    eventType,
    eventData = {},
    duration,
    completionPercentage,
    metadata,
  } = event;

  if (!capsuleId || !eventType) {
    throw new Error('Capsule ID and event type are required for tracking events');
  }

  // Generate session ID if not provided (for standalone events)
  const sessionId = `standalone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const progressEvent: Omit<ProgressEvent, 'id' | 'timestamp'> = {
    userId,
    capsuleId,
    eventType,
    sessionId,
    data: eventData,
    duration,
    completionPercentage,
    metadata,
  };

  await trackProgressEvent(progressEvent);

  logger.info('Progress event tracked successfully', {
    userId,
    capsuleId,
    eventType,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: 'Progress event tracked successfully',
      eventType,
    },
  };
}

/**
 * Handle starting a study session
 */
async function handleStartSession(event: ProgressRequest) {
  const { userId, capsuleId, deviceType = 'unknown' } = event;

  if (!capsuleId) {
    throw new Error('Capsule ID is required for starting a study session');
  }

  const session = await startStudySession(userId, capsuleId, deviceType);

  logger.info('Study session started successfully', {
    sessionId: session.id,
    userId,
    capsuleId,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      session,
    },
  };
}

/**
 * Handle ending a study session
 */
async function handleEndSession(event: ProgressRequest) {
  const { userId, sessionId, sessionMetrics } = event;

  if (!sessionId || !sessionMetrics) {
    throw new Error('Session ID and metrics are required for ending a study session');
  }

  const session = await endStudySession(userId, sessionId, sessionMetrics);

  logger.info('Study session ended successfully', {
    sessionId,
    userId,
    duration: session.duration,
    sessionQuality: session.sessionQuality,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      session,
    },
  };
}

/**
 * Handle getting learning progress
 */
async function handleGetProgress(event: ProgressRequest) {
  const { userId, capsuleId } = event;

  if (!capsuleId) {
    throw new Error('Capsule ID is required for getting progress');
  }

  const progress = await getLearningProgress(userId, capsuleId);

  logger.info('Learning progress retrieved successfully', {
    userId,
    capsuleId,
    completionPercentage: progress.completionPercentage,
    totalTimeSpent: progress.totalTimeSpent,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      progress,
    },
  };
}

// Export handler
export const handler = createHandler(progressTrackingHandler);
