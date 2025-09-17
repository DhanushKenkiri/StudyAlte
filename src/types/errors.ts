// Error types and classes

export type ErrorCode = 
  // Authentication Errors
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_INSUFFICIENT_PERMISSIONS'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_PASSWORD_TOO_WEAK'
  
  // Video Processing Errors
  | 'VIDEO_INVALID_URL'
  | 'VIDEO_NOT_ACCESSIBLE'
  | 'VIDEO_TOO_LONG'
  | 'VIDEO_NO_TRANSCRIPT'
  | 'VIDEO_PROCESSING_FAILED'
  | 'VIDEO_UNSUPPORTED_LANGUAGE'
  | 'VIDEO_PRIVATE_OR_DELETED'
  
  // AI Service Errors
  | 'AI_SERVICE_UNAVAILABLE'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_PROCESSING_TIMEOUT'
  | 'AI_INVALID_CONTENT'
  | 'AI_GENERATION_FAILED'
  
  // Data Validation Errors
  | 'VALIDATION_REQUIRED_FIELD'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_OUT_OF_RANGE'
  | 'VALIDATION_DUPLICATE_VALUE'
  | 'VALIDATION_INVALID_LENGTH'
  
  // Database Errors
  | 'DB_CONNECTION_FAILED'
  | 'DB_RECORD_NOT_FOUND'
  | 'DB_CONSTRAINT_VIOLATION'
  | 'DB_TRANSACTION_FAILED'
  | 'DB_TIMEOUT'
  
  // Network Errors
  | 'NETWORK_CONNECTION_FAILED'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_RATE_LIMITED'
  | 'NETWORK_SERVICE_UNAVAILABLE'
  
  // File/Storage Errors
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_FILE_NOT_FOUND'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_INVALID_FILE_TYPE'
  
  // General Errors
  | 'INTERNAL_SERVER_ERROR'
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY';

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  field?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  requestId?: string;
}

// Base Error Class
export abstract class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.metadata = metadata;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }
}

// Specific Error Classes
export class AuthenticationError extends AppError {
  constructor(
    code: ErrorCode = 'AUTH_INVALID_CREDENTIALS',
    message: string = 'Authentication failed',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 401, true, metadata);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    code: ErrorCode = 'AUTH_INSUFFICIENT_PERMISSIONS',
    message: string = 'Insufficient permissions',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 403, true, metadata);
  }
}

export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(
    message: string,
    field?: string,
    code: ErrorCode = 'VALIDATION_REQUIRED_FIELD',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 400, true, metadata);
    this.field = field;
  }
}

export class VideoProcessingError extends AppError {
  public readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    retryable: boolean = false,
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 422, true, metadata);
    this.retryable = retryable;
  }
}

export class AIServiceError extends AppError {
  public readonly service: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    service: string,
    retryable: boolean = true,
    code: ErrorCode = 'AI_SERVICE_UNAVAILABLE',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 503, true, metadata);
    this.service = service;
    this.retryable = retryable;
  }
}

export class DatabaseError extends AppError {
  constructor(
    code: ErrorCode = 'DB_CONNECTION_FAILED',
    message: string = 'Database operation failed',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 500, true, metadata);
  }
}

export class NetworkError extends AppError {
  public readonly retryable: boolean;

  constructor(
    code: ErrorCode = 'NETWORK_CONNECTION_FAILED',
    message: string = 'Network request failed',
    retryable: boolean = true,
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 503, true, metadata);
    this.retryable = retryable;
  }
}

export class NotFoundError extends AppError {
  constructor(
    resource: string = 'Resource',
    code: ErrorCode = 'NOT_FOUND',
    metadata?: Record<string, unknown>
  ) {
    super(code, `${resource} not found`, 404, true, metadata);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = 'Resource conflict',
    code: ErrorCode = 'CONFLICT',
    metadata?: Record<string, unknown>
  ) {
    super(code, message, 409, true, metadata);
  }
}

// Error Handler Types
export interface ErrorHandler {
  handleError(error: Error): void;
  handleApiError(error: AppError): ErrorDetails;
  handleValidationError(error: ValidationError): ErrorDetails;
  handleNetworkError(error: NetworkError): ErrorDetails;
}

// Error Recovery Strategies
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  retryableErrors: ErrorCode[];
}

export interface ErrorRecoveryStrategy {
  canRecover(error: AppError): boolean;
  recover(error: AppError): Promise<void>;
  getRetryConfig(): RetryConfig;
}

// Frontend Error Boundary Types
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: {
    componentStack: string;
  } | null;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorInfo?: {
    componentStack: string;
  };
}

// Error Reporting Types
export interface ErrorReport {
  error: ErrorDetails;
  context: {
    userId?: string;
    sessionId: string;
    userAgent: string;
    url: string;
    timestamp: Date;
    additionalData?: Record<string, unknown>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorLogger {
  logError(error: AppError, context?: Record<string, unknown>): void;
  reportError(report: ErrorReport): Promise<void>;
}