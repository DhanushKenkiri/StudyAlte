import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { validateRequest } from '../../shared/validation';
import { Logger } from '../../shared/logger';
import { createResponse } from '../../shared/response';
import { AITutorService } from '../../services/ai-tutor';
import { ConversationMemoryService } from '../../services/conversation-memory';
import { ContentContextService } from '../../services/content-context';
import { ResponseQualityService } from '../../services/response-quality';

const logger = new Logger('ai-tutor');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface ChatRequest {
  message: string;
  sessionId: string;
  userId: string;
  context?: {
    capsuleId?: string;
    videoId?: string;
    currentTranscript?: string;
    learningGoals?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    previousMessages?: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
  };
}

interface ChatResponse {
  messageId: string;
  content: string;
  timestamp: string;
  metadata: {
    confidence: number;
    sources?: string[];
    relatedConcepts?: string[];
    suggestedActions?: string[];
    processingTime: number;
  };
  suggestions?: string[];
  relatedTopics?: string[];
}

const aiTutorService = new AITutorService();
const conversationMemoryService = new ConversationMemoryService(dynamoClient);
const contentContextService = new ContentContextService(dynamoClient);
const responseQualityService = new ResponseQualityService();

const chatRequestSchema = {
  type: 'object',
  required: ['message', 'sessionId', 'userId'],
  properties: {
    message: {
      type: 'string',
      minLength: 1,
      maxLength: 2000,
    },
    sessionId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
    },
    userId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
    },
    context: {
      type: 'object',
      properties: {
        capsuleId: { type: 'string' },
        videoId: { type: 'string' },
        currentTranscript: { type: 'string' },
        learningGoals: {
          type: 'array',
          items: { type: 'string' },
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
        previousMessages: {
          type: 'array',
          items: {
            type: 'object',
            required: ['role', 'content', 'timestamp'],
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export const handler = createHandler(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    const body = JSON.parse(event.body || '{}');
    const validationResult = validateRequest(body, chatRequestSchema);
    
    if (!validationResult.isValid) {
      logger.warn('Invalid request', { errors: validationResult.errors });
      return createResponse(400, {
        error: 'Invalid request',
        details: validationResult.errors,
      });
    }

    const request: ChatRequest = body;
    const { message, sessionId, userId, context } = request;

    logger.info('Processing AI tutor request', {
      sessionId,
      userId,
      messageLength: message.length,
      hasContext: !!context,
    });

    // Load conversation memory
    const conversationHistory = await conversationMemoryService.getConversationHistory(
      sessionId,
      userId,
      10 // Last 10 messages for context
    );

    // Enhance context with content information
    const enhancedContext = await contentContextService.enhanceContext({
      ...context,
      conversationHistory,
      sessionId,
      userId,
    });

    // Generate AI response
    const aiResponse = await aiTutorService.generateResponse({
      message,
      context: enhancedContext,
      conversationHistory,
    });

    // Apply quality filtering and safety measures
    const filteredResponse = await responseQualityService.filterResponse(aiResponse, {
      userId,
      sessionId,
      originalMessage: message,
    });

    // Store conversation in memory
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await Promise.all([
      // Store user message
      conversationMemoryService.storeMessage({
        sessionId,
        userId,
        messageId: `user_${messageId}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        metadata: {
          context: context || {},
        },
      }),
      // Store AI response
      conversationMemoryService.storeMessage({
        sessionId,
        userId,
        messageId,
        role: 'assistant',
        content: filteredResponse.content,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: filteredResponse.confidence,
          sources: filteredResponse.sources,
          relatedConcepts: filteredResponse.relatedConcepts,
          processingTime: Date.now() - startTime,
          originalResponse: aiResponse.content !== filteredResponse.content ? aiResponse.content : undefined,
        },
      }),
    ]);

    // Generate follow-up suggestions
    const suggestions = await aiTutorService.generateSuggestions({
      message,
      response: filteredResponse.content,
      context: enhancedContext,
    });

    const response: ChatResponse = {
      messageId,
      content: filteredResponse.content,
      timestamp: new Date().toISOString(),
      metadata: {
        confidence: filteredResponse.confidence,
        sources: filteredResponse.sources,
        relatedConcepts: filteredResponse.relatedConcepts,
        suggestedActions: filteredResponse.suggestedActions,
        processingTime: Date.now() - startTime,
      },
      suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
      relatedTopics: filteredResponse.relatedTopics,
    };

    logger.info('AI tutor response generated successfully', {
      sessionId,
      userId,
      messageId,
      confidence: filteredResponse.confidence,
      processingTime: Date.now() - startTime,
    });

    return createResponse(200, response);

  } catch (error) {
    logger.error('Error processing AI tutor request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return createResponse(500, {
      error: 'Internal server error',
      message: 'Failed to process AI tutor request',
    });
  }
});