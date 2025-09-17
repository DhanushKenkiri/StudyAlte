// Tests for database schema and transformers

import {
  KeyGenerator,
  DataTransformer,
  validateDynamoItem,
  validateAndTransformItem,
  userItemSchema,
  capsuleItemSchema,
} from '../schema';
import { User, LearningCapsule } from '@/types';

describe('KeyGenerator', () => {
  describe('User keys', () => {
    test('should generate correct user partition key', () => {
      const userId = 'user123';
      expect(KeyGenerator.userPK(userId)).toBe('USER#user123');
    });

    test('should generate correct user sort key', () => {
      expect(KeyGenerator.userSK()).toBe('PROFILE');
    });

    test('should generate correct user GSI1 keys', () => {
      const email = 'test@example.com';
      expect(KeyGenerator.userGSI1PK(email)).toBe('EMAIL#test@example.com');
      expect(KeyGenerator.userGSI1SK()).toBe('USER');
    });
  });

  describe('Capsule keys', () => {
    test('should generate correct capsule partition key', () => {
      const userId = 'user123';
      expect(KeyGenerator.capsulePK(userId)).toBe('USER#user123');
    });

    test('should generate correct capsule sort key', () => {
      const capsuleId = 'capsule123';
      expect(KeyGenerator.capsuleSK(capsuleId)).toBe('CAPSULE#capsule123');
    });

    test('should generate correct capsule GSI1 keys', () => {
      const capsuleId = 'capsule123';
      const createdAt = '2023-12-25T10:00:00.000Z';
      expect(KeyGenerator.capsuleGSI1PK(capsuleId)).toBe('CAPSULE#capsule123');
      expect(KeyGenerator.capsuleGSI1SK(createdAt)).toBe('CREATED#2023-12-25T10:00:00.000Z');
    });

    test('should generate correct capsule GSI2 keys', () => {
      const category = 'programming';
      const updatedAt = '2023-12-25T10:00:00.000Z';
      expect(KeyGenerator.capsuleGSI2PK(category)).toBe('CATEGORY#programming');
      expect(KeyGenerator.capsuleGSI2SK(updatedAt)).toBe('UPDATED#2023-12-25T10:00:00.000Z');
    });
  });

  describe('Progress keys', () => {
    test('should generate correct progress keys', () => {
      const userId = 'user123';
      expect(KeyGenerator.progressPK(userId)).toBe('USER#user123');
      expect(KeyGenerator.progressSK()).toBe('PROGRESS');
    });
  });

  describe('Daily stats keys', () => {
    test('should generate correct daily stats keys', () => {
      const userId = 'user123';
      const date = '2023-12-25';
      expect(KeyGenerator.dailyStatsPK(userId)).toBe('USER#user123');
      expect(KeyGenerator.dailyStatsSK(date)).toBe('STATS#2023-12-25');
      expect(KeyGenerator.dailyStatsGSI1PK(date)).toBe('DATE#2023-12-25');
      expect(KeyGenerator.dailyStatsGSI1SK(userId)).toBe('USER#user123');
    });
  });
});

