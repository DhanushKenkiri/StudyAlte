import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { YoutubeLearningPlatformStack } from '../youtube-learning-platform-stack';

describe('API Gateway Configuration', () => {
  let template: Template;
  let stack: YoutubeLearningPlatformStack;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new YoutubeLearningPlatformStack(app, 'TestStack', {
      environment: 'test',
      stackName: 'youtube-learning-platform',
    });
    template = Template.fromStack(stack);
  });

  describe('REST API', () => {
    test('should create REST API with correct configuration', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'youtube-learning-platform-test-api',
        Description: 'YouTube Learning Platform API',
      });
    });

    test('should configure CORS properly', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
        Integration: {
          Type: 'MOCK',
          IntegrationResponses: [
            {
              StatusCode: '200',
              ResponseParameters: {
                'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
                'method.response.header.Access-Control-Allow-Methods': "'*'",
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              },
            },
          ],
        },
      });
    });
  });

  describe('API Models', () => {
    test('should create user model', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'User',
        ContentType: 'application/json',
        Schema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'User',
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            preferences: { type: 'object' },
          },
          required: ['email', 'name'],
        },
      });
    });

    test('should create learning capsule model', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'LearningCapsule',
        ContentType: 'application/json',
        Schema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'LearningCapsule',
          type: 'object',
          properties: {
            id: { type: 'string' },
            videoUrl: { type: 'string' },
            title: { type: 'string' },
            summary: { type: 'string' },
            flashcards: { type: 'array' },
            quiz: { type: 'object' },
            mindMap: { type: 'object' },
            notes: { type: 'array' },
          },
          required: ['videoUrl'],
        },
      });
    });

    test('should create error model', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'Error',
        ContentType: 'application/json',
        Schema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'Error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' },
          },
          required: ['error', 'message', 'statusCode'],
        },
      });
    });
  });

  describe('Authentication', () => {
    test('should create Cognito authorizer', () => {
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
        Name: 'youtube-learning-platform-test-authorizer',
      });
    });

    test('should configure protected endpoints with authorization', () => {
      // Check that user profile endpoint requires authorization
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        AuthorizationType: 'COGNITO_USER_POOLS',
      });
    });
  });

  describe('Request Validation', () => {
    test('should create request validator', () => {
      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'youtube-learning-platform-test-validator',
        ValidateRequestBody: true,
        ValidateRequestParameters: true,
      });
    });

    test('should configure method responses with error codes', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        MethodResponses: [
          { StatusCode: '200' },
          { StatusCode: '400' },
          { StatusCode: '401' },
          { StatusCode: '403' },
          { StatusCode: '404' },
          { StatusCode: '500' },
        ],
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should create usage plan with throttling', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'youtube-learning-platform-test-usage-plan',
        Description: 'Usage plan for YouTube Learning Platform API',
        Throttle: {
          RateLimit: 1000,
          BurstLimit: 2000,
        },
        Quota: {
          Limit: 100000,
          Period: 'MONTH',
        },
      });
    });

    test('should create API key', () => {
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'youtube-learning-platform-test-key',
        Description: 'API Key for YouTube Learning Platform',
      });
    });

    test('should associate usage plan with API stage', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {});
    });
  });

  describe('Lambda Integrations', () => {
    test('should create health check Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'youtube-learning-platform-test-health-check',
        Handler: 'health-check.handler',
        Runtime: 'nodejs20.x',
        Timeout: 10,
        MemorySize: 128,
      });
    });

    test('should create user profile Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'youtube-learning-platform-test-get-user-profile',
        Handler: 'get-profile.handler',
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    test('should integrate health check with API Gateway', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        AuthorizationType: 'NONE', // Health check should be public
        Integration: {
          Type: 'AWS_PROXY',
        },
      });
    });
  });

  describe('API Resources', () => {
    test('should create all required API resources', () => {
      const expectedResources = [
        'users',
        'auth',
        'videos',
        'capsules',
        'study',
        'tutor',
        'search',
        'analytics',
        'export',
        'health',
      ];

      expectedResources.forEach(resourceName => {
        template.hasResourceProperties('AWS::ApiGateway::Resource', {
          PathPart: resourceName,
        });
      });
    });

    test('should create nested resources', () => {
      // Check for nested resources like /users/{userId}
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: '{userId}',
      });

      // Check for nested resources like /capsules/{capsuleId}/summary
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'summary',
      });
    });
  });

  describe('Environment Configuration', () => {
    test('should configure Lambda environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            NODE_ENV: 'test',
            LOG_LEVEL: 'debug',
          },
        },
      });
    });

    test('should use correct naming convention for test environment', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'youtube-learning-platform-test-api',
      });
    });
  });

  describe('Security Configuration', () => {
    test('should enable X-Ray tracing for Lambda functions', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    test('should configure proper IAM permissions for Lambda execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });
  });
});