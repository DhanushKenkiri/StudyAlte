import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';
import { User } from '../../../src/types/user';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface UpdateProfileRequest {
  name?: string;
  preferences?: Partial<User['preferences']>;
  profile?: Partial<User['profile']>;
  onboardingCompleted?: boolean;
}

/**
 * Update user profile handler
 * Updates user profile information in DynamoDB
 */
async function updateProfileHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const targetUserId = event.pathParameters?.userId;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  // Users can only update their own profile (unless admin)
  if (targetUserId && targetUserId !== userId) {
    return createErrorResponse(403, 'FORBIDDEN', 'Cannot update another user\'s profile');
  }

  const profileUserId = targetUserId || userId;

  try {
    const requestBody: UpdateProfileRequest = JSON.parse(event.body || '{}');
    
    // Get current profile
    const currentProfile = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${profileUserId}`,
        SK: `PROFILE#${profileUserId}`,
      },
    }));

    if (!currentProfile.Item) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    const now = new Date().toISOString();
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression dynamically
    if (requestBody.name) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = requestBody.name;
    }

    if (requestBody.preferences) {
      // Merge preferences with existing ones
      const currentPreferences = currentProfile.Item.preferences || {};
      const updatedPreferences = {
        ...currentPreferences,
        ...requestBody.preferences,
        // Deep merge nested objects
        notifications: {
          ...currentPreferences.notifications,
          ...requestBody.preferences.notifications,
        },
        privacy: {
          ...currentPreferences.privacy,
          ...requestBody.preferences.privacy,
        },
        learning: {
          ...currentPreferences.learning,
          ...requestBody.preferences.learning,
          studyGoals: {
            ...currentPreferences.learning?.studyGoals,
            ...requestBody.preferences.learning?.studyGoals,
          },
        },
      };

      updateExpressions.push('#preferences = :preferences');
      expressionAttributeNames['#preferences'] = 'preferences';
      expressionAttributeValues[':preferences'] = updatedPreferences;
    }

    if (requestBody.profile) {
      // Merge profile with existing one
      const currentProfileData = currentProfile.Item.profile || {};
      const updatedProfile = {
        ...currentProfileData,
        ...requestBody.profile,
        socialLinks: {
          ...currentProfileData.socialLinks,
          ...requestBody.profile.socialLinks,
        },
      };

      updateExpressions.push('#profile = :profile');
      expressionAttributeNames['#profile'] = 'profile';
      expressionAttributeValues[':profile'] = updatedProfile;
    }

    if (typeof requestBody.onboardingCompleted === 'boolean') {
      updateExpressions.push('#onboardingCompleted = :onboardingCompleted');
      expressionAttributeNames['#onboardingCompleted'] = 'onboardingCompleted';
      expressionAttributeValues[':onboardingCompleted'] = requestBody.onboardingCompleted;
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    if (updateExpressions.length === 1) { // Only updatedAt
      return createErrorResponse(400, 'VALIDATION_ERROR', 'No valid fields to update');
    }

    // Update the profile
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${profileUserId}`,
        SK: `PROFILE#${profileUserId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(PK)',
    }));

    logger.info('User profile updated successfully', {
      userId: profileUserId,
      updatedFields: Object.keys(requestBody),
    });

    // Transform DynamoDB item back to User type
    const updatedUser = updateResult.Attributes as User;

    return createSuccessResponse(updatedUser);
  } catch (error) {
    logger.error('Failed to update user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profileUserId,
    });

    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to update user profile');
  }
}

export const handler = createHandler(updateProfileHandler);