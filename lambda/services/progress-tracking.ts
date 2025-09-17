import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../shared/logger';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface ProgressEvent {
  id: string;
  userId: string;
  capsuleId: string;
  eventType: ProgressEventType;
  timestamp: string;
  sessionId: string;
  data: Record<string, any>;
  duration?: number; // milliseconds
  completionPercentage?: number;
  metadata?: {
    deviceType?: string;
    userAgent?: string;
    location?: string;
  };
}

export type ProgressEventType = 
  | 'session_start'
  | 'session_end'
  | 'flashcard_viewed'
  | 'flashcard_answered'
  | 'quiz_started'
  | 'quiz_question_answered'
  | 'quiz_completed'
  | 'transcript_viewed'
  | 'transcript_section_studied'
  | 'mindmap_viewed'
  | 'mindmap_node_explored'
  | 'notes_created'
  | 'notes_edited'
  | 'summary_viewed'
  | 'video_segment_watched'
  | 'bookmark_created'
  | 'tag_added'
  | 'content_exported'
  | 'ai_tutor_question'
  | 'search_performed'
  | 'capsule_completed';

export interface StudySession {
  id: string;
  userId: string;
  capsuleId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // milliseconds
  activitiesCompleted: number;
  progressMade: number; // percentage points gained
  focusTime: number; // time actively engaged
  breakTime: number; // time idle/away
  deviceType: string;
  sessionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  learningEfficiency: number; // 0-1 score
}

export interface LearningProgress {
  userId: string;
  capsuleId: string;
  totalTimeSpent: number; // milliseconds
  completionPercentage: number; // 0-100
  lastStudied: string;
  sessionsCount: number;
  activitiesCompleted: {
    transcript: boolean;
    summary: boolean;
    flashcards: {
      completed: number;
      total: number;
      masteryLevel: number; // 0-1
    };
    quiz: {
      completed: boolean;
      score: number; // 0-100
      attempts: number;
    };
    mindmap: {
      nodesExplored: number;
      totalNodes: number;
    };
    notes: {
      created: number;
      edited: number;
    };
  };
  streakDays: number;
  achievements: string[];
  performanceMetrics: {
    averageSessionDuration: number;
    focusTime: number;
    retentionRate: number;
    efficiencyScore: number;
  };
}

export interface ProgressAnalytics {
  userId: string;
  timeframe: 'day' | 'week' | 'month' | 'year' | 'all';
  startDate: string;
  endDate: string;
  totalStudyTime: number;
  totalSessions: number;
  capsulesStudied: number;
  capsulesCompleted: number;
  averageSessionDuration: number;
  longestStreak: number;
  currentStreak: number;
  learningVelocity: number; // capsules per week
  skillsAcquired: string[];
  topSubjects: Array<{ subject: string; timeSpent: number; mastery: number }>;
  weakAreas: Array<{ subject: string; score: number; recommendation: string }>;
  performanceTrends: {
    studyTime: Array<{ date: string; minutes: number }>;
    completion: Array<{ date: string; percentage: number }>;
    efficiency: Array<{ date: string; score: number }>;
  };
  goals: {
    daily: { target: number; achieved: number };
    weekly: { target: number; achieved: number };
    monthly: { target: number; achieved: number };
  };
}

/**
 * Track a progress event
 */
export async function trackProgressEvent(event: Omit<ProgressEvent, 'id' | 'timestamp'>): Promise<void> {
  try {
    const progressEvent: ProgressEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };

    logger.info('Tracking progress event', {
      userId: event.userId,
      capsuleId: event.capsuleId,
      eventType: event.eventType,
      sessionId: event.sessionId,
    });

    // Store the event
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Item: {
        PK: `USER#${event.userId}`,
        SK: `PROGRESS_EVENT#${progressEvent.id}`,
        GSI1PK: `CAPSULE#${event.capsuleId}`,
        GSI1SK: `EVENT#${progressEvent.timestamp}`,
        GSI2PK: `USER#${event.userId}#EVENTS`,
        GSI2SK: progressEvent.timestamp,
        ...progressEvent,
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
      },
    }));

    // Update aggregated progress data
    await updateProgressAggregates(event.userId, event.capsuleId, progressEvent);

    logger.info('Progress event tracked successfully', {
      eventId: progressEvent.id,
      userId: event.userId,
      eventType: event.eventType,
    });
  } catch (error) {
    logger.error('Failed to track progress event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: event.userId,
      eventType: event.eventType,
    });
    throw error;
  }
}

/**
 * Start a new study session
 */
