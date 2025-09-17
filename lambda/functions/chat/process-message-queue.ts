import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { AITutorService } from '../../services/ai-tutor';
import { ConversationMemoryService } from '../../services/conversation-memory';
import { ContentContextService } from '../../services/content-context';
import { ResponseQualityService } from '../../services/response-quality';
import { MessageQueueService, QueuedMessage } from '../../services/message-queue';

const logger = new Logger('process-message-queue');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const aiTutorService = new AITutorService();
const conversationMemoryService = new ConversationMemoryService(dynamoClient);
const contentContextService = new ContentContextService(dynamoClient);
const responseQualityService = new ResponseQualityService();
const messageQueueService = new MessageQueueService();

export const handler = createHandler(async (event: SQSEvent): Promise<void> => {
  logger.info('Processing message queue batch', {
    recordCount: event.Records.length,
  });

  // Process messages in parallel with controlled concurrency
  const processingPromises = event.Records.map(record => 
    processMessage(record).catch(error => {
      logger.error('Error processing individual message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: record.messageId,
      });
      // Don't throw to avoid failing the entire batch
      return null;
    })
  );

  await Promise.allSettled(processingPromises);

  logger.info('Message queue batch processing completed', {
    recordCount: event.Records.length,
  });
});

async function processMessage(record: SQSRecord): Promise<void> {
  const startTime = Date.now();
  
  try {
    const queuedMessage: QueuedMessage = JSON.parse(record.body);
    
    logger.info('Processing queued message', {
      messageId: queuedMessage.messageId,
      sessionId: queuedMessage.sessionId,
      userId: queuedMessage.userId,
      retryCount: queuedMessage.retryCount || 0,
    });

    // Load conversation history
    const conversationHistory = await conversationMemoryService.getConversationHistory(
      queuedMessage.sessionId,
      queuedMessage.userId,
      10 // Last 10 messages for context
    );

    // Enhance context with content information
    const enhancedContext = await contentContextService.enhanceContext({
      sessionId: queuedMessage.sessionId,
      userId: queuedMessage.userId,
      conversationHistory,
      ...queuedMessage.metadata?.context,
    });

    // Generate AI response
    const aiResponse = await aiTutorService.generateResponse({
      message: queuedMessage.content,
      context: enhancedContext,
      conversationHistory,
    });

    // Apply quality filtering and safety measures
    const filteredResponse = await responseQualityService.filterResponse(aiResponse, {
      userId: queuedMessage.userId,
      sessionId: queuedMessage.sessionId,
      originalMessage: queuedMessage.content,
    });

    // Store AI response in conversation history
    const responseMessageId = `${queuedMessage.messageId}_response`;
    
    await conversationMemoryService.storeMessage({
      sessionId: queuedMessage.sessionId,
      userId: queuedMessage.userId,
      messageId: responseMessageId,
      role: 'assistant',
      content: filteredResponse.content,
      timestamp: new Date().toISOString(),
      metadata: {
        confidence: filteredResponse.confidence,
        sources: filteredResponse.sources,
        relatedConcepts: filteredResponse.relatedConcepts,
        processingTime: Date.now() - startTime,
        originalMessageId: queuedMessage.messageId,
        wasFiltered: filteredResponse.wasFiltered,
        filterReasons: filteredResponse.filterReasons,
      },
    });

    // Generate follow-up suggestions
    const suggestions = await aiTutorService.generateSuggestions({
      message: queuedMessage.content,
      response: filteredResponse.content,
      context: enhancedContext,
    });

    // Queue AI response for delivery
    await messageQueueService.queueAIResponse({
      messageId: responseMessageId,
      sessionId: queuedMessage.sessionId,
      userId: queuedMessage.userId,
      aiResponse: filteredResponse.content,
      confidence: filteredResponse.confidence,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      metadata: {
        originalMessageId: queuedMessage.messageId,
        originalConnectionId: queuedMessage.connectionId,
        sources: filteredResponse.sources,
        relatedConcepts: filteredResponse.relatedConcepts,
        suggestedActions: filteredResponse.suggestedActions,
        suggestions: suggestions.slice(0, 3),
        relatedTopics: filteredResponse.relatedTopics,
        wasFiltered: filteredResponse.wasFiltered,
      },
    });

    logger.info('Message processed successfully', {
      messageId: queuedMessage.messageId,
      responseMessageId,
      processingTime: Date.now() - startTime,
      confidence: filteredResponse.confidence,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Error processing queued message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: record.messageId,
      processingTime,
    });

    // Parse message to get details for requeuing
    try {
      const queuedMessage: QueuedMessage = JSON.parse(record.body);
      
      // Requeue message with retry logic
      await messageQueueService.requeueMessage(
        queuedMessage,
        error instanceof Error ? error.message : 'Unknown processing error'
      );
      
    } catch (requeueError) {
      logger.error('Failed to requeue message', {
        error: requeueError instanceof Error ? requeueError.message : 'Unknown error',
        originalError: error instanceof Error ? error.message : 'Unknown error',
        messageId: record.messageId,
      });
    }

    throw error;
  }
}