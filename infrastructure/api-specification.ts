import * as apigateway from 'aws-cdk-lib/aws-apigateway';

/**
 * API Specification for YouTube Learning Platform
 * Defines all REST API endpoints, request/response schemas, and validation rules
 */

export interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  authRequired: boolean;
  requestModel?: string;
  responseModel?: string;
  pathParameters?: string[];
  queryParameters?: string[];
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  // Authentication endpoints
  {
    path: '/auth/login',
    method: 'POST',
    description: 'User login with email and password',
    authRequired: false,
    requestModel: 'LoginRequest',
    responseModel: 'AuthResponse',
  },
  {
    path: '/auth/register',
    method: 'POST',
    description: 'User registration with email, password, and profile info',
    authRequired: false,
    requestModel: 'RegisterRequest',
    responseModel: 'AuthResponse',
  },
  {
    path: '/auth/refresh',
    method: 'POST',
    description: 'Refresh authentication token',
    authRequired: false,
    requestModel: 'RefreshTokenRequest',
    responseModel: 'AuthResponse',
  },
  {
    path: '/auth/logout',
    method: 'POST',
    description: 'User logout and token invalidation',
    authRequired: true,
    responseModel: 'SuccessResponse',
  },
  {
    path: '/auth/forgot-password',
    method: 'POST',
    description: 'Initiate password reset process',
    authRequired: false,
    requestModel: 'ForgotPasswordRequest',
    responseModel: 'SuccessResponse',
  },
  {
    path: '/auth/reset-password',
    method: 'POST',
    description: 'Reset password with verification code',
    authRequired: false,
    requestModel: 'ResetPasswordRequest',
    responseModel: 'SuccessResponse',
  },

  // User management endpoints
  {
    path: '/users/{userId}',
    method: 'GET',
    description: 'Get user profile information',
    authRequired: true,
    pathParameters: ['userId'],
    responseModel: 'UserProfile',
  },
  {
    path: '/users/{userId}',
    method: 'PUT',
    description: 'Update user profile information',
    authRequired: true,
    pathParameters: ['userId'],
    requestModel: 'UpdateUserRequest',
    responseModel: 'UserProfile',
  },
  {
    path: '/users',
    method: 'POST',
    description: 'Create user profile (admin only)',
    authRequired: true,
    requestModel: 'CreateUserRequest',
    responseModel: 'UserProfile',
  },
  {
    path: '/users/{userId}',
    method: 'DELETE',
    description: 'Delete user account',
    authRequired: true,
    pathParameters: ['userId'],
    responseModel: 'SuccessResponse',
  },

  // Video processing endpoints
  {
    path: '/videos/process',
    method: 'POST',
    description: 'Process YouTube video to create learning capsule',
    authRequired: true,
    requestModel: 'ProcessVideoRequest',
    responseModel: 'ProcessVideoResponse',
  },
  {
    path: '/videos/{videoId}/status',
    method: 'GET',
    description: 'Get video processing status',
    authRequired: true,
    pathParameters: ['videoId'],
    responseModel: 'ProcessingStatus',
  },

  // Learning capsules endpoints
  {
    path: '/capsules',
    method: 'GET',
    description: 'List user learning capsules with pagination and filtering',
    authRequired: true,
    queryParameters: ['page', 'limit', 'search', 'tags', 'sortBy', 'sortOrder'],
    responseModel: 'CapsuleList',
  },
  {
    path: '/capsules',
    method: 'POST',
    description: 'Create new learning capsule',
    authRequired: true,
    requestModel: 'CreateCapsuleRequest',
    responseModel: 'LearningCapsule',
  },
  {
    path: '/capsules/{capsuleId}',
    method: 'GET',
    description: 'Get specific learning capsule',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'LearningCapsule',
  },
  {
    path: '/capsules/{capsuleId}',
    method: 'PUT',
    description: 'Update learning capsule',
    authRequired: true,
    pathParameters: ['capsuleId'],
    requestModel: 'UpdateCapsuleRequest',
    responseModel: 'LearningCapsule',
  },
  {
    path: '/capsules/{capsuleId}',
    method: 'DELETE',
    description: 'Delete learning capsule',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'SuccessResponse',
  },

  // Capsule content endpoints
  {
    path: '/capsules/{capsuleId}/summary',
    method: 'GET',
    description: 'Get capsule summary',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'Summary',
  },
  {
    path: '/capsules/{capsuleId}/flashcards',
    method: 'GET',
    description: 'Get capsule flashcards',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'FlashcardList',
  },
  {
    path: '/capsules/{capsuleId}/quiz',
    method: 'GET',
    description: 'Get capsule quiz',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'Quiz',
  },
  {
    path: '/capsules/{capsuleId}/mindmap',
    method: 'GET',
    description: 'Get capsule mind map',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'MindMap',
  },
  {
    path: '/capsules/{capsuleId}/notes',
    method: 'GET',
    description: 'Get capsule notes',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'NotesList',
  },
  {
    path: '/capsules/{capsuleId}/transcript',
    method: 'GET',
    description: 'Get video transcript',
    authRequired: true,
    pathParameters: ['capsuleId'],
    responseModel: 'Transcript',
  },

  // Study session endpoints
  {
    path: '/study/flashcards',
    method: 'POST',
    description: 'Start flashcard study session',
    authRequired: true,
    requestModel: 'StartFlashcardSessionRequest',
    responseModel: 'StudySession',
  },
  {
    path: '/study/quiz',
    method: 'POST',
    description: 'Start quiz session',
    authRequired: true,
    requestModel: 'StartQuizSessionRequest',
    responseModel: 'StudySession',
  },
  {
    path: '/study/progress',
    method: 'PUT',
    description: 'Update study progress',
    authRequired: true,
    requestModel: 'UpdateProgressRequest',
    responseModel: 'ProgressUpdate',
  },

  // AI Tutor endpoints
  {
    path: '/tutor/chat',
    method: 'POST',
    description: 'Send message to AI tutor',
    authRequired: true,
    requestModel: 'ChatMessage',
    responseModel: 'ChatResponse',
  },
  {
    path: '/tutor/conversations',
    method: 'GET',
    description: 'Get conversation history',
    authRequired: true,
    queryParameters: ['page', 'limit'],
    responseModel: 'ConversationList',
  },
  {
    path: '/tutor/conversations/{conversationId}',
    method: 'GET',
    description: 'Get specific conversation',
    authRequired: true,
    pathParameters: ['conversationId'],
    responseModel: 'Conversation',
  },

  // Search endpoints
  {
    path: '/search/capsules',
    method: 'GET',
    description: 'Search learning capsules',
    authRequired: true,
    queryParameters: ['q', 'tags', 'page', 'limit', 'sortBy'],
    responseModel: 'SearchResults',
  },
  {
    path: '/search/content',
    method: 'GET',
    description: 'Search within capsule content',
    authRequired: true,
    queryParameters: ['q', 'capsuleId', 'contentType', 'page', 'limit'],
    responseModel: 'ContentSearchResults',
  },

  // Analytics endpoints
  {
    path: '/analytics/progress',
    method: 'GET',
    description: 'Get user progress analytics',
    authRequired: true,
    queryParameters: ['timeframe', 'capsuleId'],
    responseModel: 'ProgressAnalytics',
  },
  {
    path: '/analytics/performance',
    method: 'GET',
    description: 'Get performance metrics',
    authRequired: true,
    queryParameters: ['timeframe', 'metric'],
    responseModel: 'PerformanceMetrics',
  },

  // Export endpoints
  {
    path: '/export/data',
    method: 'POST',
    description: 'Export user data',
    authRequired: true,
    requestModel: 'ExportRequest',
    responseModel: 'ExportResponse',
  },
  {
    path: '/export/{exportId}',
    method: 'GET',
    description: 'Download export file',
    authRequired: true,
    pathParameters: ['exportId'],
    responseModel: 'FileDownload',
  },

  // Health check endpoint
  {
    path: '/health',
    method: 'GET',
    description: 'API health check',
    authRequired: false,
    responseModel: 'HealthStatus',
  },
];