export async function startStudySession(
  userId: string,
  capsuleId: string,
  deviceType: string = 'unknown'
): Promise<StudySession> {
  try {
    const session: StudySession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      capsuleId,
      startTime: new Date().toISOString(),
      activitiesCompleted: 0,
      progressMade: 0,
      focusTime: 0,
      breakTime: 0,
      deviceType,
      sessionQuality: 'fair',
      learningEfficiency: 0,
    };

    logger.info('Starting study session', {
      sessionId: session.id,
      userId,
      capsuleId,
      deviceType,
    });

    // Store the session
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Item: {
        PK: `USER#${userId}`,
        SK: `STUDY_SESSION#${session.id}`,
        GSI1PK: `CAPSULE#${capsuleId}`,
        GSI1SK: `SESSION#${session.startTime}`,
        ...session,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
      },
    }));

    // Track session start event
    await trackProgressEvent({
      userId,
      capsuleId,
      eventType: 'session_start',
      sessionId: session.id,
      data: { deviceType },
    });

    return session;
  } catch (error) {
    logger.error('Failed to start study session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });
    throw error;
  }
}

/**
 * End a study session
 */
export async function endStudySession(
  userId: string,
  sessionId: string,
  metrics: {
    activitiesCompleted: number;
    focusTime: number;
    breakTime: number;
  }
): Promise<StudySession> {
  try {
    const endTime = new Date().toISOString();

    logger.info('Ending study session', {
      sessionId,
      userId,
      metrics,
    });

    // Get the session
    const sessionResult = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `STUDY_SESSION#${sessionId}`,
      },
    }));

    if (!sessionResult.Item) {
      throw new Error(`Study session not found: ${sessionId}`);
    }

    const session = sessionResult.Item as StudySession;
    const startTime = new Date(session.startTime);
    const duration = new Date(endTime).getTime() - startTime.getTime();
    
    // Calculate session quality and efficiency
    const sessionQuality = calculateSessionQuality(duration, metrics.focusTime, metrics.activitiesCompleted);
    const learningEfficiency = calculateLearningEfficiency(duration, metrics.focusTime, metrics.activitiesCompleted);

    const updatedSession: StudySession = {
      ...session,
      endTime,
      duration,
      activitiesCompleted: metrics.activitiesCompleted,
      focusTime: metrics.focusTime,
      breakTime: metrics.breakTime,
      sessionQuality,
      learningEfficiency,
    };

    // Update the session
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `STUDY_SESSION#${sessionId}`,
      },
      UpdateExpression: `
        SET 
          endTime = :endTime,
          duration = :duration,
          activitiesCompleted = :activitiesCompleted,
          focusTime = :focusTime,
          breakTime = :breakTime,
          sessionQuality = :sessionQuality,
          learningEfficiency = :learningEfficiency
      `,
      ExpressionAttributeValues: {
        ':endTime': endTime,
        ':duration': duration,
        ':activitiesCompleted': metrics.activitiesCompleted,
        ':focusTime': metrics.focusTime,
        ':breakTime': metrics.breakTime,
        ':sessionQuality': sessionQuality,
        ':learningEfficiency': learningEfficiency,
      },
    }));

    // Track session end event
    await trackProgressEvent({
      userId,
      capsuleId: session.capsuleId,
      eventType: 'session_end',
      sessionId,
      duration,
      data: {
        activitiesCompleted: metrics.activitiesCompleted,
        sessionQuality,
        learningEfficiency,
      },
    });

    logger.info('Study session ended successfully', {
      sessionId,
      duration,
      sessionQuality,
      learningEfficiency,
    });

    return updatedSession;
  } catch (error) {
    logger.error('Failed to end study session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      sessionId,
    });
    throw error;
  }
}

/**
 * Get learning progress for a capsule
 */
export async function getLearningProgress(userId: string, capsuleId: string): Promise<LearningProgress> {
  try {
    // Get existing progress
    const progressResult = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `PROGRESS#${capsuleId}`,
      },
    }));

    if (progressResult.Item) {
      return progressResult.Item as LearningProgress;
    }

    // Initialize new progress if not exists
    const newProgress: LearningProgress = {
      userId,
      capsuleId,
      totalTimeSpent: 0,
      completionPercentage: 0,
      lastStudied: new Date().toISOString(),
      sessionsCount: 0,
      activitiesCompleted: {
        transcript: false,
        summary: false,
        flashcards: {
          completed: 0,
          total: 0,
          masteryLevel: 0,
        },
        quiz: {
          completed: false,
          score: 0,
          attempts: 0,
        },
        mindmap: {
          nodesExplored: 0,
          totalNodes: 0,
        },
        notes: {
          created: 0,
          edited: 0,
        },
      },
      streakDays: 0,
      achievements: [],
      performanceMetrics: {
        averageSessionDuration: 0,
        focusTime: 0,
        retentionRate: 0,
        efficiencyScore: 0,
      },
    };

    // Store the new progress
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Item: {
        PK: `USER#${userId}`,
        SK: `PROGRESS#${capsuleId}`,
        GSI1PK: `USER#${userId}#PROGRESS`,
        GSI1SK: newProgress.lastStudied,
        ...newProgress,
      },
    }));

    return newProgress;
  } catch (error) {
    logger.error('Failed to get learning progress', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });
    throw error;
  }
}

