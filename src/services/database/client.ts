// DynamoDB client configuration and utilities

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  TransactGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWS_CONFIG, LIMITS } from '@/utils/constants';
import { DatabaseError, NotFoundError } from '@/types/errors';

// DynamoDB client configuration
const dynamoClient = new DynamoDBClient({
  region: AWS_CONFIG.REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Table name from environment or default
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'youtube-learning-platform-main';

// Query and operation utilities
export class DynamoDBOperations {
  // Get single item
  static async getItem<T>(
    partitionKey: string,
    sortKey: string,
    consistentRead: boolean = false
  ): Promise<T | null> {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: partitionKey,
          SK: sortKey,
        },
        ConsistentRead: consistentRead,
      });

      const result = await docClient.send(command);
      return result.Item as T || null;
    } catch (error) {
      throw new DatabaseError(
        'DB_RECORD_NOT_FOUND',
        `Failed to get item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { partitionKey, sortKey }
      );
    }
  }

  // Put single item
  static async putItem<T>(
    item: T,
    conditionExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, unknown>
  ): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      });

      await docClient.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        throw new DatabaseError(
          'DB_CONSTRAINT_VIOLATION',
          'Item already exists or condition not met',
          { item }
        );
      }
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to put item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { item }
      );
    }
  }

  // Update single item
  static async updateItem(
    partitionKey: string,
    sortKey: string,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, unknown>,
    conditionExpression?: string
  ): Promise<void> {
    try {
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: partitionKey,
          SK: sortKey,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
      });

      await docClient.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        throw new NotFoundError('Item not found or condition not met');
      }
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { partitionKey, sortKey }
      );
    }
  }

  // Delete single item
  static async deleteItem(
    partitionKey: string,
    sortKey: string,
    conditionExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, unknown>
  ): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: partitionKey,
          SK: sortKey,
        },
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      });

      await docClient.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        throw new NotFoundError('Item not found or condition not met');
      }
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { partitionKey, sortKey }
      );
    }
  }

  // Query items
  static async queryItems<T>(
    partitionKey: string,
    sortKeyCondition?: string,
    indexName?: string,
    filterExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, unknown>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>,
    scanIndexForward: boolean = true,
    consistentRead: boolean = false
  ): Promise<{
    items: T[];
    lastEvaluatedKey?: Record<string, unknown>;
    count: number;
  }> {
    try {
      let keyConditionExpression = `PK = :pk`;
      const attributeValues: Record<string, unknown> = { ':pk': partitionKey };

      if (sortKeyCondition) {
        keyConditionExpression += ` AND ${sortKeyCondition}`;
      }

      // Merge provided expression attribute values
      if (expressionAttributeValues) {
        Object.assign(attributeValues, expressionAttributeValues);
      }

      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: attributeValues,
        Limit: limit || LIMITS.MAX_SEARCH_RESULTS,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: scanIndexForward,
        ConsistentRead: consistentRead && !indexName, // Consistent read not supported on GSI
      });

      const result = await docClient.send(command);

      return {
        items: (result.Items as T[]) || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    } catch (error) {
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to query items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { partitionKey, indexName }
      );
    }
  }

  // Scan items (use sparingly)
  static async scanItems<T>(
    filterExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, unknown>,
    limit?: number,
    exclusiveStartKey?: Record<string, unknown>,
    indexName?: string
  ): Promise<{
    items: T[];
    lastEvaluatedKey?: Record<string, unknown>;
    count: number;
  }> {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        IndexName: indexName,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit || LIMITS.MAX_SEARCH_RESULTS,
        ExclusiveStartKey: exclusiveStartKey,
      });

      const result = await docClient.send(command);

      return {
        items: (result.Items as T[]) || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    } catch (error) {
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to scan items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { indexName }
      );
    }
  }

  // Batch get items
  static async batchGetItems<T>(
    keys: Array<{ PK: string; SK: string }>,
    consistentRead: boolean = false
  ): Promise<T[]> {
    try {
      // DynamoDB batch get has a limit of 100 items
      const batches = [];
      for (let i = 0; i < keys.length; i += 100) {
        batches.push(keys.slice(i, i + 100));
      }

      const allItems: T[] = [];

      for (const batch of batches) {
        const command = new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: batch,
              ConsistentRead: consistentRead,
            },
          },
        });

        const result = await docClient.send(command);
        const items = result.Responses?.[TABLE_NAME] as T[] || [];
        allItems.push(...items);
      }

      return allItems;
    } catch (error) {
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to batch get items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { keyCount: keys.length }
      );
    }
  }

  // Batch write items (put/delete)
  static async batchWriteItems(
    putItems?: unknown[],
    deleteKeys?: Array<{ PK: string; SK: string }>
  ): Promise<void> {
    try {
      const writeRequests = [];

      if (putItems) {
        writeRequests.push(
          ...putItems.map(item => ({
            PutRequest: { Item: item },
          }))
        );
      }

      if (deleteKeys) {
        writeRequests.push(
          ...deleteKeys.map(key => ({
            DeleteRequest: { Key: key },
          }))
        );
      }

      // DynamoDB batch write has a limit of 25 items
      const batches = [];
      for (let i = 0; i < writeRequests.length; i += 25) {
        batches.push(writeRequests.slice(i, i + 25));
      }

      for (const batch of batches) {
        const command = new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        });

        await docClient.send(command);
      }
    } catch (error) {
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to batch write items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { putCount: putItems?.length || 0, deleteCount: deleteKeys?.length || 0 }
      );
    }
  }

  // Transaction write
  static async transactWrite(
    transactItems: Array<{
      Put?: { TableName: string; Item: unknown; ConditionExpression?: string };
      Update?: {
        TableName: string;
        Key: Record<string, unknown>;
        UpdateExpression: string;
        ConditionExpression?: string;
        ExpressionAttributeNames?: Record<string, string>;
        ExpressionAttributeValues?: Record<string, unknown>;
      };
      Delete?: {
        TableName: string;
        Key: Record<string, unknown>;
        ConditionExpression?: string;
      };
      ConditionCheck?: {
        TableName: string;
        Key: Record<string, unknown>;
        ConditionExpression: string;
      };
    }>
  ): Promise<void> {
    try {
      const command = new TransactWriteCommand({
        TransactItems: transactItems,
      });

      await docClient.send(command);
    } catch (error) {
      if (error instanceof Error && error.name === 'TransactionCanceledException') {
        throw new DatabaseError(
          'DB_TRANSACTION_FAILED',
          'Transaction was cancelled due to condition failure',
          { transactItems }
        );
      }
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to execute transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { transactItems }
      );
    }
  }

  // Transaction get
  static async transactGet<T>(
    getItems: Array<{
      TableName: string;
      Key: Record<string, unknown>;
    }>
  ): Promise<T[]> {
    try {
      const command = new TransactGetCommand({
        TransactItems: getItems.map(item => ({ Get: item })),
      });

      const result = await docClient.send(command);
      return (result.Responses?.map(response => response.Item) as T[]) || [];
    } catch (error) {
      throw new DatabaseError(
        'DB_CONNECTION_FAILED',
        `Failed to execute transaction get: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { getItems }
      );
    }
  }
}

// Connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    // Simple query to check if table exists and is accessible
    await DynamoDBOperations.queryItems(
      'HEALTH_CHECK',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1
    );
    return true;
  } catch {
    return false;
  }
};

// Utility to generate TTL timestamp (for temporary items)
export const generateTTL = (hoursFromNow: number): number => {
  return Math.floor(Date.now() / 1000) + (hoursFromNow * 60 * 60);
};

// Utility to create condition expressions
export class ConditionBuilder {
  static itemExists(): string {
    return 'attribute_exists(PK)';
  }

  static itemNotExists(): string {
    return 'attribute_not_exists(PK)';
  }

  static attributeEquals(attributeName: string, value: string): string {
    return `${attributeName} = :${attributeName.replace('#', '')}`;
  }

  static attributeNotEquals(attributeName: string, value: string): string {
    return `${attributeName} <> :${attributeName.replace('#', '')}`;
  }

  static attributeExists(attributeName: string): string {
    return `attribute_exists(${attributeName})`;
  }

  static attributeNotExists(attributeName: string): string {
    return `attribute_not_exists(${attributeName})`;
  }

  static and(...conditions: string[]): string {
    return conditions.join(' AND ');
  }

  static or(...conditions: string[]): string {
    return `(${conditions.join(' OR ')})`;
  }
}

// Utility to create update expressions
export class UpdateBuilder {
  private setExpressions: string[] = [];
  private addExpressions: string[] = [];
  private removeExpressions: string[] = [];
  private deleteExpressions: string[] = [];
  private expressionAttributeNames: Record<string, string> = {};
  private expressionAttributeValues: Record<string, unknown> = {};

  set(attributeName: string, value: unknown): this {
    const nameKey = `#${attributeName}`;
    const valueKey = `:${attributeName}`;
    
    this.setExpressions.push(`${nameKey} = ${valueKey}`);
    this.expressionAttributeNames[nameKey] = attributeName;
    this.expressionAttributeValues[valueKey] = value;
    
    return this;
  }

  add(attributeName: string, value: number): this {
    const nameKey = `#${attributeName}`;
    const valueKey = `:${attributeName}`;
    
    this.addExpressions.push(`${nameKey} ${valueKey}`);
    this.expressionAttributeNames[nameKey] = attributeName;
    this.expressionAttributeValues[valueKey] = value;
    
    return this;
  }

  remove(attributeName: string): this {
    const nameKey = `#${attributeName}`;
    
    this.removeExpressions.push(nameKey);
    this.expressionAttributeNames[nameKey] = attributeName;
    
    return this;
  }

  build(): {
    updateExpression: string;
    expressionAttributeNames: Record<string, string>;
    expressionAttributeValues: Record<string, unknown>;
  } {
    const expressions: string[] = [];
    
    if (this.setExpressions.length > 0) {
      expressions.push(`SET ${this.setExpressions.join(', ')}`);
    }
    
    if (this.addExpressions.length > 0) {
      expressions.push(`ADD ${this.addExpressions.join(', ')}`);
    }
    
    if (this.removeExpressions.length > 0) {
      expressions.push(`REMOVE ${this.removeExpressions.join(', ')}`);
    }
    
    if (this.deleteExpressions.length > 0) {
      expressions.push(`DELETE ${this.deleteExpressions.join(', ')}`);
    }

    return {
      updateExpression: expressions.join(' '),
      expressionAttributeNames: this.expressionAttributeNames,
      expressionAttributeValues: this.expressionAttributeValues,
    };
  }
}