// User repository for DynamoDB operations

import { User, CreateUserRequest, ProfileUpdate } from '@/types/user';
import { NotFoundError, ConflictError, DatabaseError } from '@/types/errors';
import { DynamoDBOperations, ConditionBuilder, UpdateBuilder } from '../client';
import { 
  KeyGenerator, 
  DataTransformer, 
  userItemSchema,
  validateAndTransformItem 
} from '../schema';
import { generateId } from '@/utils/helpers';

export class UserRepository {
  // Create a new user
  static async create(userData: CreateUserRequest): Promise<User> {
    const userId = generateId();
    const now = new Date();

    const user: User = {
      id: userId,
      email: userData.email,
      profile: userData.profile,
      preferences: userData.preferences || {
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          studyReminders: true,
          weeklyProgress: true,
        },
        learning: {
          defaultDifficulty: 'beginner',
          spacedRepetitionEnabled: true,
          autoGenerateFlashcards: true,
          preferredStudyTime: 30,
        },
        privacy: {
          profileVisible: true,
          progressVisible: true,
          allowDataCollection: true,
        },
      },
      subscription: 'free',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem = DataTransformer.userToDynamoItem(user);

    try {
      // Check if user with email already exists
      await DynamoDBOperations.putItem(
        dynamoItem,
        ConditionBuilder.and(
          ConditionBuilder.itemNotExists(),
          ConditionBuilder.attributeNotExists('GSI1PK')
        )
      );

      return user;
    } catch (error) {
      if (error instanceof DatabaseError && error.code === 'DB_CONSTRAINT_VIOLATION') {
        throw new ConflictError('User with this email already exists');
      }
      throw error;
    }
  }

  // Get user by ID
  static async getById(userId: string): Promise<User | null> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    const item = await DynamoDBOperations.getItem(partitionKey, sortKey);
    
    if (!item) {
      return null;
    }

    const validatedItem = validateAndTransformItem(item, userItemSchema);
    return DataTransformer.dynamoItemToUser(validatedItem);
  }

  // Get user by email
  static async getByEmail(email: string): Promise<User | null> {
    const gsi1PK = KeyGenerator.userGSI1PK(email);
    const gsi1SK = KeyGenerator.userGSI1SK();

    const result = await DynamoDBOperations.queryItems(
      gsi1PK,
      `SK = :sk`,
      'GSI1', // GSI1 index name
      undefined,
      undefined,
      { ':sk': gsi1SK },
      1
    );

    if (result.items.length === 0) {
      return null;
    }

    const validatedItem = validateAndTransformItem(result.items[0], userItemSchema);
    return DataTransformer.dynamoItemToUser(validatedItem);
  }

  // Update user profile
  static async updateProfile(userId: string, updates: ProfileUpdate): Promise<User> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    const updateBuilder = new UpdateBuilder()
      .set('updatedAt', new Date().toISOString());

    // Update profile fields
    if (updates.profile) {
      Object.entries(updates.profile).forEach(([key, value]) => {
        if (value !== undefined) {
          updateBuilder.set(`profile.${key}`, value);
        }
      });
    }

    // Update preferences
    if (updates.preferences) {
      Object.entries(updates.preferences).forEach(([key, value]) => {
        if (value !== undefined) {
          updateBuilder.set(`preferences.${key}`, value);
        }
      });
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

      // Return updated user
      const updatedUser = await this.getById(userId);
      if (!updatedUser) {
        throw new NotFoundError('User not found after update');
      }

      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }

  // Update last login timestamp
  static async updateLastLogin(userId: string): Promise<void> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    const updateBuilder = new UpdateBuilder()
      .set('lastLoginAt', new Date().toISOString())
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
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }

  // Verify user email
  static async verifyEmail(userId: string): Promise<void> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    const updateBuilder = new UpdateBuilder()
      .set('emailVerified', true)
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
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }

  // Update subscription tier
  static async updateSubscription(
    userId: string, 
    subscription: 'free' | 'premium' | 'enterprise'
  ): Promise<void> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    const updateBuilder = new UpdateBuilder()
      .set('subscription', subscription)
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
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }

  // Delete user (soft delete by marking as deleted)
  static async delete(userId: string): Promise<void> {
    const partitionKey = KeyGenerator.userPK(userId);
    const sortKey = KeyGenerator.userSK();

    // Instead of hard delete, we mark as deleted and set TTL
    const updateBuilder = new UpdateBuilder()
      .set('deleted', true)
      .set('deletedAt', new Date().toISOString())
      .set('updatedAt', new Date().toISOString())
      .set('ttl', Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)); // 30 days TTL

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
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }

  // Check if user exists
  static async exists(userId: string): Promise<boolean> {
    const user = await this.getById(userId);
    return user !== null;
  }

  // Check if email is taken
  static async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.getByEmail(email);
    return user !== null;
  }

  // Get users by subscription tier (for admin purposes)
  static async getBySubscriptionTier(
    subscription: 'free' | 'premium' | 'enterprise',
    limit: number = 50,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<{
    users: User[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const result = await DynamoDBOperations.scanItems(
      'subscription = :subscription AND attribute_not_exists(deleted)',
      { '#subscription': 'subscription' },
      { ':subscription': subscription },
      limit,
      exclusiveStartKey
    );

    const users = result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, userItemSchema);
      return DataTransformer.dynamoItemToUser(validatedItem);
    });

    return {
      users,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  // Get user statistics (for admin dashboard)
  static async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    subscriptionBreakdown: Record<string, number>;
  }> {
    // This would typically be implemented with DynamoDB Streams + Lambda
    // or cached in a separate analytics table. For now, we'll use scan
    // which is not recommended for production at scale.
    
    const result = await DynamoDBOperations.scanItems(
      'entityType = :entityType AND attribute_not_exists(deleted)',
      { '#entityType': 'entityType' },
      { ':entityType': 'USER' }
    );

    const users = result.items.map(item => {
      const validatedItem = validateAndTransformItem(item, userItemSchema);
      return DataTransformer.dynamoItemToUser(validatedItem);
    });

    const stats = {
      totalUsers: users.length,
      verifiedUsers: users.filter(user => user.emailVerified).length,
      subscriptionBreakdown: {
        free: 0,
        premium: 0,
        enterprise: 0,
      },
    };

    users.forEach(user => {
      stats.subscriptionBreakdown[user.subscription]++;
    });

    return stats;
  }

  // Batch get users by IDs
  static async getBatchByIds(userIds: string[]): Promise<User[]> {
    const keys = userIds.map(userId => ({
      PK: KeyGenerator.userPK(userId),
      SK: KeyGenerator.userSK(),
    }));

    const items = await DynamoDBOperations.batchGetItems(keys);
    
    return items.map(item => {
      const validatedItem = validateAndTransformItem(item, userItemSchema);
      return DataTransformer.dynamoItemToUser(validatedItem);
    });
  }
}