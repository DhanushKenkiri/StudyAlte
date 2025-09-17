// Tests for Lambda handler utilities

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createHandler, createGetHandler, createPostHandler, healthCheckHandler } from '../handler';
import { EnhancedAPIGatewayEvent } from '../types';

// Mock dependencies
jest.mock('../logger', () => ({
  initializeLogger: jest.fn(),
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    logRequest: jest.fn(),
    logResponse: jest.fn(),
    logSecurityEvent: jest.fn(),
  })),
}));

jest.mock('../metrics', () => ({
  getMetricsCollector: jest.fn(() => ({
    incrementCounter: jest.fn(),
    recordDuration: jest.fn(),
    flush: jest.fn(),
  })),
}));

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

describe('Lambda Handler', () => {
  const mockEvent: APIGatewayProxyEvent = {
    httpMethod: 'GET',
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'test-account',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/test',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200000,
      resourceId: 'test-resource',
      resourcePath: '/test',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      authorizer: null,
    },
    resource: '/test',
    stageVariables: null,
    multiValueQueryStringParameters: null,
  };

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: 128,
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.COGNITO_USER_POOL_ID = 'test-user-pool';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.NODE_ENV = 'test';
  });

  describe('createHandler', () => {
    test('should create a handler that processes requests successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'success' }),
      });

      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          httpMethod: 'GET',
          path: '/test',
          requestId: 'test-request-id',
        }),
        mockContext
      );
    });

    test('should handle CORS preflight requests', async () => {
      const mockHandler = jest.fn();
      const handler = createHandler(mockHandler);

      const optionsEvent = { ...mockEvent, httpMethod: 'OPTIONS' };
      const result = await handler(optionsEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('should reject disallowed HTTP methods', async () => {
      const mockHandler = jest.fn();
      const handler = createHandler(mockHandler, {
        allowedMethods: ['POST'],
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(405);
      expect(result.headers).toHaveProperty('Allow', 'POST');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('should parse JSON request body', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });

      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      const eventWithBody = {
        ...mockEvent,
        httpMethod: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      };

      await handler(eventWithBody, mockContext);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { test: 'data' },
        }),
        mockContext
      );
    });

    test('should handle invalid JSON in request body', async () => {
      const mockHandler = jest.fn();
      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      const eventWithInvalidBody = {
        ...mockEvent,
        httpMethod: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      };

      const result = await handler(eventWithInvalidBody, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('should handle handler errors gracefully', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toHaveProperty('error');
    });
  });

  describe('createGetHandler', () => {
    test('should only allow GET and OPTIONS methods', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });

      const handler = createGetHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      // Test GET request
      const getResult = await handler(mockEvent, mockContext);
      expect(getResult.statusCode).toBe(200);

      // Test POST request (should be rejected)
      const postEvent = { ...mockEvent, httpMethod: 'POST' };
      const postResult = await handler(postEvent, mockContext);
      expect(postResult.statusCode).toBe(405);
    });
  });

  describe('createPostHandler', () => {
    test('should only allow POST and OPTIONS methods', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });

      const handler = createPostHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
        },
      });

      // Test POST request
      const postEvent = { ...mockEvent, httpMethod: 'POST' };
      const postResult = await handler(postEvent, mockContext);
      expect(postResult.statusCode).toBe(200);

      // Test GET request (should be rejected)
      const getResult = await handler(mockEvent, mockContext);
      expect(getResult.statusCode).toBe(405);
    });
  });

  describe('healthCheckHandler', () => {
    test('should return health status', async () => {
      const result = await healthCheckHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('requestId');
    });
  });

  describe('Authentication', () => {
    test('should require authentication when configured', async () => {
      const mockHandler = jest.fn();
      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: true, allowUnverified: false },
        },
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('should accept valid JWT token', async () => {
      const mockVerify = jest.fn().mockResolvedValue({
        sub: 'user123',
        email: 'test@example.com',
        email_verified: true,
        'custom:subscription': 'free',
      });

      const { CognitoJwtVerifier } = require('aws-jwt-verify');
      CognitoJwtVerifier.create.mockReturnValue({ verify: mockVerify });

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });

      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: true, allowUnverified: false },
        },
      });

      const eventWithAuth = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          Authorization: 'Bearer valid-jwt-token',
        },
      };

      const result = await handler(eventWithAuth, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockVerify).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            userId: 'user123',
            email: 'test@example.com',
            subscription: 'free',
            emailVerified: true,
          },
        }),
        mockContext
      );
    });

    test('should reject invalid JWT token', async () => {
      const mockVerify = jest.fn().mockRejectedValue(new Error('Invalid token'));

      const { CognitoJwtVerifier } = require('aws-jwt-verify');
      CognitoJwtVerifier.create.mockReturnValue({ verify: mockVerify });

      const mockHandler = jest.fn();
      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: true, allowUnverified: false },
        },
      });

      const eventWithAuth = {
        ...mockEvent,
        headers: {
          ...mockEvent.headers,
          Authorization: 'Bearer invalid-jwt-token',
        },
      };

      const result = await handler(eventWithAuth, mockContext);

      expect(result.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Request Validation', () => {
    test('should validate request body with Zod schema', async () => {
      const { z } = require('zod');
      
      const bodySchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });

      const handler = createHandler(mockHandler, {
        config: {
          auth: { required: false, allowUnverified: true },
          validation: {
            body: bodySchema,
          },
        },
      });

      // Test valid body
      const validEvent = {
        ...mockEvent,
        httpMethod: 'POST',
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      };

      const validResult = await handler(validEvent, mockContext);
      expect(validResult.statusCode).toBe(200);

      // Test invalid body
      const invalidEvent = {
        ...mockEvent,
        httpMethod: 'POST',
        body: JSON.stringify({ name: '', email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' },
      };

      const invalidResult = await handler(invalidEvent, mockContext);
      expect(invalidResult.statusCode).toBe(400);
    });
  });
});