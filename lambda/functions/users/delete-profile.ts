import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Delete user profile handler
 * Completely removes user profile and all associated data
 */
async function deleteProfileHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const targetUserId = event.pathParameters?.userId;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  // Users can only delete their own profile (unless admin)
  if (targetUserId && targetUserId !== userId) {
    return createErrorResponse(403, 'FORBIDDEN', 'Cannot delete another user\'s profile');
  }

  const profileUserId = targetUserId || userId;

  try {
    // Get all user data from DynamoDB
    const userDataQuery = await docClient.send(new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${profileUserId}`,
      },
    }));

    if (!userDataQuery.Items || userDataQuery.Items.length === 0) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    // Delete user files from S3
    try {
      const s3Objects = await s3Client.send(new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME!,
        Prefix: `users/${profileUserId}/`,
      }));

      if (s3Objects.Contents && s3Objects.Contents.length > 0) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Delete: {
            Objects: s3Objects.Contents.map(obj => ({ Key: obj.Key! })),
          },
        }));

        logger.info('Deleted user files from S3', {
          userId: profileUserId,
          fileCount: s3Objects.Contents.length,
        });
      }
    } catch (s3Error) {
      logger.warn('Failed to delete user files from S3', {
        userId: profileUserId,
        error: s3Error instanceof Error ? s3Error.message : 'Unknown S3 error',
      });
      // Continue with DynamoDB deletion even if S3 fails
    }

    // Delete all user data from DynamoDB in batches
    const itemsToDelete = userDataQuery.Items.map(item => ({
      DeleteRequest: {
        Key: {
          PK: item.PK,
          SK: item.SK,
        },
      },
    }));

    // DynamoDB batch write can handle up to 25 items at a time
    const batchSize = 25;
    for (let i = 0; i < itemsToDelete.length; i += batchSize) {
      const batch = itemsToDelete.slice(i, i + batchSize);
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.DYNAMODB_TABLE_NAME!]: batch,
        },
      }));
    }

    // Also delete any user data indexed by email (GSI1)
    const emailQuery = await docClient.send(new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `USER#${event.requestContext.authorizer?.claims?.email}`,
      },
    }));

    if (emailQuery.Items && emailQuery.Items.length > 0) {
      const emailItemsToDelete = emailQuery.Items.map(item => ({
        DeleteRequest: {
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        },
      }));

      for (let i = 0; i < emailItemsToDelete.length; i += batchSize) {
        const batch = emailItemsToDelete.slice(i, i + batchSize);
        
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [process.env.DYNAMODB_TABLE_NAME!]: batch,
          },
        }));
      }
    }

    logger.info('User profile and all associated data deleted successfully', {
      userId: profileUserId,
      itemsDeleted: userDataQuery.Items.length,
    });

    return createSuccessResponse({
      message: 'User profile deleted successfully',
      deletedItems: userDataQuery.Items.length,
    });
  } catch (error) {
    logger.error('Failed to delete user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profileUserId,
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to delete user profile');
  }
}

export const handler = createHandler(deleteProfileHandler);