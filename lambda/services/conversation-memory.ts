import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';

const logger = new Logger('ConversationMemoryService');

export interface StoredMessage {
  sessionId: string;
  userId: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    relatedConcepts?: string[];
    processingTime?: number;
    context?: Record<string, any>;
    originalResponse?: string;
  };
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  context?: {
    capsuleId?: string;
    videoId?: string;
    videoTitle?: string;
    difficulty?: string;
    learningGoals?: string[];
  };
  isActive: boolean;
}

export class ConversationMemoryService {
  private tableName: string;
  private sessionsTableName: string;

  constructor(private dynamoClient: DynamoDBDocumentClient) {
    this.tableName = process.env.CONVERSATIONS_TABLE || 'youtube-learning-conversations';
    this.sessionsTableName = process.env.CHAT_SESSIONS_TABLE || 'youtube-learning-chat-sessions';
  }

  async storeMessage(message: StoredMessage): Promise<void> {
    try {
      logger.info('Storing conversation message', {
        sessionId: message.sessionId,
        messageId: message.messageId,
        role: message.role,
      });

      // Store the message
      await this.dynamoClient.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `SESSION#${message.sessionId}`,
          SK: `MESSAGE#${message.timestamp}#${message.messageId}`,
          GSI1PK: `USER#${message.userId}`,
          GSI1SK: `SESSION#${message.sessionId}#${message.timestamp}`,
          sessionId: message.sessionId,
          userId: message.userId,
          messageId: message.messageId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata || {},
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
        },
      }));

      // Update session metadata
      await this.updateSessionActivity(message.sessionId, message.userId);

      logger.info('Message stored successfully', {
        sessionId: message.sessionId,
        messageId: message.messageId,
      });

    } catch (error) {
      logger.error('Error storing conversation message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: message.sessionId,
        messageId: message.messageId,
      });
      throw error;
    }
  }

  async getConversationHistory(
    sessionId: string,
    userId: string,
    limit: number = 50
  ): Promise<StoredMessage[]> {
    try {
      logger.info('Retrieving conversation history', {
        sessionId,
        userId,
        limit,
      });

      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `SESSION#${sessionId}`,
          ':userId': userId,
        },
        FilterExpression: 'userId = :userId',
        ScanIndexForward: false, // Get most recent first
        Limit: limit,
      }));

      const messages = (response.Items || []).map(item => ({
        sessionId: item.sessionId,
        userId: item.userId,
        messageId: item.messageId,
        role: item.role,
        content: item.content,
        timestamp: item.timestamp,
        metadata: item.metadata,
      })).reverse(); // Reverse to get chronological order

      logger.info('Retrieved conversation history', {
        sessionId,
        messageCount: messages.length,
      });

      return messages;

    } catch (error) {
      logger.error('Error retrieving conversation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async createSession(
    sessionId: string,
    userId: string,
    title: string,
    context?: ConversationSession['context']
  ): Promise<ConversationSession> {
    try {
      logger.info('Creating conversation session', {
        sessionId,
        userId,
        title,
      });

      const now = new Date().toISOString();
      const session: ConversationSession = {
        sessionId,
        userId,
        title,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        context,
        isActive: true,
      };

      await this.dynamoClient.send(new PutCommand({
        TableName: this.sessionsTableName,
        Item: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`,
          GSI1PK: `SESSION#${sessionId}`,
          GSI1SK: `USER#${userId}`,
          ...session,
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
        },
      }));

      logger.info('Session created successfully', {
        sessionId,
        userId,
      });

      return session;

    } catch (error) {
      logger.error('Error creating conversation session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async getSession(sessionId: string, userId: string): Promise<ConversationSession | null> {
    try {
      logger.info('Retrieving conversation session', {
        sessionId,
        userId,
      });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.sessionsTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`,
        },
      }));

      if (!response.Item) {
        logger.info('Session not found', { sessionId, userId });
        return null;
      }

      const session: ConversationSession = {
        sessionId: response.Item.sessionId,
        userId: response.Item.userId,
        title: response.Item.title,
        createdAt: response.Item.createdAt,
        updatedAt: response.Item.updatedAt,
        messageCount: response.Item.messageCount,
        context: response.Item.context,
        isActive: response.Item.isActive,
      };

      logger.info('Session retrieved successfully', {
        sessionId,
        messageCount: session.messageCount,
      });

      return session;

    } catch (error) {
      logger.error('Error retrieving conversation session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async getUserSessions(userId: string, limit: number = 20): Promise<ConversationSession[]> {
    try {
      logger.info('Retrieving user sessions', {
        userId,
        limit,
      });

      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.sessionsTableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
        },
        ScanIndexForward: false, // Get most recent first
        Limit: limit,
      }));

      const sessions = (response.Items || []).map(item => ({
        sessionId: item.sessionId,
        userId: item.userId,
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        messageCount: item.messageCount,
        context: item.context,
        isActive: item.isActive,
      }));

      logger.info('Retrieved user sessions', {
        userId,
        sessionCount: sessions.length,
      });

      return sessions;

    } catch (error) {
      logger.error('Error retrieving user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  async updateSessionContext(
    sessionId: string,
    userId: string,
    context: Partial<ConversationSession['context']>
  ): Promise<void> {
    try {
      logger.info('Updating session context', {
        sessionId,
        userId,
      });

      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.sessionsTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`,
        },
        UpdateExpression: 'SET #context = :context, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#context': 'context',
        },
        ExpressionAttributeValues: {
          ':context': context,
          ':updatedAt': new Date().toISOString(),
        },
      }));

      logger.info('Session context updated successfully', {
        sessionId,
        userId,
      });

    } catch (error) {
      logger.error('Error updating session context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw error;
    }
  }

  async endSession(sessionId: string, userId: string): Promise<void> {
    try {
      logger.info('Ending conversation session', {
        sessionId,
        userId,
      });

      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.sessionsTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`,
        },
        UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isActive': false,
          ':updatedAt': new Date().toISOString(),
        },
      }));

      logger.info('Session ended successfully', {
        sessionId,
        userId,
      });

    } catch (error) {
      logger.error('Error ending conversation session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      throw error;
    }
  }

  private async updateSessionActivity(sessionId: string, userId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.sessionsTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `SESSION#${sessionId}`,
        },
        UpdateExpression: 'SET updatedAt = :updatedAt, messageCount = if_not_exists(messageCount, :zero) + :inc',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
          ':zero': 0,
          ':inc': 1,
        },
      }));

    } catch (error) {
      logger.warn('Error updating session activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        userId,
      });
      // Don't throw error as this is not critical
    }
  }

  async deleteMessage(sessionId: string, messageId: string, timestamp: string): Promise<void> {
    try {
      logger.info('Deleting conversation message', {
        sessionId,
        messageId,
      });

      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: `MESSAGE#${timestamp}#${messageId}`,
        },
        UpdateExpression: 'SET #deleted = :deleted, deletedAt = :deletedAt',
        ExpressionAttributeNames: {
          '#deleted': 'deleted',
        },
        ExpressionAttributeValues: {
          ':deleted': true,
          ':deletedAt': new Date().toISOString(),
        },
      }));

      logger.info('Message deleted successfully', {
        sessionId,
        messageId,
      });

    } catch (error) {
      logger.error('Error deleting conversation message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        messageId,
      });
      throw error;
    }
  }

  async searchMessages(
    userId: string,
    query: string,
    sessionId?: string,
    limit: number = 20
  ): Promise<StoredMessage[]> {
    try {
      logger.info('Searching conversation messages', {
        userId,
        query,
        sessionId,
        limit,
      });

      // This is a simple implementation. In production, you'd want to use
      // ElasticSearch or similar for full-text search
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :userPK',
        ExpressionAttributeValues: {
          ':userPK': `USER#${userId}`,
        },
        Limit: limit * 2, // Get more items to filter
      };

      if (sessionId) {
        queryParams.FilterExpression = 'sessionId = :sessionId AND contains(content, :query)';
        queryParams.ExpressionAttributeValues[':sessionId'] = sessionId;
        queryParams.ExpressionAttributeValues[':query'] = query;
      } else {
        queryParams.FilterExpression = 'contains(content, :query)';
        queryParams.ExpressionAttributeValues[':query'] = query;
      }

      const response = await this.dynamoClient.send(new QueryCommand(queryParams));

      const messages = (response.Items || [])
        .map(item => ({
          sessionId: item.sessionId,
          userId: item.userId,
          messageId: item.messageId,
          role: item.role,
          content: item.content,
          timestamp: item.timestamp,
          metadata: item.metadata,
        }))
        .slice(0, limit);

      logger.info('Message search completed', {
        userId,
        query,
        resultCount: messages.length,
      });

      return messages;

    } catch (error) {
      logger.error('Error searching conversation messages', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        query,
      });
      throw error;
    }
  }
}