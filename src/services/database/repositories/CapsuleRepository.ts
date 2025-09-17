// Learning Capsule repository for DynamoDB operations

import { 
  LearningCapsule, 
  CapsuleProgress, 
  DifficultyLevel,
  ProcessingStatus 
} from '@/types/learning';
import { NotFoundError, DatabaseError } from '@/types/errors';
import { DynamoDBOperations, ConditionBuilder, UpdateBuilder } from '../client';
import { 
  KeyGenerator, 
  DataTransformer, 
  capsuleItemSchema,
  validateAndTransformItem 
} from '../schema';
import { generateId } from '@/utils/helpers';
import { LIMITS } from '@/utils/constants';

export interface GetCapsulesOptions {
  category?: string;
  tags?: string[];
  difficulty?: DifficultyLevel;
  processingStatus?: ProcessingStatus;
  sortBy?: 'created' | 'updated' | 'title' | 'lastAccessed';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export interface SearchCapsulesOptions {
  query: string;
  category?: string;
  tags?: string[];
  difficulty?: DifficultyLevel;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

export class CapsuleRepository {
  // Create a new learning capsule
  static async create(capsuleData: Omit<LearningCapsule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningCapsule> {
    const capsuleId = generateId();
    const now = new Date();

    const capsule: LearningCapsule = {
      ...capsuleData,
      id: capsuleId,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem = DataTransformer.capsuleToDynamoItem(capsule);

    try {
      await DynamoDBOperations.putItem(
        dynamoItem,
        ConditionBuilder.itemNotExists()
      );

      return capsule;
    } catch (error) {
      if (error instanceof DatabaseError && error.code === 'DB_CONSTRAINT_VIOLATION') {
        throw new DatabaseError('DB_CONSTRAINT_VIOLATION', 'Capsule already exists');
      }
      throw error;
    }
  }

  // Get capsule by ID
  static async getById(capsuleId: string): Promise<LearningCapsule | null> {
    // First, we need to find which user owns this capsule using GSI1
    const gsi1PK = KeyGenerator.capsuleGSI1PK(capsuleId);

    const result = await DynamoDBOperations.queryItems(
      gsi1PK,
      undefined,
      'GSI1',
      undefined,
      undefined,
      undefined,
      1
    );

    if (result.items.length === 0) {
      return null;
    }

    const validatedItem = validateAndTransformItem(result.items[0], capsuleItemSchema);
    return DataTransformer.dynamoItemToCapsule(validatedItem);
  }

  // Get capsule by user ID and capsule ID
  static async getByUserAndId(userId: string, capsuleId: string): Promise<LearningCapsule | null> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    const item = await DynamoDBOperations.getItem(partitionKey, sortKey);
    
    if (!item) {
      return null;
    }

    const validatedItem = validateAndTransformItem(item, capsuleItemSchema);
    return DataTransformer.dynamoItemToCapsule(validatedItem);
  }

  // Get all capsules for a user
  static async getByUserId(
    userId: string, 
    options: GetCapsulesOptions = {}
  ): Promise<{
    capsules: LearningCapsule[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    let filterExpression = 'begins_with(SK, :capsulePrefix)';
    const expressionAttributeValues: Record<string, unknown> = {
      ':capsulePrefix': 'CAPSULE#',
    };

    // Add filters
    if (options.category) {
      filterExpression += ' AND category = :category';
      expressionAttributeValues[':category'] = options.category;
    }

    if (options.difficulty) {
      filterExpression += ' AND difficulty = :difficulty';
      expressionAttributeValues[':difficulty'] = options.difficulty;
    }

    if (options.processingStatus) {
      filterExpression += ' AND processingStatus = :processingStatus';
      expressionAttributeValues[':processingStatus'] = options.processingStatus;
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map((_, index) => 
        `contains(tags, :tag${index})`
      );
      filterExpression += ` AND (${tagConditions.join(' OR ')})`;
      
      options.tags.forEach((tag, index) => {
        expressionAttributeValues[`:tag${index}`] = tag;
      });
    }

    // Determine sort order
    const scanIndexForward = options.sortOrder !== 'desc';

    const result = await DynamoDBOperations.queryItems(
      partitionKey,
      undefined,
      undefined,
      filterExpression,
      undefined,
      expressionAttributeValues,
      options.limit || LIMITS.MAX_SEARCH_RESULTS,
      options.exclusiveStartKey,
      scanIndexForward
    );

    let capsules = result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, capsuleItemSchema);
      return DataTransformer.dynamoItemToCapsule(validatedItem);
    });

    // Sort by specified field (DynamoDB doesn't support sorting by arbitrary fields)
    if (options.sortBy && options.sortBy !== 'created') {
      capsules = capsules.sort((a, b) => {
        let aValue: unknown;
        let bValue: unknown;

        switch (options.sortBy) {
          case 'updated':
            aValue = a.updatedAt.getTime();
            bValue = b.updatedAt.getTime();
            break;
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case 'lastAccessed':
            aValue = a.lastAccessed.getTime();
            bValue = b.lastAccessed.getTime();
            break;
          default:
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
        }

        if (aValue < bValue) return options.sortOrder === 'desc' ? 1 : -1;
        if (aValue > bValue) return options.sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return {
      capsules,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  // Get capsules by category
  static async getByCategory(
    category: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{
    capsules: LearningCapsule[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const gsi2PK = KeyGenerator.capsuleGSI2PK(category);

    const result = await DynamoDBOperations.queryItems(
      gsi2PK,
      undefined,
      'GSI2',
      undefined,
      undefined,
      undefined,
      limit,
      exclusiveStartKey,
      false // Sort by updated date descending
    );

    const capsules = result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, capsuleItemSchema);
      return DataTransformer.dynamoItemToCapsule(validatedItem);
    });

    return {
      capsules,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  // Search capsules by content
  static async search(
    userId: string,
    options: SearchCapsulesOptions
  ): Promise<{
    capsules: LearningCapsule[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    let filterExpression = 'begins_with(SK, :capsulePrefix) AND contains(searchableContent, :query)';
    const expressionAttributeValues: Record<string, unknown> = {
      ':capsulePrefix': 'CAPSULE#',
      ':query': options.query.toLowerCase(),
    };

    // Add additional filters
    if (options.category) {
      filterExpression += ' AND category = :category';
      expressionAttributeValues[':category'] = options.category;
    }

    if (options.difficulty) {
      filterExpression += ' AND difficulty = :difficulty';
      expressionAttributeValues[':difficulty'] = options.difficulty;
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map((_, index) => 
        `contains(tags, :tag${index})`
      );
      filterExpression += ` AND (${tagConditions.join(' OR ')})`;
      
      options.tags.forEach((tag, index) => {
        expressionAttributeValues[`:tag${index}`] = tag;
      });
    }

    const result = await DynamoDBOperations.queryItems(
      partitionKey,
      undefined,
      undefined,
      filterExpression,
      undefined,
      expressionAttributeValues,
      options.limit || LIMITS.MAX_SEARCH_RESULTS,
      options.exclusiveStartKey
    );

    const capsules = result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, capsuleItemSchema);
      return DataTransformer.dynamoItemToCapsule(validatedItem);
    });

    return {
      capsules,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  // Update capsule
  static async update(
    userId: string,
    capsuleId: string,
    updates: Partial<Pick<LearningCapsule, 'title' | 'description' | 'tags' | 'category' | 'difficulty'>>
  ): Promise<LearningCapsule> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    const updateBuilder = new UpdateBuilder()
      .set('updatedAt', new Date().toISOString());

    // Update allowed fields
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateBuilder.set(key, value);
      }
    });

    const { updateExpression, expressionAttributeNames, expressionAttributeValues } = 
      updateBuilder.build();

    try {
      await DynamoDBOperations.updateItem(
        partitionKey,
        sortKey,
        updateExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        ConditionBuilder.itemExists()
      );

      // Return updated capsule
      const updatedCapsule = await this.getByUserAndId(userId, capsuleId);
      if (!updatedCapsule) {
        throw new NotFoundError('Capsule not found after update');
      }

      return updatedCapsule;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('Capsule not found');
      }
      throw error;
    }
  }

  // Update processing status
  static async updateProcessingStatus(
    userId: string,
    capsuleId: string,
    status: ProcessingStatus,
    progress: number,
    error?: string
  ): Promise<void> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    const updateBuilder = new UpdateBuilder()
      .set('processingStatus', status)
      .set('processingProgress', progress)
      .set('updatedAt', new Date().toISOString());

    if (error) {
      updateBuilder.set('processingError', error);
    }

    const { updateExpression, expressionAttributeNames, expressionAttributeValues } = 
      updateBuilder.build();

    try {
      await DynamoDBOperations.updateItem(
        partitionKey,
        sortKey,
        updateExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        ConditionBuilder.itemExists()
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('Capsule not found');
      }
      throw error;
    }
  }

  // Update progress
  static async updateProgress(
    userId: string,
    capsuleId: string,
    progress: CapsuleProgress
  ): Promise<void> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    const updateBuilder = new UpdateBuilder()
      .set('progress', JSON.stringify(progress))
      .set('updatedAt', new Date().toISOString());

    const { updateExpression, expressionAttributeNames, expressionAttributeValues } = 
      updateBuilder.build();

    try {
      await DynamoDBOperations.updateItem(
        partitionKey,
        sortKey,
        updateExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        ConditionBuilder.itemExists()
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('Capsule not found');
      }
      throw error;
    }
  }

