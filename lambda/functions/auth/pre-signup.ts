import { PreSignUpTriggerEvent, PreSignUpTriggerResult } from 'aws-lambda';
import { logger } from '../../shared/logger';

/**
 * Pre Sign-up Lambda Trigger
 * 
 * This function is called before a user is allowed to sign up.
 * It can be used to:
 * - Validate email domains
 * - Auto-confirm users from trusted domains
 * - Set custom attributes
 * - Prevent sign-ups based on business logic
 */
export async function handler(
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerResult> {
  logger.info('Pre sign-up trigger invoked', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    userAttributes: event.request.userAttributes,
    triggerSource: event.triggerSource,
  });

  try {
    const { userAttributes, validationData } = event.request;
    const email = userAttributes.email;

    // Validate email format (additional validation beyond Cognito's built-in)
    if (!email || !isValidEmail(email)) {
      logger.warn('Invalid email format during sign-up', { email });
      throw new Error('Invalid email format');
    }

    // Check for blocked email domains
    const blockedDomains = [
      'tempmail.com',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
    ];

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (blockedDomains.includes(emailDomain)) {
      logger.warn('Sign-up attempt with blocked email domain', { email, domain: emailDomain });
      throw new Error('Email domain not allowed');
    }

    // Auto-confirm users from trusted domains (optional)
    const trustedDomains = process.env.TRUSTED_DOMAINS?.split(',') || [];
    if (trustedDomains.includes(emailDomain)) {
      logger.info('Auto-confirming user from trusted domain', { email, domain: emailDomain });
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
    }

    // Set default custom attributes
    event.response.userAttributes = {
      ...userAttributes,
      'custom:subscription_tier': 'free',
      'custom:onboarding_completed': 'false',
      'custom:learning_preferences': JSON.stringify({
        preferredLanguage: 'en',
        difficultyLevel: 'beginner',
        studyReminders: true,
        emailNotifications: true,
      }),
    };

    logger.info('Pre sign-up validation completed successfully', {
      userName: event.userName,
      email,
      autoConfirmed: event.response.autoConfirmUser,
    });

    return event.response;
  } catch (error) {
    logger.error('Pre sign-up validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userName: event.userName,
      userAttributes: event.request.userAttributes,
    });
    
    // Throw error to prevent sign-up
    throw error;
  }
}

/**
 * Validate email format using a more comprehensive regex
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}