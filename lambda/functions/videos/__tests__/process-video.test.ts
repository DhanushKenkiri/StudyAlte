import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { processHandler, statusHandler } from '../process-video';

// Mock AWS clients
const sfnMock = mockClient(SFNClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.VIDEO_PROCESSING_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';

describe('Video Processing Lambda Functions', () => {
  beforeEach(() => {
    sfnMock.reset();
    dynamoMock.reset();
    jest.clearAllMocks();
  });

  describe('processHandler', () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Test Video',
        description: 'Test Description',
        tags: ['test', 'video'],
        options: {
          generateSummary: true,
          generateFlashcards: true,
          generateQuiz: false,
          generateMindMap: true,
          generateNotes: true,
          extractTranscript: true,
          language: 'en',
        },
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
          },
        },
        requestId: 'request-123',
        identity: {
          sourceIp: '127.0.0.1',
        },
      } as any,
      headers: {
        'User-Agent': 'test-agent',
      },
    };

    it('should successfully start video processing', async () => {
      // Mock DynamoDB put
      dynamoMock.on(PutCommand).resolves({});

      // Mock Step Functions start execution
      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
        startDate: new Date(),
      });

      // Mock DynamoDB update
      dynamoMock.on(UpdateCommand).resolves({});

      const result = await processHandler(mockEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(202);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.capsuleId).toBeDefined();
      expect(body.data.videoId).toBe('dQw4w9WgXcQ');
      expect(body.data.status).toBe('processing');
      expect(body.data.executionArn).toBeDefined();
      expect(body.data.processingSteps).toContain('Video validation');
      expect(body.data.processingSteps).toContain('Summary generation');
      expect(body.data.processingSteps).not.toContain('Quiz generation');

      // Verify DynamoDB put was called
      expect(dynamoMock.commandCalls(PutCommand)).toHaveLength(1);
      const putCall = dynamoMock.commandCalls(PutCommand)[0];
      expect(putCall.args[0].input.Item.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(putCall.args[0].input.Item.userId).toBe('user-123');
      expect(putCall.args[0].input.Item.status).toBe('processing');

      // Verify Step Functions start execution was called
      expect(sfnMock.commandCalls(StartExecutionCommand)).toHaveLength(1);
      const sfnCall = sfnMock.commandCalls(StartExecutionCommand)[0];
      expect(sfnCall.args[0].input.stateMachineArn).toBe(process.env.VIDEO_PROCESSING_STATE_MACHINE_ARN);
      
      const input = JSON.parse(sfnCall.args[0].input.input);
      expect(input.userId).toBe('user-123');
      expect(input.videoId).toBe('dQw4w9WgXcQ');
      expect(input.options.generateQuiz).toBe(false);

      // Verify DynamoDB update was called
      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
    });

    it('should return 401 for unauthenticated user', async () => {
      const unauthenticatedEvent = {
        ...mockEvent,
        requestContext: {
          ...mockEvent.requestContext,
          authorizer: null,
        },
      };

      const result = await processHandler(unauthenticatedEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for missing video URL', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({}),
      };

      const result = await processHandler(invalidEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Video URL is required');
    });

    it('should return 400 for invalid YouTube URL', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          videoUrl: 'https://example.com/not-youtube',
        }),
      };

      const result = await processHandler(invalidEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_URL');
    });

    it('should return 409 for duplicate processing', async () => {
      // Mock DynamoDB put to throw ConditionalCheckFailedException
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutCommand).rejects(error);

      const result = await processHandler(mockEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('DUPLICATE_PROCESSING');
    });

    it('should return 500 for configuration error', async () => {
      // Remove state machine ARN
      delete process.env.VIDEO_PROCESSING_STATE_MACHINE_ARN;

      // Mock DynamoDB put
      dynamoMock.on(PutCommand).resolves({});

      const result = await processHandler(mockEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('CONFIGURATION_ERROR');

      // Restore environment variable
      process.env.VIDEO_PROCESSING_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';
    });

    it('should use default processing options when not provided', async () => {
      const eventWithoutOptions = {
        ...mockEvent,
        body: JSON.stringify({
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      };

      // Mock DynamoDB put
      dynamoMock.on(PutCommand).resolves({});

      // Mock Step Functions start execution
      sfnMock.on(StartExecutionCommand).resolves({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
        startDate: new Date(),
      });

      // Mock DynamoDB update
      dynamoMock.on(UpdateCommand).resolves({});

      const result = await processHandler(eventWithoutOptions as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(202);

      // Verify Step Functions was called with default options
      const sfnCall = sfnMock.commandCalls(StartExecutionCommand)[0];
      const input = JSON.parse(sfnCall.args[0].input.input);
      expect(input.options.generateSummary).toBe(true);
      expect(input.options.generateFlashcards).toBe(true);
      expect(input.options.generateQuiz).toBe(true);
      expect(input.options.generateMindMap).toBe(true);
      expect(input.options.generateNotes).toBe(true);
      expect(input.options.extractTranscript).toBe(true);
      expect(input.options.language).toBe('en');
    });
  });

  describe('statusHandler', () => {
    const mockStatusEvent: Partial<APIGatewayProxyEvent> = {
      pathParameters: {
        capsuleId: 'capsule-123',
      },
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-123',
          },
        },
      } as any,
    };

    it('should return processing status for active capsule', async () => {
      const mockCapsule = {
        id: 'capsule-123',
        videoId: 'dQw4w9WgXcQ',
        status: 'processing',
        progress: {
          completed: false,
          percentage: 50,
          currentStep: 'summary',
        },
        processingStatus: {
          validation: 'completed',
          transcript: 'completed',
          summary: 'pending',
          flashcards: 'pending',
        },
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
      };

      // Mock DynamoDB get
      dynamoMock.on(GetCommand).resolves({
        Item: mockCapsule,
      });

      // Mock Step Functions describe execution
      sfnMock.on(DescribeExecutionCommand).resolves({
        status: 'RUNNING',
        startDate: new Date(),
      });

      const result = await statusHandler(mockStatusEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.capsuleId).toBe('capsule-123');
      expect(body.data.status).toBe('processing');
      expect(body.data.progress.percentage).toBe(50);
      expect(body.data.executionStatus).toBe('RUNNING');
    });

    it('should return completed status without checking Step Functions', async () => {
      const mockCapsule = {
        id: 'capsule-123',
        videoId: 'dQw4w9WgXcQ',
        status: 'completed',
        progress: {
          completed: true,
          percentage: 100,
          currentStep: 'finalization',
        },
        processingStatus: {
          validation: 'completed',
          transcript: 'completed',
          summary: 'completed',
          flashcards: 'completed',
        },
        completedAt: '2023-01-01T00:00:00.000Z',
      };

      // Mock DynamoDB get
      dynamoMock.on(GetCommand).resolves({
        Item: mockCapsule,
      });

      const result = await statusHandler(mockStatusEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('completed');
      expect(body.data.completedAt).toBe('2023-01-01T00:00:00.000Z');

      // Verify Step Functions was not called
      expect(sfnMock.commandCalls(DescribeExecutionCommand)).toHaveLength(0);
    });

    it('should return 404 for non-existent capsule', async () => {
      // Mock DynamoDB get to return no item
      dynamoMock.on(GetCommand).resolves({});

      const result = await statusHandler(mockStatusEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('CAPSULE_NOT_FOUND');
    });

    it('should return 401 for unauthenticated user', async () => {
      const unauthenticatedEvent = {
        ...mockStatusEvent,
        requestContext: {
          authorizer: null,
        },
      };

      const result = await statusHandler(unauthenticatedEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for missing capsule ID', async () => {
      const invalidEvent = {
        ...mockStatusEvent,
        pathParameters: {},
      };

      const result = await statusHandler(invalidEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle Step Functions error gracefully', async () => {
      const mockCapsule = {
        id: 'capsule-123',
        videoId: 'dQw4w9WgXcQ',
        status: 'processing',
        progress: {
          completed: false,
          percentage: 25,
          currentStep: 'transcript',
        },
        processingStatus: {
          validation: 'completed',
          transcript: 'pending',
        },
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
      };

      // Mock DynamoDB get
      dynamoMock.on(GetCommand).resolves({
        Item: mockCapsule,
      });

      // Mock Step Functions to throw error
      sfnMock.on(DescribeExecutionCommand).rejects(new Error('Step Functions error'));

      const result = await statusHandler(mockStatusEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.capsuleId).toBe('capsule-123');
      expect(body.data.status).toBe('processing');
      // Should not have executionStatus due to error
      expect(body.data.executionStatus).toBeUndefined();
    });
  });
});