/**
 * JSON Schema definitions for API models
 */
export const API_MODELS = {
  // Authentication models
  LoginRequest: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      email: { type: apigateway.JsonSchemaType.STRING, format: 'email' },
      password: { type: apigateway.JsonSchemaType.STRING, minLength: 8 },
    },
    required: ['email', 'password'],
  },

  RegisterRequest: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      email: { type: apigateway.JsonSchemaType.STRING, format: 'email' },
      password: { type: apigateway.JsonSchemaType.STRING, minLength: 8 },
      name: { type: apigateway.JsonSchemaType.STRING, minLength: 1 },
      preferences: { type: apigateway.JsonSchemaType.OBJECT },
    },
    required: ['email', 'password', 'name'],
  },

  AuthResponse: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      accessToken: { type: apigateway.JsonSchemaType.STRING },
      refreshToken: { type: apigateway.JsonSchemaType.STRING },
      idToken: { type: apigateway.JsonSchemaType.STRING },
      expiresIn: { type: apigateway.JsonSchemaType.NUMBER },
      user: { $ref: '#/definitions/UserProfile' },
    },
    required: ['accessToken', 'user'],
  },

  // Video processing models
  ProcessVideoRequest: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      videoUrl: { 
        type: apigateway.JsonSchemaType.STRING,
        pattern: '^https://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/)[a-zA-Z0-9_-]+',
      },
      options: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          generateSummary: { type: apigateway.JsonSchemaType.BOOLEAN },
          generateFlashcards: { type: apigateway.JsonSchemaType.BOOLEAN },
          generateQuiz: { type: apigateway.JsonSchemaType.BOOLEAN },
          generateMindMap: { type: apigateway.JsonSchemaType.BOOLEAN },
          generateNotes: { type: apigateway.JsonSchemaType.BOOLEAN },
        },
      },
    },
    required: ['videoUrl'],
  },

  ProcessVideoResponse: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      jobId: { type: apigateway.JsonSchemaType.STRING },
      status: { type: apigateway.JsonSchemaType.STRING, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
      estimatedCompletionTime: { type: apigateway.JsonSchemaType.STRING },
    },
    required: ['jobId', 'status'],
  },

  // Learning capsule models
  LearningCapsule: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      id: { type: apigateway.JsonSchemaType.STRING },
      userId: { type: apigateway.JsonSchemaType.STRING },
      videoUrl: { type: apigateway.JsonSchemaType.STRING },
      title: { type: apigateway.JsonSchemaType.STRING },
      description: { type: apigateway.JsonSchemaType.STRING },
      thumbnail: { type: apigateway.JsonSchemaType.STRING },
      duration: { type: apigateway.JsonSchemaType.NUMBER },
      tags: { 
        type: apigateway.JsonSchemaType.ARRAY,
        items: { type: apigateway.JsonSchemaType.STRING },
      },
      createdAt: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
      updatedAt: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
      status: { type: apigateway.JsonSchemaType.STRING, enum: ['PROCESSING', 'READY', 'ERROR'] },
    },
    required: ['id', 'userId', 'videoUrl', 'title', 'status'],
  },

  // Common response models
  SuccessResponse: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      success: { type: apigateway.JsonSchemaType.BOOLEAN },
      message: { type: apigateway.JsonSchemaType.STRING },
    },
    required: ['success'],
  },

  ErrorResponse: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      error: { type: apigateway.JsonSchemaType.STRING },
      message: { type: apigateway.JsonSchemaType.STRING },
      statusCode: { type: apigateway.JsonSchemaType.NUMBER },
      details: { type: apigateway.JsonSchemaType.OBJECT },
    },
    required: ['error', 'message', 'statusCode'],
  },

  HealthStatus: {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      status: { type: apigateway.JsonSchemaType.STRING, enum: ['healthy', 'unhealthy'] },
      timestamp: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
      version: { type: apigateway.JsonSchemaType.STRING },
      services: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          database: { type: apigateway.JsonSchemaType.STRING, enum: ['healthy', 'unhealthy'] },
          storage: { type: apigateway.JsonSchemaType.STRING, enum: ['healthy', 'unhealthy'] },
          ai: { type: apigateway.JsonSchemaType.STRING, enum: ['healthy', 'unhealthy'] },
        },
      },
    },
    required: ['status', 'timestamp'],
  },
};

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  // General API limits
  DEFAULT: {
    rateLimit: 100, // requests per second
    burstLimit: 200, // burst capacity
  },
  
  // Video processing limits (more restrictive)
  VIDEO_PROCESSING: {
    rateLimit: 5, // requests per second
    burstLimit: 10, // burst capacity
  },
  
  // AI Tutor limits
  AI_TUTOR: {
    rateLimit: 20, // requests per second
    burstLimit: 50, // burst capacity
  },
  
  // Search limits
  SEARCH: {
    rateLimit: 50, // requests per second
    burstLimit: 100, // burst capacity
  },
};

/**
 * CORS configuration
 */
export const CORS_CONFIG = {
  allowOrigins: ['http://localhost:5173', 'https://*.amazonaws.com'], // Add production domains
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'X-Amz-Date',
    'Authorization',
    'X-Api-Key',
    'X-Amz-Security-Token',
    'X-Amz-User-Agent',
  ],
  exposeHeaders: ['X-Request-Id', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours
};