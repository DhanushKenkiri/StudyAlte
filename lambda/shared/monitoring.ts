// CloudWatch monitoring and alerting utilities

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { getLogger } from './logger';
import { getMetricsCollector } from './metrics';

// Custom CloudWatch dashboard configuration
export interface DashboardConfig {
  name: string;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  type: 'metric' | 'log' | 'number';
  title: string;
  metrics: string[];
  period: number;
  stat: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'SampleCount';
  region: string;
}

// Alarm configuration
export interface AlarmConfig {
  name: string;
  description: string;
  metricName: string;
  namespace: string;
  statistic: string;
  period: number;
  evaluationPeriods: number;
  threshold: number;
  comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
  treatMissingData: 'breaching' | 'notBreaching' | 'ignore' | 'missing';
  dimensions?: Record<string, string>;
}

export class MonitoringService {
  private functionName: string;
  private environment: string;

  constructor() {
    this.functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown';
    this.environment = process.env.NODE_ENV || 'development';
  }

  // Record Lambda-specific metrics
  recordLambdaMetrics(context: any): void {
    const metrics = getMetricsCollector();
    const logger = getLogger();

    try {
      // Memory usage
      const memoryUsed = process.memoryUsage();
      metrics.addMetric('MemoryUsedMB', memoryUsed.heapUsed / 1024 / 1024, 'Count');
      metrics.addMetric('MemoryTotalMB', memoryUsed.heapTotal / 1024 / 1024, 'Count');

      // Remaining execution time
      const remainingTime = context.getRemainingTimeInMillis();
      metrics.addMetric('RemainingTimeMS', remainingTime, 'Milliseconds');

      // Function version and environment
      metrics.addMetric('FunctionInvocation', 1, 'Count', {
        FunctionName: this.functionName,
        Environment: this.environment,
        Version: context.functionVersion,
      });

      logger.debug('Lambda metrics recorded', {
        memoryUsedMB: memoryUsed.heapUsed / 1024 / 1024,
        remainingTimeMS: remainingTime,
      });

    } catch (error) {
      logger.error('Failed to record Lambda metrics', error as Error);
    }
  }

  // Record custom business metrics
  recordBusinessMetrics(eventType: string, data: Record<string, any>): void {
    const metrics = getMetricsCollector();
    const logger = getLogger();

    try {
      switch (eventType) {
        case 'user_registration':
          metrics.incrementCounter('UserRegistration', {
            SubscriptionTier: data.subscriptionTier || 'free',
          });
          break;

        case 'video_processed':
          metrics.incrementCounter('VideoProcessed', {
            ProcessingStatus: data.status,
            VideoDuration: this.getDurationBucket(data.duration),
          });
          if (data.processingTime) {
            metrics.recordDuration('VideoProcessingTime', data.processingTime);
          }
          break;

        case 'flashcard_reviewed':
          metrics.incrementCounter('FlashcardReviewed', {
            Difficulty: data.difficulty?.toString() || 'unknown',
            Correct: data.correct?.toString() || 'unknown',
          });
          break;

        case 'quiz_completed':
          metrics.incrementCounter('QuizCompleted');
          if (data.score !== undefined) {
            metrics.recordPercentage('QuizScore', data.score);
          }
          if (data.timeSpent) {
            metrics.recordDuration('QuizTimeSpent', data.timeSpent);
          }
          break;

        case 'ai_operation':
          metrics.incrementCounter('AIOperation', {
            Operation: data.operation,
            Success: data.success?.toString() || 'unknown',
          });
          if (data.tokensUsed) {
            metrics.addMetric('AITokensUsed', data.tokensUsed, 'Count', {
              Operation: data.operation,
            });
          }
          break;

        default:
          logger.warn('Unknown business event type', { eventType, data });
      }

      logger.debug('Business metrics recorded', { eventType, data });

    } catch (error) {
      logger.error('Failed to record business metrics', error as Error, { eventType, data });
    }
  }

  // Helper to categorize video durations
  private getDurationBucket(durationSeconds: number): string {
    if (durationSeconds < 300) return '0-5min';
    if (durationSeconds < 900) return '5-15min';
    if (durationSeconds < 1800) return '15-30min';
    if (durationSeconds < 3600) return '30-60min';
    return '60min+';
  }

  // Record error metrics with context
  recordErrorMetrics(error: Error, context: Record<string, any> = {}): void {
    const metrics = getMetricsCollector();
    const logger = getLogger();

    try {
      const errorType = error.constructor.name;
      const errorCode = (error as any).code || 'UNKNOWN';

      metrics.incrementCounter('Error', {
        ErrorType: errorType,
        ErrorCode: errorCode,
        FunctionName: this.functionName,
        Environment: this.environment,
      });

      // Record error by category
      if (errorType.includes('Validation')) {
        metrics.incrementCounter('ValidationError');
      } else if (errorType.includes('Auth')) {
        metrics.incrementCounter('AuthenticationError');
      } else if (errorType.includes('Database')) {
        metrics.incrementCounter('DatabaseError');
      } else if (errorType.includes('Network')) {
        metrics.incrementCounter('NetworkError');
      } else {
        metrics.incrementCounter('UnknownError');
      }

      logger.error('Error metrics recorded', error, {
        errorType,
        errorCode,
        context,
      });

    } catch (metricsError) {
      logger.error('Failed to record error metrics', metricsError as Error, {
        originalError: error.message,
        context,
      });
    }
  }

