import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';

const logger = new Logger('WebSocketConnectionService');

export interface WebSocketConnection {
  connectionId: string;
  userId: string;
  sessionId?: string;
  connectedAt: string;
  lastActivity: string;
  status: 'connected' | 'disconnected' | 'idle';
  metadata?: {
    userAgent?: string;
    origin?: string;
    [key: string]: any;
  };
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string;
  activeConnections: number;
  currentSessions: string[];
}

export interface SessionRoom {
  sessionId: string;
  connectionId: string;
  userId: string;
  joinedAt: string;
}

export class WebSocketConnectionService {
  private connectionsTableName: string;
  private presenceTableName: string;
  private sessionRoomsTableName: string;

  constructor(private dynamoClient: DynamoDBDocumentClient) {
    this.connectionsTableName = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'youtube-learning-websocket-connections';
    this.presenceTableName = process.env.USER_PRESENCE_TABLE || 'youtube-learning-user-presence';
    this.sessionRoomsTableName = process.env.SESSION_ROOMS_TABLE || 'youtube-learning-session-rooms';
  }

  async storeConnection(connection: WebSocketConnection): Promise<void> {
    try {
      logger.info('Storing WebSocket connection', {
        connectionId: connection.connectionId,
        userId: connection.userId,
        sessionId: connection.sessionId,
      });

      await this.dynamoClient.send(new PutCommand({
        TableName: this.connectionsTableName,
        Item: {
          PK: `CONNECTION#${connection.connectionId}`,
          SK: 'METADATA',
          GSI1PK: `USER#${connection.userId}`,
          GSI1SK: `CONNECTION#${connection.connectionId}`,
          connectionId: connection.connectionId,
          userId: connection.userId,
          sessionId: connection.sessionId,
          connectedAt: connection.connectedAt,
          lastActivity: connection.lastActivity,
          status: connection.status,
          metadata: connection.metadata || {},
          ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours TTL
        },
      }));

      logger.info('WebSocket connection stored successfully', {
        connectionId: connection.connectionId,
        userId: connection.userId,
      });

    } catch (error) {
      logger.error('Error storing WebSocket connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId: connection.connectionId,
        userId: connection.userId,
      });
      throw error;
    }
  }

  async getConnection(connectionId: string): Promise<WebSocketConnection | null> {
    try {
      logger.info('Retrieving WebSocket connection', { connectionId });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.connectionsTableName,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: 'METADATA',
        },
      }));

      if (!response.Item) {
        logger.info('WebSocket connection not found', { connectionId });
        return null;
      }

      const connection: WebSocketConnection = {
        connectionId: response.Item.connectionId,
        userId: response.Item.userId,
        sessionId: response.Item.sessionId,
        connectedAt: response.Item.connectedAt,
        lastActivity: response.Item.lastActivity,
        status: response.Item.status,
        metadata: response.Item.metadata,
      };

      logger.info('WebSocket connection retrieved successfully', {
        connectionId,
        userId: connection.userId,
      });

      return connection;

    } catch (error) {
      logger.error('Error retrieving WebSocket connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
      });
      throw error;
    }
  }

  async removeConnection(connectionId: string): Promise<void> {
    try {
      logger.info('Removing WebSocket connection', { connectionId });

      // Get connection details first
      const connection = await this.getConnection(connectionId);
      
      if (connection) {
        // Remove from session rooms if applicable
        if (connection.sessionId) {
          await this.leaveSessionRoom(connectionId, connection.sessionId);
        }

        // Remove connection record
        await this.dynamoClient.send(new DeleteCommand({
          TableName: this.connectionsTableName,
          Key: {
            PK: `CONNECTION#${connectionId}`,
            SK: 'METADATA',
          },
        }));

        logger.info('WebSocket connection removed successfully', {
          connectionId,
          userId: connection.userId,
        });
      }

    } catch (error) {
      logger.error('Error removing WebSocket connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
      });
      throw error;
    }
  }

  async updateLastActivity(connectionId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.connectionsTableName,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET lastActivity = :lastActivity, #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':lastActivity': new Date().toISOString(),
          ':status': 'connected',
        },
      }));

    } catch (error) {
      logger.warn('Error updating connection last activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
      });
      // Don't throw error as this is not critical
    }
  }

  async updateConnectionSession(connectionId: string, sessionId: string | null): Promise<void> {
    try {
      logger.info('Updating connection session', { connectionId, sessionId });

      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.connectionsTableName,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET sessionId = :sessionId, lastActivity = :lastActivity',
        ExpressionAttributeValues: {
          ':sessionId': sessionId,
          ':lastActivity': new Date().toISOString(),
        },
      }));

      logger.info('Connection session updated successfully', {
        connectionId,
        sessionId,
      });

    } catch (error) {
      logger.error('Error updating connection session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
        sessionId,
      });
      throw error;
    }
  }

  async getUserConnections(userId: string): Promise<WebSocketConnection[]> {
    try {
      logger.info('Retrieving user connections', { userId });

      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.connectionsTableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :userPK',
        ExpressionAttributeValues: {
          ':userPK': `USER#${userId}`,
        },
      }));

      const connections = (response.Items || []).map(item => ({
        connectionId: item.connectionId,
        userId: item.userId,
        sessionId: item.sessionId,
        connectedAt: item.connectedAt,
        lastActivity: item.lastActivity,
        status: item.status,
        metadata: item.metadata,
      }));

      logger.info('User connections retrieved successfully', {
        userId,
        connectionCount: connections.length,
      });

      return connections;

    } catch (error) {
      logger.error('Error retrieving user connections', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  async updateUserPresence(userId: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    try {
      logger.info('Updating user presence', { userId, status });

      const connections = await this.getUserConnections(userId);
      const activeConnections = connections.filter(conn => conn.status === 'connected').length;
      const currentSessions = Array.from(new Set(
        connections
          .filter(conn => conn.sessionId)
          .map(conn => conn.sessionId!)
      ));

      await this.dynamoClient.send(new PutCommand({
        TableName: this.presenceTableName,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PRESENCE',
          userId,
          status,
          lastSeen: new Date().toISOString(),
          activeConnections,
          currentSessions,
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
        },
      }));

      logger.info('User presence updated successfully', {
        userId,
        status,
        activeConnections,
        currentSessions: currentSessions.length,
      });

    } catch (error) {
      logger.error('Error updating user presence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        status,
      });
      throw error;
    }
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      logger.info('Retrieving user presence', { userId });

      const response = await this.dynamoClient.send(new GetCommand({
        TableName: this.presenceTableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PRESENCE',
        },
      }));

      if (!response.Item) {
        logger.info('User presence not found', { userId });
        return null;
      }

      const presence: UserPresence = {
        userId: response.Item.userId,
        status: response.Item.status,
        lastSeen: response.Item.lastSeen,
        activeConnections: response.Item.activeConnections,
        currentSessions: response.Item.currentSessions || [],
      };

      logger.info('User presence retrieved successfully', {
        userId,
        status: presence.status,
      });

      return presence;

    } catch (error) {
      logger.error('Error retrieving user presence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  async joinSessionRoom(connectionId: string, sessionId: string): Promise<void> {
    try {
      logger.info('Joining session room', { connectionId, sessionId });

      const connection = await this.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      await this.dynamoClient.send(new PutCommand({
        TableName: this.sessionRoomsTableName,
        Item: {
          PK: `SESSION#${sessionId}`,
          SK: `CONNECTION#${connectionId}`,
          GSI1PK: `CONNECTION#${connectionId}`,
          GSI1SK: `SESSION#${sessionId}`,
          sessionId,
          connectionId,
          userId: connection.userId,
          joinedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours TTL
        },
      }));

      logger.info('Joined session room successfully', {
        connectionId,
        sessionId,
        userId: connection.userId,
      });

    } catch (error) {
      logger.error('Error joining session room', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
        sessionId,
      });
      throw error;
    }
  }

  async leaveSessionRoom(connectionId: string, sessionId: string): Promise<void> {
    try {
      logger.info('Leaving session room', { connectionId, sessionId });

      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.sessionRoomsTableName,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: `CONNECTION#${connectionId}`,
        },
      }));

      logger.info('Left session room successfully', {
        connectionId,
        sessionId,
      });

    } catch (error) {
      logger.error('Error leaving session room', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
        sessionId,
      });
      throw error;
    }
  }

  async getSessionConnections(sessionId: string): Promise<SessionRoom[]> {
    try {
      logger.info('Retrieving session connections', { sessionId });

      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.sessionRoomsTableName,
        KeyConditionExpression: 'PK = :sessionPK',
        ExpressionAttributeValues: {
          ':sessionPK': `SESSION#${sessionId}`,
        },
      }));

      const connections = (response.Items || []).map(item => ({
        sessionId: item.sessionId,
        connectionId: item.connectionId,
        userId: item.userId,
        joinedAt: item.joinedAt,
      }));

      logger.info('Session connections retrieved successfully', {
        sessionId,
        connectionCount: connections.length,
      });

      return connections;

    } catch (error) {
      logger.error('Error retrieving session connections', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      throw error;
    }
  }

  async getConnectionSessions(connectionId: string): Promise<SessionRoom[]> {
    try {
      logger.info('Retrieving connection sessions', { connectionId });

      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.sessionRoomsTableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :connectionPK',
        ExpressionAttributeValues: {
          ':connectionPK': `CONNECTION#${connectionId}`,
        },
      }));

      const sessions = (response.Items || []).map(item => ({
        sessionId: item.sessionId,
        connectionId: item.connectionId,
        userId: item.userId,
        joinedAt: item.joinedAt,
      }));

      logger.info('Connection sessions retrieved successfully', {
        connectionId,
        sessionCount: sessions.length,
      });

      return sessions;

    } catch (error) {
      logger.error('Error retrieving connection sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
      });
      throw error;
    }
  }

  async cleanupStaleConnections(maxAgeMinutes: number = 60): Promise<number> {
    try {
      logger.info('Cleaning up stale connections', { maxAgeMinutes });

      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
      let cleanedCount = 0;

      // This is a simplified cleanup - in production, you'd want to scan and clean in batches
      // For now, we'll just log the intent
      logger.info('Stale connection cleanup completed', {
        cutoffTime,
        cleanedCount,
      });

      return cleanedCount;

    } catch (error) {
      logger.error('Error cleaning up stale connections', {
        error: error instanceof Error ? error.message : 'Unknown error',
        maxAgeMinutes,
      });
      throw error;
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      // This would require a more complex query in production
      // For now, return a placeholder
      return 0;
    } catch (error) {
      logger.error('Error getting active sessions count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async getOnlineUsersCount(): Promise<number> {
    try {
      // This would require a more complex query in production
      // For now, return a placeholder
      return 0;
    } catch (error) {
      logger.error('Error getting online users count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}