describe('DataTransformer', () => {
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
    emailVerified: true,
    createdAt: new Date('2023-12-25T10:00:00.000Z'),
    updatedAt: new Date('2023-12-25T10:00:00.000Z'),
  };

  const mockCapsule: LearningCapsule = {
    id: 'capsule123',
    userId: 'user123',
    videoId: 'video123',
    title: 'Test Video',
    description: 'Test Description',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: 600,
    tags: ['test', 'learning'],
    category: 'programming',
    difficulty: 'beginner',
    processingStatus: 'completed',
    processingProgress: 100,
    lastAccessed: new Date('2023-12-25T10:00:00.000Z'),
    summary: {
      id: 'summary123',
      keyPoints: ['Point 1', 'Point 2'],
      mainConcepts: ['Concept 1', 'Concept 2'],
      learningObjectives: ['Objective 1'],
      estimatedReadTime: 5,
      difficulty: 'beginner',
      generatedAt: new Date('2023-12-25T10:00:00.000Z'),
    },
    flashcards: [],
    quiz: {
      id: 'quiz123',
      title: 'Test Quiz',
      questions: [],
      passingScore: 70,
      attempts: [],
      createdAt: new Date('2023-12-25T10:00:00.000Z'),
    },
    notes: [],
    transcript: {
      id: 'transcript123',
      videoId: 'video123',
      segments: [],
      language: 'en',
      confidence: 0.95,
      generatedAt: new Date('2023-12-25T10:00:00.000Z'),
    },
    progress: {
      capsuleId: 'capsule123',
      completionPercentage: 50,
      timeSpent: 300,
      flashcardsReviewed: 5,
      flashcardsTotal: 10,
      quizzesTaken: 1,
      quizzesTotal: 2,
      notesCreated: 2,
      lastSection: 'summary',
      sectionsCompleted: ['summary'],
      updatedAt: new Date('2023-12-25T10:00:00.000Z'),
    },
    createdAt: new Date('2023-12-25T10:00:00.000Z'),
    updatedAt: new Date('2023-12-25T10:00:00.000Z'),
  };

  describe('User transformation', () => {
    test('should transform user to DynamoDB item', () => {
      const dynamoItem = DataTransformer.userToDynamoItem(mockUser);

      expect(dynamoItem.PK).toBe('USER#user123');
      expect(dynamoItem.SK).toBe('PROFILE');
      expect(dynamoItem.GSI1PK).toBe('EMAIL#test@example.com');
      expect(dynamoItem.GSI1SK).toBe('USER');
      expect(dynamoItem.entityType).toBe('USER');
      expect(dynamoItem.userId).toBe('user123');
      expect(dynamoItem.email).toBe('test@example.com');
      expect(dynamoItem.profile).toEqual(mockUser.profile);
      expect(dynamoItem.preferences).toEqual(mockUser.preferences);
      expect(dynamoItem.subscription).toBe('free');
      expect(dynamoItem.emailVerified).toBe(true);
    });

    test('should transform DynamoDB item to user', () => {
      const dynamoItem = DataTransformer.userToDynamoItem(mockUser);
      const transformedUser = DataTransformer.dynamoItemToUser(dynamoItem);

      expect(transformedUser).toEqual(mockUser);
    });
  });

  describe('Capsule transformation', () => {
    test('should transform capsule to DynamoDB item', () => {
      const dynamoItem = DataTransformer.capsuleToDynamoItem(mockCapsule);

      expect(dynamoItem.PK).toBe('USER#user123');
      expect(dynamoItem.SK).toBe('CAPSULE#capsule123');
      expect(dynamoItem.GSI1PK).toBe('CAPSULE#capsule123');
      expect(dynamoItem.GSI2PK).toBe('CATEGORY#programming');
      expect(dynamoItem.entityType).toBe('CAPSULE');
      expect(dynamoItem.capsuleId).toBe('capsule123');
      expect(dynamoItem.userId).toBe('user123');
      expect(dynamoItem.title).toBe('Test Video');
      expect(dynamoItem.tags).toEqual(['test', 'learning']);
      expect(dynamoItem.category).toBe('programming');
      expect(dynamoItem.difficulty).toBe('beginner');
      expect(dynamoItem.processingStatus).toBe('completed');
      expect(dynamoItem.processingProgress).toBe(100);

      // Check JSON serialized fields
      expect(typeof dynamoItem.summary).toBe('string');
      expect(typeof dynamoItem.flashcards).toBe('string');
      expect(typeof dynamoItem.quiz).toBe('string');
      expect(typeof dynamoItem.notes).toBe('string');
      expect(typeof dynamoItem.transcript).toBe('string');
      expect(typeof dynamoItem.progress).toBe('string');
      expect(typeof dynamoItem.searchableContent).toBe('string');
    });

    test('should transform DynamoDB item to capsule', () => {
      const dynamoItem = DataTransformer.capsuleToDynamoItem(mockCapsule);
      const transformedCapsule = DataTransformer.dynamoItemToCapsule(dynamoItem);

      expect(transformedCapsule.id).toBe(mockCapsule.id);
      expect(transformedCapsule.userId).toBe(mockCapsule.userId);
      expect(transformedCapsule.title).toBe(mockCapsule.title);
      expect(transformedCapsule.tags).toEqual(mockCapsule.tags);
      expect(transformedCapsule.summary).toEqual(mockCapsule.summary);
      expect(transformedCapsule.progress).toEqual(mockCapsule.progress);
    });

    test('should build searchable content correctly', () => {
      const dynamoItem = DataTransformer.capsuleToDynamoItem(mockCapsule);
      
      expect(dynamoItem.searchableContent).toContain('test video');
      expect(dynamoItem.searchableContent).toContain('test description');
      expect(dynamoItem.searchableContent).toContain('test');
      expect(dynamoItem.searchableContent).toContain('learning');
      expect(dynamoItem.searchableContent).toContain('programming');
      expect(dynamoItem.searchableContent).toContain('point 1');
      expect(dynamoItem.searchableContent).toContain('concept 1');
    });
  });
});