  // Update last accessed timestamp
  static async updateLastAccessed(userId: string, capsuleId: string): Promise<void> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    const updateBuilder = new UpdateBuilder()
      .set('lastAccessed', new Date().toISOString())
      .set('updatedAt', new Date().toISOString());

    const { updateExpression, expressionAttributeNames, expressionAttributeValues } = 
      updateBuilder.build();

    try {
      await DynamoDBOperations.updateItem(
        partitionKey,
        sortKey,
        updateExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        ConditionBuilder.itemExists()
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('Capsule not found');
      }
      throw error;
    }
  }

  // Delete capsule
  static async delete(userId: string, capsuleId: string): Promise<void> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    const sortKey = KeyGenerator.capsuleSK(capsuleId);

    try {
      await DynamoDBOperations.deleteItem(
        partitionKey,
        sortKey,
        ConditionBuilder.itemExists()
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('Capsule not found');
      }
      throw error;
    }
  }

  // Get capsule statistics for a user
  static async getUserCapsuleStats(userId: string): Promise<{
    totalCapsules: number;
    completedCapsules: number;
    processingCapsules: number;
    categoryBreakdown: Record<string, number>;
    difficultyBreakdown: Record<string, number>;
  }> {
    const { capsules } = await this.getByUserId(userId, { limit: 1000 });

    const stats = {
      totalCapsules: capsules.length,
      completedCapsules: 0,
      processingCapsules: 0,
      categoryBreakdown: {} as Record<string, number>,
      difficultyBreakdown: {} as Record<string, number>,
    };

    capsules.forEach(capsule => {
      // Count completed capsules (100% progress)
      if (capsule.progress.completionPercentage === 100) {
        stats.completedCapsules++;
      }

      // Count processing capsules
      if (capsule.processingStatus === 'processing') {
        stats.processingCapsules++;
      }

      // Category breakdown
      stats.categoryBreakdown[capsule.category] = 
        (stats.categoryBreakdown[capsule.category] || 0) + 1;

      // Difficulty breakdown
      stats.difficultyBreakdown[capsule.difficulty] = 
        (stats.difficultyBreakdown[capsule.difficulty] || 0) + 1;
    });

    return stats;
  }

  // Get recently accessed capsules
  static async getRecentlyAccessed(
    userId: string,
    limit: number = 10
  ): Promise<LearningCapsule[]> {
    const { capsules } = await this.getByUserId(userId, {
      sortBy: 'lastAccessed',
      sortOrder: 'desc',
      limit,
    });

    return capsules;
  }

  // Get capsules by video ID (to check for duplicates)
  static async getByVideoId(userId: string, videoId: string): Promise<LearningCapsule[]> {
    const partitionKey = KeyGenerator.capsulePK(userId);
    
    const result = await DynamoDBOperations.queryItems(
      partitionKey,
      undefined,
      undefined,
      'begins_with(SK, :capsulePrefix) AND videoId = :videoId',
      undefined,
      {
        ':capsulePrefix': 'CAPSULE#',
        ':videoId': videoId,
      }
    );

    return result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, capsuleItemSchema);
      return DataTransformer.dynamoItemToCapsule(validatedItem);
    });
  }

  // Batch get capsules by IDs
  static async getBatchByIds(capsuleIds: string[]): Promise<LearningCapsule[]> {
    // First get the capsules to find their user IDs
    const gsi1Keys = capsuleIds.map(capsuleId => ({
      PK: KeyGenerator.capsuleGSI1PK(capsuleId),
      SK: `CREATED#`, // We'll need to query instead of batch get for GSI
    }));

    // For batch operations, we need to know the user IDs
    // This is a limitation of the single-table design
    // In practice, you'd typically have the user ID when requesting capsules
    const capsules: LearningCapsule[] = [];

    for (const capsuleId of capsuleIds) {
      const capsule = await this.getById(capsuleId);
      if (capsule) {
        capsules.push(capsule);
      }
    }

    return capsules;
  }
}