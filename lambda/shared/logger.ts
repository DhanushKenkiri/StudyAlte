// Structured logging for Lambda functions

import { LogLevel, LogEntry, ExecutionContext } from './types';

export class Logger {
  private context: ExecutionContext;
  private logLevel: LogLevel;

  constructor(context: ExecutionContext, logLevel: LogLevel = 'info') {
    this.context = context;
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.logLevel];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      correlationId: this.context.correlationId,
      userId: this.context.userId,
      metadata: {
        ...metadata,
        functionName: this.context.functionName,
        functionVersion: this.context.functionVersion,
        memoryLimit: this.context.memoryLimit,
        remainingTime: this.context.remainingTime,
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // In AWS Lambda, console.log writes to CloudWatch Logs
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(this.createLogEntry('debug', message, metadata));
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(this.createLogEntry('info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(this.createLogEntry('warn', message, metadata, error));
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(this.createLogEntry('error', message, metadata, error));
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      duration,
      unit: 'milliseconds',
    });
  }

  // Request/Response logging
  logRequest(method: string, path: string, metadata?: Record<string, unknown>): void {
    this.info(`Request: ${method} ${path}`, metadata);
  }

  logResponse(statusCode: number, duration: number, metadata?: Record<string, unknown>): void {
    this.info(`Response: ${statusCode}`, {
      ...metadata,
      duration,
      unit: 'milliseconds',
    });
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(`Database: ${operation} on ${table}`, {
      ...metadata,
      duration,
      unit: 'milliseconds',
    });
  }

  // External API logging
  logExternalAPI(
    service: string,
    operation: string,
    duration: number,
    statusCode?: number,
    metadata?: Record<string, unknown>
  ): void {
    this.info(`External API: ${service} ${operation}`, {
      ...metadata,
      duration,
      statusCode,
      unit: 'milliseconds',
    });
  }

  // Security logging
  logSecurityEvent(event: string, metadata?: Record<string, unknown>): void {
    this.warn(`Security: ${event}`, metadata);
  }

  // Business logic logging
  logBusinessEvent(event: string, metadata?: Record<string, unknown>): void {
    this.info(`Business: ${event}`, metadata);
  }

  // Create child logger with additional context
  child(additionalContext: Partial<ExecutionContext>): Logger {
    const childContext = { ...this.context, ...additionalContext };
    return new Logger(childContext, this.logLevel);
  }
}

// Global logger instance (will be initialized in each Lambda)
let globalLogger: Logger | null = null;

export const initializeLogger = (context: ExecutionContext, logLevel?: LogLevel): Logger => {
  globalLogger = new Logger(context, logLevel || (process.env.LOG_LEVEL as LogLevel) || 'info');
  return globalLogger;
};

export const getLogger = (): Logger => {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initializeLogger first.');
  }
  return globalLogger;
};

// Utility function to measure execution time
export const measureTime = async <T>(
  operation: string,
  fn: () => Promise<T>,
  logger?: Logger
): Promise<T> => {
  const startTime = Date.now();
  const log = logger || getLogger();
  
  try {
    log.debug(`Starting operation: ${operation}`);
    const result = await fn();
    const duration = Date.now() - startTime;
    log.logPerformance(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`Operation failed: ${operation}`, error as Error, { duration });
    throw error;
  }
};

// Utility function to log function entry/exit
export const logFunction = <T extends unknown[], R>(
  functionName: string,
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    const logger = getLogger();
    const startTime = Date.now();
    
    logger.debug(`Entering function: ${functionName}`, { args: args.length });
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      logger.debug(`Exiting function: ${functionName}`, { duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Function error: ${functionName}`, error as Error, { duration });
      throw error;
    }
  };
};