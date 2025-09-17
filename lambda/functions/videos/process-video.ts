import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';
import { validateYouTubeUrl, extractYouTubeVideoId } from '../../shared/validation';
import { v4 as uuidv4 } from 'uuid';

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ProcessVideoRequest {
  videoUrl: string;
  title?: string;
  description?: string;
  tags?: string[];
  options?: {
    generateSummary?: boolean;
    generateFlashcards?: boolean;
    generateQuiz?: boolean;
    generateMindMap?: boolean;
    generateNotes?: boolean;
    extractTranscript?: boolean;
    language?: string;
  };
}

interface ProcessVideoResponse {
  capsuleId: string;
  videoId: string;
  status: 'processing' | 'completed' | 'failed';
  estimatedCompletionTime: string;
  processingSteps: string[];
  executionArn?: string;
}

/**
 * Main video processing handler
 * Orchestrates the entire video processing pipeline using Step Functions
 */
async function processVideoHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const userEmail = event.requestContext.authorizer?.claims?.email;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  try {
    const requestBody: ProcessVideoRequest = JSON.parse(event.body || '{}');
    
    if (!requestBody.videoUrl) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Video URL is required');
    }

    // Validate YouTube URL
    if (!validateYouTubeUrl(requestBody.videoUrl)) {
      return createErrorResponse(400, 'INVALID_URL', 'Invalid YouTube URL format');
    }

    // Extract video ID
    const videoId = extractYouTubeVideoId(requestBody.videoUrl);
    if (!videoId) {
      return createErrorResponse(400, 'INVALID_URL', 'Could not extract video ID from URL');
    }

    // Generate unique capsule ID
    const capsuleId = uuidv4();
    const now = new Date().toISOString();

    // Set default processing options
    const options = {
      generateSummary: true,
      generateFlashcards: true,
      generateQuiz: true,
      generateMindMap: true,
      generateNotes: true,
      extractTranscript: true,
      language: 'en',
      ...requestBody.options,
    };

    logger.info('Starting video processing', {
      userId,
      userEmail,
      videoId,
      capsuleId,
      videoUrl: requestBody.videoUrl,
      options,
    });

    // Create initial learning capsule record
    const learningCapsule = {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
      GSI1PK: `CAPSULE#${capsuleId}`,
      GSI1SK: `USER#${userId}`,
      GSI2PK: `VIDEO#${videoId}`,
      GSI2SK: `USER#${userId}`,
      EntityType: 'LearningCapsule',
      id: capsuleId,
      userId,
      videoId,
      videoUrl: requestBody.videoUrl,
      title: requestBody.title || 'Processing...',
      description: requestBody.description || '',
      tags: requestBody.tags || [],
      status: 'processing' as const,
      processingOptions: options,
      processingStatus: {
        validation: 'pending',
        metadata: 'pending',
        transcript: options.extractTranscript ? 'pending' : 'skipped',
        summary: options.generateSummary ? 'pending' : 'skipped',
        flashcards: options.generateFlashcards ? 'pending' : 'skipped',
        quiz: options.generateQuiz ? 'pending' : 'skipped',
        mindMap: options.generateMindMap ? 'pending' : 'skipped',
        notes: options.generateNotes ? 'pending' : 'skipped',
      },
      progress: {
        completed: false,
        percentage: 0,
        currentStep: 'validation',
        estimatedTimeRemaining: null,
      },
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
    };

    // Store initial capsule in DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Item: learningCapsule,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));

    // Prepare Step Function execution input
    const stepFunctionInput = {
      userId,
      userEmail,
      capsuleId,
      videoId,
      videoUrl: requestBody.videoUrl,
      title: requestBody.title,
      description: requestBody.description,
      tags: requestBody.tags,
      options,
      metadata: {
        requestId: event.requestContext.requestId,
        sourceIp: event.requestContext.identity.sourceIp,
        userAgent: event.headers['User-Agent'],
        timestamp: now,
      },
    };

    // Start Step Function execution
    const stateMachineArn = process.env.VIDEO_PROCESSING_STATE_MACHINE_ARN;
    if (!stateMachineArn) {
      throw new Error('Video processing state machine not configured');
    }

    const executionName = `process-video-${capsuleId}-${Date.now()}`;
    const executionResult = await sfnClient.send(new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify(stepFunctionInput),
    }));

    // Update capsule with execution ARN
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: 'SET executionArn = :executionArn, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':executionArn': executionResult.executionArn,
        ':updatedAt': now,
      },
    }));

    // Calculate estimated completion time based on processing options
    const estimatedMinutes = calculateEstimatedProcessingTime(options);
    const estimatedCompletionTime = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();

    // Determine processing steps
    const processingSteps = getProcessingSteps(options);

    logger.info('Video processing started successfully', {
      userId,
      capsuleId,
      videoId,
      executionArn: executionResult.executionArn,
      estimatedMinutes,
      processingSteps,
    });

    const response: ProcessVideoResponse = {
      capsuleId,
      videoId,
      status: 'processing',
      estimatedCompletionTime,
      processingSteps,
      executionArn: executionResult.executionArn,
    };

    return createSuccessResponse(response, 202); // 202 Accepted
  } catch (error) {
    logger.error('Video processing failed to start', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(409, 'DUPLICATE_PROCESSING', 'Video is already being processed');
      }
      
      if (error.message.includes('state machine not configured')) {
        return createErrorResponse(500, 'CONFIGURATION_ERROR', 'Video processing service not configured');
      }
      
      if (error.message.includes('quota') || error.message.includes('throttle')) {
        return createErrorResponse(503, 'SERVICE_UNAVAILABLE', 'Video processing service temporarily unavailable');
      }
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to start video processing');
  }
}

