import { PostConfirmationTriggerEvent } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../post-confirmation';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const mockSend = jest.fn();
const mockDocClient = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

// Mock the DynamoDBDocumentClient.from method
(DynamoDBDocumentClient.from as jest.Mock) = jest.fn().mockReturnValue(mockDocClient);

describe('Post Confirmation Lambda Trigger', () => {
  const mockEvent: PostConfirmationTriggerEvent = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_test123',
    userName: 'test-user-id',
    callerContext: {
      awsSdkVersion: '1.0.0',
      clientId: 'test-client-id',
    },
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    request: {
      userAttributes: {
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
        email_verified: 'true',
      },
    },
    response: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DYNAMODB_TABLE_NAME = 'test-table';
    process.env.CREATE_WELCOME_CAPSULE = 'false';
  });

  afterEach(() => {
    delete process.env.DYNAMODB_TABLE_NAME;
    delete process.env.CREATE_WELCOME_CAPSULE;
  });

  describe('User profile creation', () => {
    it('should create user profile successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await handler(mockEvent);

      expect(mockSend).toHaveBeenCalledTimes(2); // User profile + settings
      expect(result).toEqual({});

      // Verify user profile creation
      const userProfileCall = mockSend.mock.calls[0][0];
      expect(userProfileCall).toBeInstanceOf(PutCommand);
      expect(userProfileCall.input.TableName).toBe('test-table');
      expect(userProfileCall.input.Item.PK).toBe('USER#test-user-id');
      expect(userProfileCall.input.Item.SK).toBe('PROFILE#test-user-id');
      expect(userProfileCall.input.Item.email).toBe('test@example.com');
      expect(userProfileCall.input.Item.name).toBe('Test User');
    });

    it('should create user settings successfully', async () => {
      mockSend.mockResolvedValue({});

      await handler(mockEvent);

      // Verify user settings creation
      const userSettingsCall = mockSend.mock.calls[1][0];
      expect(userSettingsCall).toBeInstanceOf(PutCommand);
      expect(userSettingsCall.input.TableName).toBe('test-table');
      expect(userSettingsCall.input.Item.PK).toBe('USER#test-user-id');
      expect(userSettingsCall.input.Item.SK).toBe('SETTINGS#test-user-id');
      expect(userSettingsCall.input.Item.settings).toBeDefined();
    });

    it('should handle missing given_name gracefully', async () => {
      mockSend.mockResolvedValue({});

      const event = {
        ...mockEvent,
        request: {
          userAttributes: {
            email: 'test@example.com',
            family_name: 'User',
          },
        },
      };

      await handler(event);

      const userProfileCall = mockSend.mock.calls[0][0];
      expect(userProfileCall.input.Item.name).toBe('User');
    });

    it('should use email prefix as name when no names provided', async () => {
      mockSend.mockResolvedValue({});

      const event = {
        ...mockEvent,
        request: {
          userAttributes: {
            email: 'testuser@example.com',
          },
        },
      };

      await handler(event);

      const userProfileCall = mockSend.mock.calls[0][0];
      expect(userProfileCall.input.Item.name).toBe('testuser');
    });
  });

  describe('Welcome capsule creation', () => {
    it('should create welcome capsule when enabled', async () => {
      process.env.CREATE_WELCOME_CAPSULE = 'true';
      mockSend.mockResolvedValue({});

      await handler(mockEvent);

      expect(mockSend).toHaveBeenCalledTimes(3); // User profile + settings + welcome capsule

      // Verify welcome capsule creation
      const welcomeCapsuleCall = mockSend.mock.calls[2][0];
      expect(welcomeCapsuleCall).toBeInstanceOf(PutCommand);
      expect(welcomeCapsuleCall.input.Item.PK).toBe('USER#test-user-id');
      expect(welcomeCapsuleCall.input.Item.SK).toBe('CAPSULE#welcome-test-user-id');
      expect(welcomeCapsuleCall.input.Item.title).toBe('Welcome to YouTube Learning Platform');
    });

    it('should not create welcome capsule when disabled', async () => {
      process.env.CREATE_WELCOME_CAPSULE = 'false';
      mockSend.mockResolvedValue({});

      await handler(mockEvent);

      expect(mockSend).toHaveBeenCalledTimes(2); // Only user profile + settings
    });
  });

  describe('Error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      // Should not throw error, just log it
      const result = await handler(mockEvent);
      expect(result).toEqual({});
    });

    it('should handle missing table name', async () => {
      delete process.env.DYNAMODB_TABLE_NAME;

      const result = await handler(mockEvent);
      expect(result).toEqual({});
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle malformed event', async () => {
      const malformedEvent = {
        ...mockEvent,
        request: undefined as any,
      };

      const result = await handler(malformedEvent);
      expect(result).toEqual({});
    });
  });

  describe('User profile structure', () => {
    it('should create user profile with correct structure', async () => {
      mockSend.mockResolvedValue({});

      await handler(mockEvent);

      const userProfileCall = mockSend.mock.calls[0][0];
      const userProfile = userProfileCall.input.Item;

      // Check required fields
      expect(userProfile.id).toBe('test-user-id');
      expect(userProfile.email).toBe('test@example.com');
      expect(userProfile.name).toBe('Test User');
      expect(userProfile.isActive).toBe(true);
      expect(userProfile.emailVerified).toBe(true);
      expect(userProfile.onboardingCompleted).toBe(false);

      // Check subscription
      expect(userProfile.subscription.tier).toBe('free');
      expect(userProfile.subscription.status).toBe('active');
      expect(userProfile.subscription.features).toContain('basic_video_processing');

      // Check preferences
      expect(userProfile.preferences.theme).toBe('light');
      expect(userProfile.preferences.language).toBe('en');
      expect(userProfile.preferences.notifications.email).toBe(true);

      // Check stats
      expect(userProfile.stats.totalCapsules).toBe(0);
      expect(userProfile.stats.currentStreak).toBe(0);

      // Check timestamps
      expect(userProfile.createdAt).toBeDefined();
      expect(userProfile.updatedAt).toBeDefined();
      expect(userProfile.lastLoginAt).toBeDefined();
    });

    it('should create user settings with correct structure', async () => {
      mockSend.mockResolvedValue({});

      await handler(mockEvent);

      const userSettingsCall = mockSend.mock.calls[1][0];
      const userSettings = userSettingsCall.input.Item;

      expect(userSettings.userId).toBe('test-user-id');
      expect(userSettings.settings.appearance.theme).toBe('light');
      expect(userSettings.settings.notifications.email).toBe(true);
      expect(userSettings.settings.privacy.profileVisibility).toBe('private');
      expect(userSettings.settings.learning.autoPlay).toBe(true);
    });
  });
});