/**
 * Update aggregated progress data
 */
async function updateProgressAggregates(userId: string, capsuleId: string, event: ProgressEvent): Promise<void> {
  try {
    const progress = await getLearningProgress(userId, capsuleId);
    
    // Update based on event type
    let updates: Partial<LearningProgress> = {
      lastStudied: event.timestamp,
    };

    switch (event.eventType) {
      case 'session_start':
        updates.sessionsCount = progress.sessionsCount + 1;
        break;
      
      case 'session_end':
        if (event.duration) {
          updates.totalTimeSpent = progress.totalTimeSpent + event.duration;
        }
        break;
      
      case 'flashcard_answered':
        if (event.data.correct) {
          updates.activitiesCompleted = {
            ...progress.activitiesCompleted,
            flashcards: {
              ...progress.activitiesCompleted.flashcards,
              completed: progress.activitiesCompleted.flashcards.completed + 1,
            },
          };
        }
        break;
      
      case 'quiz_completed':
        updates.activitiesCompleted = {
          ...progress.activitiesCompleted,
          quiz: {
            completed: true,
            score: event.data.score || 0,
            attempts: progress.activitiesCompleted.quiz.attempts + 1,
          },
        };
        break;
      
      case 'transcript_viewed':
        updates.activitiesCompleted = {
          ...progress.activitiesCompleted,
          transcript: true,
        };
        break;
      
      case 'summary_viewed':
        updates.activitiesCompleted = {
          ...progress.activitiesCompleted,
          summary: true,
        };
        break;
    }

    // Calculate new completion percentage
    updates.completionPercentage = calculateCompletionPercentage({
      ...progress,
      ...updates,
    });

    // Update the progress record
    const updateExpression = Object.keys(updates)
      .map(key => `${key} = :${key}`)
      .join(', ');
    
    const expressionAttributeValues = Object.entries(updates).reduce((acc, [key, value]) => {
      acc[`:${key}`] = value;
      return acc;
    }, {} as Record<string, any>);

    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `PROGRESS#${capsuleId}`,
      },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
  } catch (error) {
    logger.error('Failed to update progress aggregates', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      eventType: event.eventType,
    });
  }
}

/**
 * Calculate session quality based on metrics
 */
function calculateSessionQuality(
  duration: number,
  focusTime: number,
  activitiesCompleted: number
): StudySession['sessionQuality'] {
  const focusRatio = focusTime / duration;
  const activityDensity = activitiesCompleted / (duration / (60 * 1000)); // activities per minute
  
  const qualityScore = (focusRatio * 0.6) + (Math.min(activityDensity, 1) * 0.4);
  
  if (qualityScore >= 0.8) return 'excellent';
  if (qualityScore >= 0.6) return 'good';
  if (qualityScore >= 0.4) return 'fair';
  return 'poor';
}

/**
 * Calculate learning efficiency
 */
function calculateLearningEfficiency(
  duration: number,
  focusTime: number,
  activitiesCompleted: number
): number {
  const focusRatio = focusTime / duration;
  const activityRate = activitiesCompleted / (duration / (60 * 1000));
  const baseEfficiency = focusRatio * Math.min(activityRate, 1);
  
  return Math.min(baseEfficiency, 1);
}

/**
 * Calculate completion percentage
 */
function calculateCompletionPercentage(progress: LearningProgress): number {
  const weights = {
    transcript: 20,
    summary: 20,
    flashcards: 30,
    quiz: 20,
    mindmap: 10,
  };
  
  let totalWeight = 0;
  let completedWeight = 0;
  
  if (progress.activitiesCompleted.transcript) {
    completedWeight += weights.transcript;
  }
  totalWeight += weights.transcript;
  
  if (progress.activitiesCompleted.summary) {
    completedWeight += weights.summary;
  }
  totalWeight += weights.summary;
  
  if (progress.activitiesCompleted.flashcards.total > 0) {
    const flashcardCompletion = progress.activitiesCompleted.flashcards.completed / 
                               progress.activitiesCompleted.flashcards.total;
    completedWeight += weights.flashcards * flashcardCompletion;
  }
  totalWeight += weights.flashcards;
  
  if (progress.activitiesCompleted.quiz.completed) {
    completedWeight += weights.quiz;
  }
  totalWeight += weights.quiz;
  
  if (progress.activitiesCompleted.mindmap.totalNodes > 0) {
    const mindmapCompletion = progress.activitiesCompleted.mindmap.nodesExplored / 
                             progress.activitiesCompleted.mindmap.totalNodes;
    completedWeight += weights.mindmap * mindmapCompletion;
  }
  totalWeight += weights.mindmap;
  
  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}