/**
 * Get processing status for a video
 */
async function getProcessingStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const capsuleId = event.pathParameters?.capsuleId;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  if (!capsuleId) {
    return createErrorResponse(400, 'VALIDATION_ERROR', 'Capsule ID is required');
  }

  try {
    // Get capsule from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
    }));

    if (!result.Item) {
      return createErrorResponse(404, 'CAPSULE_NOT_FOUND', 'Learning capsule not found');
    }

    const capsule = result.Item;

    // If processing is complete, return the capsule data
    if (capsule.status === 'completed' || capsule.status === 'failed') {
      return createSuccessResponse({
        capsuleId: capsule.id,
        videoId: capsule.videoId,
        status: capsule.status,
        progress: capsule.progress,
        processingStatus: capsule.processingStatus,
        completedAt: capsule.completedAt,
        error: capsule.error,
      });
    }

    // If still processing, get status from Step Functions
    if (capsule.executionArn) {
      try {
        const executionStatus = await sfnClient.send(new DescribeExecutionCommand({
          executionArn: capsule.executionArn,
        }));

        // Update progress based on Step Function status
        const updatedProgress = await updateProgressFromExecution(executionStatus, capsule);

        return createSuccessResponse({
          capsuleId: capsule.id,
          videoId: capsule.videoId,
          status: capsule.status,
          progress: updatedProgress,
          processingStatus: capsule.processingStatus,
          executionStatus: executionStatus.status,
        });
      } catch (sfnError) {
        logger.warn('Failed to get Step Function status', {
          error: sfnError instanceof Error ? sfnError.message : 'Unknown error',
          executionArn: capsule.executionArn,
        });
      }
    }

    // Return current status from database
    return createSuccessResponse({
      capsuleId: capsule.id,
      videoId: capsule.videoId,
      status: capsule.status,
      progress: capsule.progress,
      processingStatus: capsule.processingStatus,
    });
  } catch (error) {
    logger.error('Failed to get processing status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to get processing status');
  }
}

/**
 * Calculate estimated processing time based on options
 */
function calculateEstimatedProcessingTime(options: any): number {
  let minutes = 2; // Base time for validation and metadata

  if (options.extractTranscript) minutes += 1;
  if (options.generateSummary) minutes += 2;
  if (options.generateFlashcards) minutes += 3;
  if (options.generateQuiz) minutes += 3;
  if (options.generateMindMap) minutes += 4;
  if (options.generateNotes) minutes += 2;

  return minutes;
}

/**
 * Get list of processing steps based on options
 */
function getProcessingSteps(options: any): string[] {
  const steps = [
    'Video validation',
    'Metadata extraction',
  ];

  if (options.extractTranscript) steps.push('Transcript extraction');
  if (options.generateSummary) steps.push('Summary generation');
  if (options.generateFlashcards) steps.push('Flashcard creation');
  if (options.generateQuiz) steps.push('Quiz generation');
  if (options.generateMindMap) steps.push('Mind map creation');
  if (options.generateNotes) steps.push('Notes generation');

  steps.push('Finalization');

  return steps;
}

/**
 * Update progress based on Step Function execution status
 */
async function updateProgressFromExecution(executionStatus: any, capsule: any): Promise<any> {
  // This would parse the Step Function execution history to determine current progress
  // For now, return the existing progress
  return capsule.progress;
}

// Export handlers
export const processHandler = createHandler(processVideoHandler);
export const statusHandler = createHandler(getProcessingStatusHandler);