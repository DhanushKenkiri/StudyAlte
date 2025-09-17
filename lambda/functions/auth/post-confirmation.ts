import { PostConfirmationTriggerEvent, PostConfirmationTriggerResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../shared/logger';
import { User } from '../../../src/types/user';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Post Confirmation Lambda Trigger
 * 
 * This function is called after a user confirms their account.
 * It creates the user profile in DynamoDB and sets up initial data.
 */
export async function handler(
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerResult> {
  logger.info('Post confirmation trigger invoked', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    userAttributes: event.request.userAttributes,
    triggerSource: event.triggerSource,
  });

  try {
    const { userAttributes } = event.request;
    const userId = event.userName;
    const email = userAttributes.email;
    const givenName = userAttributes.given_name || '';
    const familyName = userAttributes.family_name || '';

    // Create user profile in DynamoDB
    const userProfile: User = {
      id: userId,
      email,
      name: `${givenName} ${familyName}`.trim() || email.split('@')[0],
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          push: false,
          studyReminders: true,
        },
        privacy: {
          profileVisibility: 'private',
          shareProgress: false,
        },
        learning: {
          difficultyLevel: 'beginner',
          preferredContentTypes: ['video', 'text'],
          studyGoals: {
            dailyMinutes: 30,
            weeklyGoal: 5,
          },
        },
      },
      subscription: {
        tier: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        features: [
          'basic_video_processing',
          'limited_ai_tutor',
          'basic_analytics',
        ],
      },
      profile: {
        avatar: null,
        bio: null,
        location: null,
        website: null,
        socialLinks: {},
      },
      stats: {
        totalCapsules: 0,
        totalStudyTime: 0,
        currentStreak: 0,
        longestStreak: 0,
        completedQuizzes: 0,
        averageQuizScore: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isActive: true,
      emailVerified: true,
      onboardingCompleted: false,
    };

    // Store user profile in DynamoDB
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable not set');
    }

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
        GSI1PK: `USER#${email}`,
        GSI1SK: `PROFILE#${userId}`,
        GSI2PK: `SUBSCRIPTION#${userProfile.subscription.tier}`,
        GSI2SK: `USER#${userId}`,
        EntityType: 'User',
        ...userProfile,
      },
      ConditionExpression: 'attribute_not_exists(PK)', // Prevent overwriting existing user
    }));

    // Create initial user settings
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `USER#${userId}`,
        SK: `SETTINGS#${userId}`,
        EntityType: 'UserSettings',
        userId,
        settings: {
          appearance: {
            theme: 'light',
            fontSize: 'medium',
            reducedMotion: false,
          },
          notifications: {
            email: true,
            push: false,
            studyReminders: true,
            weeklyProgress: true,
            newFeatures: true,
          },
          privacy: {
            profileVisibility: 'private',
            shareProgress: false,
            allowAnalytics: true,
          },
          learning: {
            autoPlay: true,
            playbackSpeed: 1.0,
            subtitles: true,
            keyboardShortcuts: true,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    // Create welcome learning capsule (optional)
    if (process.env.CREATE_WELCOME_CAPSULE === 'true') {
      await createWelcomeCapsule(userId, tableName);
    }

    logger.info('User profile created successfully', {
      userId,
      email,
      name: userProfile.name,
    });

    return event.response;
  } catch (error) {
    logger.error('Failed to create user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userName: event.userName,
      userAttributes: event.request.userAttributes,
    });

    // Don't throw error here as it would prevent user confirmation
    // Instead, log the error and let the confirmation proceed
    // The user profile can be created later through the API
    return event.response;
  }
}

/**
 * Create a welcome learning capsule for new users
 */
async function createWelcomeCapsule(userId: string, tableName: string): Promise<void> {
  try {
    const welcomeCapsuleId = `welcome-${userId}`;
    const welcomeCapsule = {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${welcomeCapsuleId}`,
      GSI1PK: `CAPSULE#${welcomeCapsuleId}`,
      GSI1SK: `USER#${userId}`,
      EntityType: 'LearningCapsule',
      id: welcomeCapsuleId,
      userId,
      title: 'Welcome to YouTube Learning Platform',
      description: 'Learn how to use the platform effectively',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Replace with actual welcome video
      thumbnail: null,
      duration: 300, // 5 minutes
      status: 'ready',
      tags: ['welcome', 'tutorial', 'getting-started'],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: {
        content: 'Welcome to your learning journey! This platform helps you create interactive learning materials from YouTube videos.',
        keyPoints: [
          'How to process YouTube videos',
          'Using AI-generated flashcards',
          'Taking interactive quizzes',
          'Tracking your progress',
        ],
      },
      progress: {
        completed: false,
        watchTime: 0,
        lastWatched: null,
        completionPercentage: 0,
      },
    };

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: welcomeCapsule,
    }));

    logger.info('Welcome capsule created', { userId, capsuleId: welcomeCapsuleId });
  } catch (error) {
    logger.error('Failed to create welcome capsule', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    // Don't throw - this is optional
  }
}