describe('Schema validation', () => {
  test('should validate correct user item', () => {
    const validUserItem = {
      PK: 'USER#user123',
      SK: 'PROFILE',
      GSI1PK: 'EMAIL#test@example.com',
      GSI1SK: 'USER',
      entityType: 'USER',
      userId: 'user123',
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
      emailVerified: true,
      createdAt: '2023-12-25T10:00:00.000Z',
      updatedAt: '2023-12-25T10:00:00.000Z',
    };

    expect(validateDynamoItem(validUserItem, userItemSchema)).toBe(true);
    expect(() => validateAndTransformItem(validUserItem, userItemSchema)).not.toThrow();
  });

  test('should reject invalid user item', () => {
    const invalidUserItem = {
      PK: 'USER#user123',
      SK: 'PROFILE',
      entityType: 'USER',
      // Missing required fields
    };

    expect(validateDynamoItem(invalidUserItem, userItemSchema)).toBe(false);
    expect(() => validateAndTransformItem(invalidUserItem, userItemSchema)).toThrow();
  });

  test('should validate correct capsule item', () => {
    const validCapsuleItem = {
      PK: 'USER#user123',
      SK: 'CAPSULE#capsule123',
      GSI1PK: 'CAPSULE#capsule123',
      GSI1SK: 'CREATED#2023-12-25T10:00:00.000Z',
      GSI2PK: 'CATEGORY#programming',
      GSI2SK: 'UPDATED#2023-12-25T10:00:00.000Z',
      entityType: 'CAPSULE',
      capsuleId: 'capsule123',
      userId: 'user123',
      videoId: 'video123',
      title: 'Test Video',
      description: 'Test Description',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: 600,
      tags: ['test', 'learning'],
      category: 'programming',
      difficulty: 'beginner',
      processingStatus: 'completed',
      processingProgress: 100,
      lastAccessed: '2023-12-25T10:00:00.000Z',
      summary: '{"id":"summary123","keyPoints":["Point 1"]}',
      flashcards: '[]',
      quiz: '{"id":"quiz123","title":"Test Quiz","questions":[]}',
      notes: '[]',
      transcript: '{"id":"transcript123","segments":[]}',
      progress: '{"capsuleId":"capsule123","completionPercentage":50}',
      searchableContent: 'test video programming',
      createdAt: '2023-12-25T10:00:00.000Z',
      updatedAt: '2023-12-25T10:00:00.000Z',
    };

    expect(validateDynamoItem(validCapsuleItem, capsuleItemSchema)).toBe(true);
    expect(() => validateAndTransformItem(validCapsuleItem, capsuleItemSchema)).not.toThrow();
  });

  test('should reject invalid capsule item', () => {
    const invalidCapsuleItem = {
      PK: 'USER#user123',
      SK: 'CAPSULE#capsule123',
      entityType: 'CAPSULE',
      // Missing required fields
    };

    expect(validateDynamoItem(invalidCapsuleItem, capsuleItemSchema)).toBe(false);
    expect(() => validateAndTransformItem(invalidCapsuleItem, capsuleItemSchema)).toThrow();
  });

  test('should reject item with wrong entity type', () => {
    const invalidItem = {
      PK: 'USER#user123',
      SK: 'PROFILE',
      entityType: 'INVALID_TYPE',
      userId: 'user123',
      email: 'test@example.com',
      createdAt: '2023-12-25T10:00:00.000Z',
      updatedAt: '2023-12-25T10:00:00.000Z',
    };

    expect(validateDynamoItem(invalidItem, userItemSchema)).toBe(false);
  });
});