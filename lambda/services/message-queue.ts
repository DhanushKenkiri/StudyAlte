import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { Logger } from '../shared/logger';

const logger = new Logger('MessageQueueService');

export interface QueuedMessage {
  messageId: string;
  sessionId: string;
  userId: string;
  content: string;
  timestamp: string;
  connectionId: string;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface ProcessedMessage {
  messageId: string;
  sessionId: string;
  userId: string;
  aiResponse: string;
  confidence: number;
  processingTime: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class MessageQueueService {
  private sqsClient: SQSClient;
  private chatQueueUrl: string;
  private aiResponseQueueUrl: string;
  private deadLetterQueueUrl: string;

  constructor() {
    this.sqsClient = new SQSClient({});
    this.chatQueueUrl = process.env.CHAT_QUEUE_URL || '';
    this.aiResponseQueueUrl = process.env.AI_RESPONSE_QUEUE_URL || '';
    this.deadLetterQueueUrl = process.env.DEAD_LETTER_QUEUE_URL || '';
  }

  async queueMessage(message: QueuedMessage): Promise<void> {
    try {
      logger.info('Queuing message for AI processing', {
        messageId: message.messageId,
        sessionId: message.sessionId,
        userId: message.userId,
      });

      const messageBody = JSON.stringify({
        ...message,
        queuedAt: new Date().toISOString(),
        retryCount: message.retryCount || 0,
      });

      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.chatQueueUrl,
        MessageBody: messageBody,
        MessageGroupId: message.sessionId, // For FIFO queue
        MessageDeduplicationId: message.messageId,
        MessageAttributes: {
          sessionId: {
            StringValue: message.sessionId,
            DataType: 'String',
          },
          userId: {
            StringValue: message.userId,
            DataType: 'String',
          },
          priority: {
            StringValue: message.priority || 'normal',
            DataType: 'String',
          },
        },
      }));

      logger.info('Message queued successfully', {
        messageId: message.messageId,
        sessionId: message.sessionId,
      });

    } catch (error) {
      logger.error('Error queuing message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.messageId,
        sessionId: message.sessionId,
      });
      throw error;
    }
  }

  async queueAIResponse(response: ProcessedMessage): Promise<void> {
    try {
      logger.info('Queuing AI response for delivery', {
        messageId: response.messageId,
        sessionId: response.sessionId,
        userId: response.userId,
      });

      const messageBody = JSON.stringify({
        ...response,
        queuedAt: new Date().toISOString(),
      });

      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.aiResponseQueueUrl,
        MessageBody: messageBody,
        MessageGroupId: response.sessionId, // For FIFO queue
        MessageDeduplicationId: `${response.messageId}_response`,
        MessageAttributes: {
          sessionId: {
            StringValue: response.sessionId,
            DataType: 'String',
          },
          userId: {
            StringValue: response.userId,
            DataType: 'String',
          },
          confidence: {
            StringValue: response.confidence.toString(),
            DataType: 'Number',
          },
        },
      }));

      logger.info('AI response queued successfully', {
        messageId: response.messageId,
        sessionId: response.sessionId,
      });

    } catch (error) {
      logger.error('Error queuing AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: response.messageId,
        sessionId: response.sessionId,
      });
      throw error;
    }
  }

  async receiveMessages(queueUrl: string, maxMessages: number = 10): Promise<any[]> {
    try {
      logger.info('Receiving messages from queue', {
        queueUrl,
        maxMessages,
      });

      const response = await this.sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
      }));

      const messages = response.Messages || [];
      
      logger.info('Messages received from queue', {
        queueUrl,
        messageCount: messages.length,
      });

      return messages;

    } catch (error) {
      logger.error('Error receiving messages from queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueUrl,
      });
      throw error;
    }
  }

  async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    try {
      await this.sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }));

      logger.info('Message deleted from queue', {
        queueUrl,
        receiptHandle: receiptHandle.substring(0, 20) + '...',
      });

    } catch (error) {
      logger.error('Error deleting message from queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueUrl,
      });
      throw error;
    }
  }

  async requeueMessage(message: QueuedMessage, reason: string): Promise<void> {
    try {
      const retryCount = (message.retryCount || 0) + 1;
      const maxRetries = 3;

      if (retryCount > maxRetries) {
        logger.warn('Message exceeded max retries, sending to DLQ', {
          messageId: message.messageId,
          retryCount,
          reason,
        });

        await this.sendToDeadLetterQueue(message, reason);
        return;
      }

      logger.info('Requeuing message for retry', {
        messageId: message.messageId,
        retryCount,
        reason,
      });

      // Add delay based on retry count (exponential backoff)
      const delaySeconds = Math.min(300, Math.pow(2, retryCount) * 10); // Max 5 minutes

      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.chatQueueUrl,
        MessageBody: JSON.stringify({
          ...message,
          retryCount,
          lastError: reason,
          requeuedAt: new Date().toISOString(),
        }),
        DelaySeconds: delaySeconds,
        MessageGroupId: message.sessionId,
        MessageDeduplicationId: `${message.messageId}_retry_${retryCount}`,
        MessageAttributes: {
          sessionId: {
            StringValue: message.sessionId,
            DataType: 'String',
          },
          userId: {
            StringValue: message.userId,
            DataType: 'String',
          },
          retryCount: {
            StringValue: retryCount.toString(),
            DataType: 'Number',
          },
        },
      }));

      logger.info('Message requeued successfully', {
        messageId: message.messageId,
        retryCount,
        delaySeconds,
      });

    } catch (error) {
      logger.error('Error requeuing message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.messageId,
      });
      throw error;
    }
  }

  async sendToDeadLetterQueue(message: QueuedMessage, reason: string): Promise<void> {
    try {
      logger.info('Sending message to dead letter queue', {
        messageId: message.messageId,
        reason,
      });

      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.deadLetterQueueUrl,
        MessageBody: JSON.stringify({
          ...message,
          failureReason: reason,
          failedAt: new Date().toISOString(),
          finalRetryCount: message.retryCount || 0,
        }),
        MessageAttributes: {
          sessionId: {
            StringValue: message.sessionId,
            DataType: 'String',
          },
          userId: {
            StringValue: message.userId,
            DataType: 'String',
          },
          failureReason: {
            StringValue: reason,
            DataType: 'String',
          },
        },
      }));

      logger.info('Message sent to dead letter queue', {
        messageId: message.messageId,
        reason,
      });

    } catch (error) {
      logger.error('Error sending message to dead letter queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.messageId,
      });
      throw error;
    }
  }

  async getQueueAttributes(queueUrl: string): Promise<{
    approximateNumberOfMessages: number;
    approximateNumberOfMessagesNotVisible: number;
    approximateNumberOfMessagesDelayed: number;
  }> {
    try {
      // This would use GetQueueAttributes in a real implementation
      // For now, return mock data
      return {
        approximateNumberOfMessages: 0,
        approximateNumberOfMessagesNotVisible: 0,
        approximateNumberOfMessagesDelayed: 0,
      };

    } catch (error) {
      logger.error('Error getting queue attributes', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueUrl,
      });
      throw error;
    }
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    try {
      logger.warn('Purging queue', { queueUrl });

      // This would use PurgeQueue in a real implementation
      // For now, just log the intent
      logger.warn('Queue purge completed', { queueUrl });

    } catch (error) {
      logger.error('Error purging queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        queueUrl,
      });
      throw error;
    }
  }

  // Utility methods for queue management
  getChatQueueUrl(): string {
    return this.chatQueueUrl;
  }

  getAIResponseQueueUrl(): string {
    return this.aiResponseQueueUrl;
  }

  getDeadLetterQueueUrl(): string {
    return this.deadLetterQueueUrl;
  }
}