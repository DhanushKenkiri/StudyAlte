import { PreSignUpTriggerEvent } from 'aws-lambda';
import { handler } from '../pre-signup';

describe('Pre Sign-up Lambda Trigger', () => {
  const mockEvent: PreSignUpTriggerEvent = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_test123',
    userName: 'testuser',
    callerContext: {
      awsSdkVersion: '1.0.0',
      clientId: 'test-client-id',
    },
    triggerSource: 'PreSignUp_SignUp',
    request: {
      userAttributes: {
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
      },
      validationData: {},
    },
    response: {
      autoConfirmUser: false,
      autoVerifyEmail: false,
      autoVerifyPhone: false,
      userAttributes: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TRUSTED_DOMAINS;
  });

  describe('Email validation', () => {
    it('should allow valid email addresses', async () => {
      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'valid@example.com',
            given_name: 'Test',
          },
        },
      };

      const result = await handler(event);
      expect(result.userAttributes).toBeDefined();
      expect(result.userAttributes['custom:subscription_tier']).toBe('free');
    });

    it('should reject invalid email addresses', async () => {
      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'invalid-email',
            given_name: 'Test',
          },
        },
      };

      await expect(handler(event)).rejects.toThrow('Invalid email format');
    });

    it('should reject blocked email domains', async () => {
      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'test@tempmail.com',
            given_name: 'Test',
          },
        },
      };

      await expect(handler(event)).rejects.toThrow('Email domain not allowed');
    });
  });

  describe('Trusted domains', () => {
    it('should auto-confirm users from trusted domains', async () => {
      process.env.TRUSTED_DOMAINS = 'company.com,university.edu';

      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'employee@company.com',
            given_name: 'Employee',
          },
        },
      };

      const result = await handler(event);
      expect(result.autoConfirmUser).toBe(true);
      expect(result.autoVerifyEmail).toBe(true);
    });

    it('should not auto-confirm users from non-trusted domains', async () => {
      process.env.TRUSTED_DOMAINS = 'company.com';

      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'user@example.com',
            given_name: 'User',
          },
        },
      };

      const result = await handler(event);
      expect(result.autoConfirmUser).toBe(false);
      expect(result.autoVerifyEmail).toBe(false);
    });
  });

  describe('Custom attributes', () => {
    it('should set default custom attributes', async () => {
      const result = await handler(mockEvent);

      expect(result.userAttributes['custom:subscription_tier']).toBe('free');
      expect(result.userAttributes['custom:onboarding_completed']).toBe('false');
      expect(result.userAttributes['custom:learning_preferences']).toBeDefined();

      const preferences = JSON.parse(result.userAttributes['custom:learning_preferences']);
      expect(preferences.preferredLanguage).toBe('en');
      expect(preferences.difficultyLevel).toBe('beginner');
      expect(preferences.studyReminders).toBe(true);
    });

    it('should preserve existing user attributes', async () => {
      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            email: 'test@example.com',
            given_name: 'Test',
            family_name: 'User',
            phone_number: '+1234567890',
          },
        },
      };

      const result = await handler(event);
      expect(result.userAttributes.email).toBe('test@example.com');
      expect(result.userAttributes.given_name).toBe('Test');
      expect(result.userAttributes.family_name).toBe('User');
      expect(result.userAttributes.phone_number).toBe('+1234567890');
    });
  });

  describe('Error handling', () => {
    it('should handle missing email gracefully', async () => {
      const event = {
        ...mockEvent,
        request: {
          ...mockEvent.request,
          userAttributes: {
            given_name: 'Test',
          },
        },
      };

      await expect(handler(event)).rejects.toThrow('Invalid email format');
    });

    it('should handle malformed event gracefully', async () => {
      const malformedEvent = {
        ...mockEvent,
        request: undefined as any,
      };

      await expect(handler(malformedEvent)).rejects.toThrow();
    });
  });
});