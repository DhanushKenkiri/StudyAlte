import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { validateRequest } from '../../shared/validation';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { ConversationMemoryService } from '../../services/conversation-memory';

const logger = new Logger('create-session');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const conversationMemoryService = new ConversationMemoryService(dynamoClient);

interface CreateSessionRequest {
  userId: string;
  title?: string;
  context?: {
    capsuleId?: string;
    videoId?: string;
    videoTitle?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    learningGoals?: string[];
  };
}

const createSessionSchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
    context: {
      type: 'object',
      properties: {
        capsuleId: { type: 'string' },
        videoId: { type: 'string' },
        videoTitle: { type: 'string' },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
        learningGoals: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
};

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate request
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateRequest(body, createSessionSchema);
    
    if (!validationResult.isValid) {
      logger.warn('Invalid request', { errors: validationResult.errors });
      return createResponse(400, {
        error: 'Invalid request',
        details: validationResult.errors,
      });
    }

    const request: CreateSessionRequest = body;
    const { userId, title, context } = request;

    logger.info('Creating chat session', {
      userId,
      hasTitle: !!title,
      hasContext: !!context,
    });

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate title if not provided
    const sessionTitle = title || this.generateSessionTitle(context);

    // Create session
    const session = await conversationMemoryService.createSession(
      sessionId,
      userId,
      sessionTitle,
      context
    );

    logger.info('Chat session created successfully', {
      sessionId,
      userId,
      title: sessionTitle,
    });

    return createResponse(201, {
      sessionId: session.sessionId,
      title: session.title,
      createdAt: session.createdAt,
      context: session.context,
    });

  } catch (error) {
    logger.error('Error creating chat session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to create chat session',
    });
  }
});

function generateSessionTitle(context?: CreateSessionRequest['context']): string {
  if (context?.videoTitle) {
    return `Chat about ${context.videoTitle}`;
  }
  
  if (context?.learningGoals && context.learningGoals.length > 0) {
    return `Learning ${context.learningGoals[0]}`;
  }
  
  const now = new Date();
  return `Chat Session - ${now.toLocaleDateString()}`;
}