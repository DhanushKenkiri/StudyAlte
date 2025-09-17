// CloudWatch metrics utilities for Lambda functions

import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { MetricData } from './types';
import { getLogger } from './logger';

// CloudWatch client (cached)
let cloudWatchClient: CloudWatchClient | null = null;

const getCloudWatchClient = (): CloudWatchClient => {
  if (!cloudWatchClient) {
    cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return cloudWatchClient;
};

export class MetricsCollector {
  private namespace: string;
  private defaultDimensions: Record<string, string>;
  private metrics: MetricData[] = [];
  private batchSize: number = 20; // CloudWatch limit

  constructor(namespace: string = 'YoutubeLearningPlatform', defaultDimensions: Record<string, string> = {}) {
    this.namespace = namespace;
    this.defaultDimensions = {
      Environment: process.env.NODE_ENV || 'development',
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
      ...defaultDimensions,
    };
  }

  // Add a metric to the batch
  addMetric(
    name: string,
    value: number,
    unit: MetricData['unit'] = 'Count',
    dimensions: Record<string, string> = {}
  ): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      dimensions: { ...this.defaultDimensions, ...dimensions },
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Auto-flush if batch is full
    if (this.metrics.length >= this.batchSize) {
      this.flush().catch(error => {
        const logger = getLogger();
        logger.error('Failed to auto-flush metrics', error);
      });
    }
  }

  // Flush all metrics to CloudWatch
  async flush(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const logger = getLogger();
    const client = getCloudWatchClient();

    try {
      // Convert metrics to CloudWatch format
      const metricData: MetricDatum[] = this.metrics.map(metric => ({
        MetricName: metric.name,
        Value: metric.value,
        Unit: metric.unit,
        Timestamp: metric.timestamp,
        Dimensions: Object.entries(metric.dimensions).map(([Name, Value]) => ({
          Name,
          Value,
        })),
      }));

      // Send metrics in batches
      const batches = [];
      for (let i = 0; i < metricData.length; i += this.batchSize) {
        batches.push(metricData.slice(i, i + this.batchSize));
      }

      await Promise.all(
        batches.map(batch =>
          client.send(
            new PutMetricDataCommand({
              Namespace: this.namespace,
              MetricData: batch,
            })
          )
        )
      );

      logger.debug(`Flushed ${this.metrics.length} metrics to CloudWatch`);
      this.metrics = []; // Clear the batch
    } catch (error) {
      logger.error('Failed to send metrics to CloudWatch', error as Error, {
        metricsCount: this.metrics.length,
        namespace: this.namespace,
      });
      throw error;
    }
  }

  // Convenience methods for common metrics
  incrementCounter(name: string, dimensions?: Record<string, string>): void {
    this.addMetric(name, 1, 'Count', dimensions);
  }

  recordDuration(name: string, durationMs: number, dimensions?: Record<string, string>): void {
    this.addMetric(name, durationMs, 'Milliseconds', dimensions);
  }

  recordSize(name: string, sizeBytes: number, dimensions?: Record<string, string>): void {
    this.addMetric(name, sizeBytes, 'Bytes', dimensions);
  }

  recordPercentage(name: string, percentage: number, dimensions?: Record<string, string>): void {
    this.addMetric(name, percentage, 'Percent', dimensions);
  }

  // Business metrics
  recordUserAction(action: string, userId?: string): void {
    this.incrementCounter('UserAction', {
      Action: action,
      ...(userId && { UserId: userId }),
    });
  }

  recordAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.incrementCounter('APICall', {
      Endpoint: endpoint,
      Method: method,
      StatusCode: statusCode.toString(),
    });

    this.recordDuration('APICallDuration', duration, {
      Endpoint: endpoint,
      Method: method,
    });
  }

  recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    this.incrementCounter('DatabaseOperation', {
      Operation: operation,
      Table: table,
      Success: success.toString(),
    });

    this.recordDuration('DatabaseOperationDuration', duration, {
      Operation: operation,
      Table: table,
    });
  }

  recordExternalAPICall(service: string, operation: string, duration: number, success: boolean): void {
    this.incrementCounter('ExternalAPICall', {
      Service: service,
      Operation: operation,
      Success: success.toString(),
    });

    this.recordDuration('ExternalAPICallDuration', duration, {
      Service: service,
      Operation: operation,
    });
  }

  recordVideoProcessing(stage: string, duration: number, success: boolean, videoId?: string): void {
    this.incrementCounter('VideoProcessing', {
      Stage: stage,
      Success: success.toString(),
      ...(videoId && { VideoId: videoId }),
    });

    this.recordDuration('VideoProcessingDuration', duration, {
      Stage: stage,
    });
  }

  recordAIOperation(operation: string, duration: number, success: boolean, tokensUsed?: number): void {
    this.incrementCounter('AIOperation', {
      Operation: operation,
      Success: success.toString(),
    });

    this.recordDuration('AIOperationDuration', duration, {
      Operation: operation,
    });

    if (tokensUsed !== undefined) {
      this.addMetric('AITokensUsed', tokensUsed, 'Count', {
        Operation: operation,
      });
    }
  }

  // Error metrics
  recordError(errorType: string, errorCode?: string, userId?: string): void {
    this.incrementCounter('Error', {
      ErrorType: errorType,
      ...(errorCode && { ErrorCode: errorCode }),
      ...(userId && { UserId: userId }),
    });
  }

  // Performance metrics
  recordColdStart(duration: number): void {
    this.incrementCounter('ColdStart');
    this.recordDuration('ColdStartDuration', duration);
  }

  recordMemoryUsage(usedMB: number, totalMB: number): void {
    this.addMetric('MemoryUsed', usedMB, 'Count');
    this.recordPercentage('MemoryUtilization', (usedMB / totalMB) * 100);
  }
}

