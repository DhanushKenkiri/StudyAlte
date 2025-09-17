// Tests for UserRepository

import { UserRepository } from '../repositories/UserRepository';
import { DynamoDBOperations } from '../client';
import { User, CreateUserRequest } from '@/types/user';
import { NotFoundError, ConflictError } from '@/types/errors';

// Mock DynamoDB operations
jest.mock('../client', () => ({
  DynamoDBOperations: {
    putItem: jest.fn(),
    getItem: jest.fn(),
    queryItems: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    scanItems: jest.fn(),
    batchGetItems: jest.fn(),
  },
  ConditionBuilder: {
    and: jest.fn(),
    itemNotExists: jest.fn(),
    itemExists: jest.fn(),
    attributeNotExists: jest.fn(),
  },
  UpdateBuilder: jest.fn().mockImplementation(() => ({
    set: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({
      updateExpression: 'SET #attr = :val',
      expressionAttributeNames: { '#attr': 'attribute' },
      expressionAttributeValues: { ':val': 'value' },
    }),
  })),
}));

// Mock helper functions
jest.mock('@/utils/helpers', () => ({
  generateId: jest.fn(() => 'generated-id-123'),
}));

const mockDynamoDBOps = DynamoDBOperations as jest.Mocked<typeof DynamoDBOperations>;

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCreateUserRequest: CreateUserRequest = {
    email: 'test@example.com',
    password: 'password123',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'UTC',
      language: 'en',
    },
  };

  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'UTC',
      language: 'en',
    },
    preferences: {
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
    createdAt: new Date('2023-12-25T10:00:00.000Z'),
    updatedAt: new Date('2023-12-25T10:00:00.000Z'),
  };

  const mockDynamoUserItem = {
    PK: 'USER#user123',
    SK: 'PROFILE',
    GSI1PK: 'EMAIL#test@example.com',
    GSI1SK: 'USER',
    entityType: 'USER',
    userId: 'user123',
    email: 'test@example.com',
    profile: mockUser.profile,
    preferences: mockUser.preferences,
    subscription: 'free',
    emailVerified: false,
    createdAt: '2023-12-25T10:00:00.000Z',
    updatedAt: '2023-12-25T10:00:00.000Z',
  };

  describe('create', () => {
    test('should create a new user successfully', async () => {
      mockDynamoDBOps.putItem.mockResolvedValueOnce(undefined);

      const result = await UserRepository.create(mockCreateUserRequest);

      expect(result).toMatchObject({
        id: 'generated-id-123',
        email: 'test@example.com',
        profile: mockCreateUserRequest.profile,
        subscription: 'free',
        emailVerified: false,
      });

      expect(mockDynamoDBOps.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: 'USER#generated-id-123',
          SK: 'PROFILE',
          entityType: 'USER',
          email: 'test@example.com',
        }),
        expect.any(String)
      );
    });

    test('should throw ConflictError if user already exists', async () => {
      const dbError = new Error('ConditionalCheckFailedException');
      dbError.name = 'ConditionalCheckFailedException';
      mockDynamoDBOps.putItem.mockRejectedValueOnce(dbError);

      await expect(UserRepository.create(mockCreateUserRequest))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('getById', () => {
    test('should return user when found', async () => {
      mockDynamoDBOps.getItem.mockResolvedValueOnce(mockDynamoUserItem);

      const result = await UserRepository.getById('user123');

      expect(result).toMatchObject({
        id: 'user123',
        email: 'test@example.com',
        profile: mockUser.profile,
      });

      expect(mockDynamoDBOps.getItem).toHaveBeenCalledWith(
        'USER#user123',
        'PROFILE',
        false
      );
    });

    test('should return null when user not found', async () => {
      mockDynamoDBOps.getItem.mockResolvedValueOnce(null);

      const result = await UserRepository.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    test('should return user when found by email', async () => {
      mockDynamoDBOps.queryItems.mockResolvedValueOnce({
        items: [mockDynamoUserItem],
        count: 1,
      });

      const result = await UserRepository.getByEmail('test@example.com');

      expect(result).toMatchObject({
        id: 'user123',
        email: 'test@example.com',
      });

      expect(mockDynamoDBOps.queryItems).toHaveBeenCalledWith(
        'EMAIL#test@example.com',
        'SK = :sk',
        'GSI1',
        undefined,
        undefined,
        { ':sk': 'USER' },
        1
      );
    });

    test('should return null when user not found by email', async () => {
      mockDynamoDBOps.queryItems.mockResolvedValueOnce({
        items: [],
        count: 0,
      });

      const result = await UserRepository.getByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    test('should update user profile successfully', async () => {
      mockDynamoDBOps.updateItem.mockResolvedValueOnce(undefined);
      mockDynamoDBOps.getItem.mockResolvedValueOnce({
        ...mockDynamoUserItem,
        profile: {
          ...mockDynamoUserItem.profile,
          firstName: 'Jane',
        },
      });

      const updates = {
        profile: {
          firstName: 'Jane',
        },
      };

      const result = await UserRepository.updateProfile('user123', updates);

      expect(result.profile.firstName).toBe('Jane');
      expect(mockDynamoDBOps.updateItem).toHaveBeenCalled();
    });

    test('should throw NotFoundError when user does not exist', async () => {
      const notFoundError = new NotFoundError('User not found');
      mockDynamoDBOps.updateItem.mockRejectedValueOnce(notFoundError);

      const updates = {
        profile: {
          firstName: 'Jane',
        },
      };

      await expect(UserRepository.updateProfile('nonexistent', updates))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLastLogin', () => {
    test('should update last login timestamp', async () => {
      mockDynamoDBOps.updateItem.mockResolvedValueOnce(undefined);

      await UserRepository.updateLastLogin('user123');

      expect(mockDynamoDBOps.updateItem).toHaveBeenCalledWith(
        'USER#user123',
        'PROFILE',
        expect.any(String),
        expect.any(Object),
        expect.any(Object),
        expect.any(String)
      );
    });

    test('should throw NotFoundError when user does not exist', async () => {
      const notFoundError = new NotFoundError('User not found');
      mockDynamoDBOps.updateItem.mockRejectedValueOnce(notFoundError);

      await expect(UserRepository.updateLastLogin('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyEmail', () => {
    test('should verify user email successfully', async () => {
      mockDynamoDBOps.updateItem.mockResolvedValueOnce(undefined);

      await UserRepository.verifyEmail('user123');

      expect(mockDynamoDBOps.updateItem).toHaveBeenCalledWith(
        'USER#user123',
        'PROFILE',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ':emailVerified': true,
        }),
        expect.any(String)
      );
    });
  });

  describe('updateSubscription', () => {
    test('should update subscription tier successfully', async () => {
      mockDynamoDBOps.updateItem.mockResolvedValueOnce(undefined);

      await UserRepository.updateSubscription('user123', 'premium');

      expect(mockDynamoDBOps.updateItem).toHaveBeenCalledWith(
        'USER#user123',
        'PROFILE',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ':subscription': 'premium',
        }),
        expect.any(String)
      );
    });
  });

  describe('delete', () => {
    test('should soft delete user successfully', async () => {
      mockDynamoDBOps.updateItem.mockResolvedValueOnce(undefined);

      await UserRepository.delete('user123');

      expect(mockDynamoDBOps.updateItem).toHaveBeenCalledWith(
        'USER#user123',
        'PROFILE',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ':deleted': true,
        }),
        expect.any(String)
      );
    });
  });

  describe('exists', () => {
    test('should return true when user exists', async () => {
      mockDynamoDBOps.getItem.mockResolvedValueOnce(mockDynamoUserItem);

      const result = await UserRepository.exists('user123');

      expect(result).toBe(true);
    });

    test('should return false when user does not exist', async () => {
      mockDynamoDBOps.getItem.mockResolvedValueOnce(null);

      const result = await UserRepository.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isEmailTaken', () => {
    test('should return true when email is taken', async () => {
      mockDynamoDBOps.queryItems.mockResolvedValueOnce({
        items: [mockDynamoUserItem],
        count: 1,
      });

      const result = await UserRepository.isEmailTaken('test@example.com');

      expect(result).toBe(true);
    });

    test('should return false when email is not taken', async () => {
      mockDynamoDBOps.queryItems.mockResolvedValueOnce({
        items: [],
        count: 0,
      });

      const result = await UserRepository.isEmailTaken('available@example.com');

      expect(result).toBe(false);
    });
  });

  describe('getBatchByIds', () => {
    test('should return multiple users by IDs', async () => {
      const userIds = ['user1', 'user2'];
      const mockUsers = [
        { ...mockDynamoUserItem, userId: 'user1', PK: 'USER#user1' },
        { ...mockDynamoUserItem, userId: 'user2', PK: 'USER#user2' },
      ];

      mockDynamoDBOps.batchGetItems.mockResolvedValueOnce(mockUsers);

      const result = await UserRepository.getBatchByIds(userIds);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user1');
      expect(result[1].id).toBe('user2');

      expect(mockDynamoDBOps.batchGetItems).toHaveBeenCalledWith([
        { PK: 'USER#user1', SK: 'PROFILE' },
        { PK: 'USER#user2', SK: 'PROFILE' },
      ]);
    });

    test('should return empty array when no users found', async () => {
      mockDynamoDBOps.batchGetItems.mockResolvedValueOnce([]);

      const result = await UserRepository.getBatchByIds(['nonexistent']);

      expect(result).toHaveLength(0);
    });
  });

  describe('getUserStats', () => {
    test('should return user statistics', async () => {
      const mockUsers = [
        { ...mockDynamoUserItem, subscription: 'free', emailVerified: true },
        { ...mockDynamoUserItem, subscription: 'premium', emailVerified: false },
        { ...mockDynamoUserItem, subscription: 'free', emailVerified: true },
      ];

      mockDynamoDBOps.scanItems.mockResolvedValueOnce({
        items: mockUsers,
        count: 3,
      });

      const result = await UserRepository.getUserStats();

      expect(result).toEqual({
        totalUsers: 3,
        verifiedUsers: 2,
        subscriptionBreakdown: {
          free: 2,
          premium: 1,
          enterprise: 0,
        },
      });
    });
  });
});