import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';
import { validateUserProfile } from '../../shared/validation';
import { User } from '../../../src/types/user';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface CreateProfileRequest {
  email: string;
  name: string;
  preferences?: Partial<User['preferences']>;
  profile?: Partial<User['profile']>;
}

/**
 * Create user profile handler
 * Creates a new user profile in DynamoDB
 */
async function createProfileHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const userEmail = event.requestContext.authorizer?.claims?.email;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  try {
    const requestBody: CreateProfileRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!requestBody.email || !requestBody.name) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Email and name are required');
    }

    // Check if profile already exists
    const existingProfile = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
      },
    }));

    if (existingProfile.Item) {
      return createErrorResponse(409, 'PROFILE_EXISTS', 'User profile already exists');
    }

    // Create user profile
    const now = new Date().toISOString();
    const userProfile: User = {
      id: userId,
      email: requestBody.email,
      name: requestBody.name,
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
        ...requestBody.preferences,
      },
      subscription: {
        tier: 'free',
        status: 'active',
        startDate: now,
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
        ...requestBody.profile,
      },
      stats: {
        totalCapsules: 0,
        totalStudyTime: 0,
        currentStreak: 0,
        longestStreak: 0,
        completedQuizzes: 0,
        averageQuizScore: 0,
      },
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      isActive: true,
      emailVerified: true,
      onboardingCompleted: false,
    };

    // Validate user profile
    validateUserProfile(userProfile);

    // Store user profile
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Item: {
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
        GSI1PK: `USER#${requestBody.email}`,
        GSI1SK: `PROFILE#${userId}`,
        GSI2PK: `SUBSCRIPTION#${userProfile.subscription.tier}`,
        GSI2SK: `USER#${userId}`,
        EntityType: 'User',
        ...userProfile,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));

    logger.info('User profile created successfully', {
      userId,
      email: requestBody.email,
      name: requestBody.name,
    });

    return createSuccessResponse(userProfile, 201);
  } catch (error) {
    logger.error('Failed to create user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      userEmail,
    });

    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return createErrorResponse(409, 'PROFILE_EXISTS', 'User profile already exists');
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to create user profile');
  }
}

export const handler = createHandler(createProfileHandler);