// Global metrics collector instance
let globalMetricsCollector: MetricsCollector | null = null;

export const initializeMetrics = (
  namespace?: string,
  defaultDimensions?: Record<string, string>
): MetricsCollector => {
  globalMetricsCollector = new MetricsCollector(namespace, defaultDimensions);
  return globalMetricsCollector;
};

export const getMetricsCollector = (): MetricsCollector => {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
};

// Utility function to measure and record execution time
export const measureAndRecord = async <T>(
  metricName: string,
  operation: () => Promise<T>,
  dimensions?: Record<string, string>
): Promise<T> => {
  const startTime = Date.now();
  const metrics = getMetricsCollector();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    metrics.recordDuration(metricName, duration, dimensions);
    metrics.incrementCounter(`${metricName}.Success`, dimensions);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    metrics.recordDuration(metricName, duration, dimensions);
    metrics.incrementCounter(`${metricName}.Error`, dimensions);
    
    throw error;
  }
};

// Decorator for automatic metrics collection
export const withMetrics = (metricName: string, dimensions?: Record<string, string>) => {
  return <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: any, ...args: any[]) {
      return measureAndRecord(
        metricName,
        () => method.apply(this, args),
        dimensions
      );
    }) as T;
  };
};

// Lambda function wrapper that automatically flushes metrics
export const withMetricsFlush = <T extends (...args: any[]) => Promise<any>>(
  handler: T
): T => {
  return (async (...args: any[]) => {
    try {
      const result = await handler(...args);
      
      // Flush metrics before returning
      const metrics = getMetricsCollector();
      await metrics.flush();
      
      return result;
    } catch (error) {
      // Still try to flush metrics on error
      try {
        const metrics = getMetricsCollector();
        await metrics.flush();
      } catch (flushError) {
        const logger = getLogger();
        logger.error('Failed to flush metrics on error', flushError as Error);
      }
      
      throw error;
    }
  }) as T;
};