  // Record performance metrics
  recordPerformanceMetrics(operation: string, startTime: number, success: boolean, metadata?: Record<string, any>): void {
    const metrics = getMetricsCollector();
    const duration = Date.now() - startTime;

    metrics.recordDuration(`${operation}.Duration`, duration);
    metrics.incrementCounter(`${operation}.${success ? 'Success' : 'Failure'}`);

    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        if (typeof value === 'number') {
          metrics.addMetric(`${operation}.${key}`, value, 'Count');
        }
      });
    }
  }

  // Create health check metrics
  recordHealthCheck(checks: Record<string, boolean>): void {
    const metrics = getMetricsCollector();
    const logger = getLogger();

    Object.entries(checks).forEach(([service, healthy]) => {
      metrics.incrementCounter('HealthCheck', {
        Service: service,
        Status: healthy ? 'Healthy' : 'Unhealthy',
      });
    });

    const overallHealth = Object.values(checks).every(Boolean);
    metrics.incrementCounter('OverallHealth', {
      Status: overallHealth ? 'Healthy' : 'Unhealthy',
    });

    logger.info('Health check metrics recorded', { checks, overallHealth });
  }

  // Record API usage metrics
  recordAPIUsage(endpoint: string, method: string, statusCode: number, duration: number, userId?: string): void {
    const metrics = getMetricsCollector();

    metrics.incrementCounter('APICall', {
      Endpoint: endpoint,
      Method: method,
      StatusCode: statusCode.toString(),
      StatusClass: `${Math.floor(statusCode / 100)}xx`,
    });

    metrics.recordDuration('APICallDuration', duration, {
      Endpoint: endpoint,
      Method: method,
    });

    // Track unique users
    if (userId) {
      metrics.incrementCounter('UniqueAPIUser', {
        Endpoint: endpoint,
      });
    }
  }

  // Record subscription tier usage
  recordSubscriptionUsage(tier: string, feature: string): void {
    const metrics = getMetricsCollector();

    metrics.incrementCounter('FeatureUsage', {
      SubscriptionTier: tier,
      Feature: feature,
    });
  }
}

// Global monitoring service instance
let globalMonitoringService: MonitoringService | null = null;

export const getMonitoringService = (): MonitoringService => {
  if (!globalMonitoringService) {
    globalMonitoringService = new MonitoringService();
  }
  return globalMonitoringService;
};

// Middleware to automatically record monitoring metrics
export const monitoringMiddleware = () => {
  return async (event: any, context: any, next: () => Promise<any>) => {
    const monitoring = getMonitoringService();
    const startTime = Date.now();

    try {
      // Record Lambda metrics
      monitoring.recordLambdaMetrics(context);

      // Execute the handler
      const result = await next();

      // Record success metrics
      const duration = Date.now() - startTime;
      monitoring.recordPerformanceMetrics('LambdaExecution', startTime, true, {
        statusCode: result.statusCode,
        responseSize: result.body?.length || 0,
      });

      monitoring.recordAPIUsage(
        event.path || 'unknown',
        event.httpMethod || 'unknown',
        result.statusCode,
        duration,
        event.user?.userId
      );

      return result;

    } catch (error) {
      // Record error metrics
      const duration = Date.now() - startTime;
      monitoring.recordErrorMetrics(error as Error, {
        path: event.path,
        method: event.httpMethod,
        userId: event.user?.userId,
      });

      monitoring.recordPerformanceMetrics('LambdaExecution', startTime, false, {
        duration,
      });

      throw error;
    }
  };
};

// Predefined dashboard configurations
export const createDefaultDashboard = (): DashboardConfig => ({
  name: 'YoutubeLearningPlatform-Overview',
  widgets: [
    {
      type: 'metric',
      title: 'API Calls',
      metrics: ['YoutubeLearningPlatform.APICall'],
      period: 300,
      stat: 'Sum',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    {
      type: 'metric',
      title: 'Error Rate',
      metrics: ['YoutubeLearningPlatform.Error'],
      period: 300,
      stat: 'Sum',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    {
      type: 'metric',
      title: 'Response Time',
      metrics: ['YoutubeLearningPlatform.APICallDuration'],
      period: 300,
      stat: 'Average',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    {
      type: 'metric',
      title: 'Video Processing',
      metrics: ['YoutubeLearningPlatform.VideoProcessed'],
      period: 300,
      stat: 'Sum',
      region: process.env.AWS_REGION || 'us-east-1',
    },
  ],
});

// Predefined alarm configurations
export const createDefaultAlarms = (): AlarmConfig[] => [
  {
    name: 'HighErrorRate',
    description: 'Alert when error rate exceeds 5%',
    metricName: 'Error',
    namespace: 'YoutubeLearningPlatform',
    statistic: 'Sum',
    period: 300,
    evaluationPeriods: 2,
    threshold: 10,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
  },
  {
    name: 'HighResponseTime',
    description: 'Alert when average response time exceeds 5 seconds',
    metricName: 'APICallDuration',
    namespace: 'YoutubeLearningPlatform',
    statistic: 'Average',
    period: 300,
    evaluationPeriods: 3,
    threshold: 5000,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
  },
  {
    name: 'LowHealthCheck',
    description: 'Alert when health check fails',
    metricName: 'OverallHealth',
    namespace: 'YoutubeLearningPlatform',
    statistic: 'Average',
    period: 60,
    evaluationPeriods: 1,
    threshold: 1,
    comparisonOperator: 'LessThanThreshold',
    treatMissingData: 'breaching',
    dimensions: { Status: 'Healthy' },
  },
];