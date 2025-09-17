import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { createSuccessResponse, createErrorResponse } from '../../shared/response';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface UploadAvatarRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface UploadAvatarResponse {
  uploadUrl: string;
  avatarUrl: string;
  expiresIn: number;
}

/**
 * Upload avatar handler
 * Generates a pre-signed URL for avatar upload and updates user profile
 */
async function uploadAvatarHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const targetUserId = event.pathParameters?.userId;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  // Users can only upload their own avatar (unless admin)
  if (targetUserId && targetUserId !== userId) {
    return createErrorResponse(403, 'FORBIDDEN', 'Cannot upload avatar for another user');
  }

  const profileUserId = targetUserId || userId;

  try {
    const requestBody: UploadAvatarRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!requestBody.fileName || !requestBody.fileType || !requestBody.fileSize) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'fileName, fileType, and fileSize are required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(requestBody.fileType.toLowerCase())) {
      return createErrorResponse(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, and WebP images are allowed');
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (requestBody.fileSize > maxSize) {
      return createErrorResponse(400, 'FILE_TOO_LARGE', 'File size must be less than 5MB');
    }

    // Generate unique file name
    const timestamp = Date.now();
    const fileExtension = requestBody.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const s3Key = `users/${profileUserId}/avatar/${timestamp}.${fileExtension}`;

    // Generate pre-signed URL for upload
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      ContentType: requestBody.fileType,
      ContentLength: requestBody.fileSize,
      Metadata: {
        userId: profileUserId,
        originalName: requestBody.fileName,
        uploadedAt: new Date().toISOString(),
      },
      // Set cache control for better performance
      CacheControl: 'max-age=31536000', // 1 year
    });

    const uploadUrl = await getSignedUrl(s3Client, uploadCommand, {
      expiresIn: 300, // 5 minutes
    });

    // Generate the public URL for the avatar
    const avatarUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Update user profile with new avatar URL
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${profileUserId}`,
        SK: `PROFILE#${profileUserId}`,
      },
      UpdateExpression: 'SET #profile.#avatar = :avatarUrl, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#profile': 'profile',
        '#avatar': 'avatar',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':avatarUrl': avatarUrl,
        ':updatedAt': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(PK)',
    }));

    logger.info('Avatar upload URL generated successfully', {
      userId: profileUserId,
      fileName: requestBody.fileName,
      fileType: requestBody.fileType,
      fileSize: requestBody.fileSize,
      s3Key,
    });

    const response: UploadAvatarResponse = {
      uploadUrl,
      avatarUrl,
      expiresIn: 300,
    };

    return createSuccessResponse(response);
  } catch (error) {
    logger.error('Failed to generate avatar upload URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profileUserId,
    });

    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate upload URL');
  }
}

/**
 * Delete avatar handler
 * Removes the current avatar from S3 and updates user profile
 */
async function deleteAvatarHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const targetUserId = event.pathParameters?.userId;

  if (!userId) {
    return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
  }

  // Users can only delete their own avatar (unless admin)
  if (targetUserId && targetUserId !== userId) {
    return createErrorResponse(403, 'FORBIDDEN', 'Cannot delete avatar for another user');
  }

  const profileUserId = targetUserId || userId;

  try {
    // Update user profile to remove avatar URL
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${profileUserId}`,
        SK: `PROFILE#${profileUserId}`,
      },
      UpdateExpression: 'SET #profile.#avatar = :null, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#profile': 'profile',
        '#avatar': 'avatar',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':null': null,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_OLD',
      ConditionExpression: 'attribute_exists(PK)',
    }));

    // Extract S3 key from old avatar URL and delete from S3
    const oldAvatarUrl = updateResult.Attributes?.profile?.avatar;
    if (oldAvatarUrl && typeof oldAvatarUrl === 'string') {
      try {
        // Extract S3 key from URL
        const urlParts = oldAvatarUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part.includes('.s3.'));
        if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
          const s3Key = urlParts.slice(bucketIndex + 1).join('/');
          
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: s3Key,
          }));

          logger.info('Avatar deleted from S3', {
            userId: profileUserId,
            s3Key,
          });
        }
      } catch (s3Error) {
        logger.warn('Failed to delete avatar from S3', {
          userId: profileUserId,
          avatarUrl: oldAvatarUrl,
          error: s3Error instanceof Error ? s3Error.message : 'Unknown S3 error',
        });
        // Continue even if S3 deletion fails
      }
    }

    logger.info('Avatar deleted successfully', {
      userId: profileUserId,
    });

    return createSuccessResponse({
      message: 'Avatar deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete avatar', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: profileUserId,
    });

    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to delete avatar');
  }
}

// Export both handlers
export const uploadHandler = createHandler(uploadAvatarHandler);
export const deleteHandler = createHandler(deleteAvatarHandler);