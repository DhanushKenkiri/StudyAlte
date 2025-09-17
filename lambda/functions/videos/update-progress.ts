import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface UpdateProgressRequest {
  userId: string;
  capsuleId: string;
  step: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  progress?: number;
  error?: any;
  metadata?: any;
  completed?: boolean;
  failed?: boolean;
}

/**
 * Update processing progress for a learning capsule
 */
async function updateProgressHandler(event: UpdateProgressRequest) {
  const { userId, capsuleId, step, status, progress, error, metadata, completed, failed } = event;

  try {
    logger.info('Updating processing progress', {
      userId,
      capsuleId,
      step,
      status,
      progress,
      completed,
      failed,
    });

    const now = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update the timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    // Update processing status for the specific step
    updateExpressions.push(`processingStatus.#step = :status`);
    expressionAttributeNames['#step'] = step;
    expressionAttributeValues[':status'] = status;

    // Update progress percentage if provided
    if (progress !== undefined) {
      updateExpressions.push('progress.percentage = :progress');
      updateExpressions.push('progress.currentStep = :currentStep');
      expressionAttributeValues[':progress'] = progress;
      expressionAttributeValues[':currentStep'] = step;
    }

    // Handle completion
    if (completed) {
      updateExpressions.push('#status = :completedStatus');
      updateExpressions.push('progress.completed = :completed');
      updateExpressions.push('completedAt = :completedAt');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':completedStatus'] = 'completed';
      expressionAttributeValues[':completed'] = true;
      expressionAttributeValues[':completedAt'] = now;
    }

    // Handle failure
    if (failed) {
      updateExpressions.push('#status = :failedStatus');
      updateExpressions.push('progress.completed = :failed');
      updateExpressions.push('completedAt = :completedAt');
      if (error) {
        updateExpressions.push('#error = :error');
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = error;
      }
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':failedStatus'] = 'failed';
      expressionAttributeValues[':failed'] = false;
      expressionAttributeValues[':completedAt'] = now;
    }

    // Add metadata if provided (typically for validation step)
    if (metadata) {
      updateExpressions.push('metadata = :metadata');
      expressionAttributeValues[':metadata'] = metadata;
      
      // Update title if metadata contains it
      if (metadata.title) {
        updateExpressions.push('title = :title');
        expressionAttributeValues[':title'] = metadata.title;
      }
    }

    // Add error information if provided
    if (error && !failed) {
      updateExpressions.push(`processingStatus.#step = :errorStatus`);
      updateExpressions.push(`errors.#step = :stepError`);
      expressionAttributeValues[':errorStatus'] = 'failed';
      expressionAttributeValues[':stepError'] = error;
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(updateCommand);

    logger.info('Progress updated successfully', {
      userId,
      capsuleId,
      step,
      status,
      progress,
      updatedItem: result.Attributes,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        capsuleId,
        step,
        status,
        progress,
        updatedAt: now,
      },
    };
  } catch (error) {
    logger.error('Failed to update progress', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      step,
      status,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Get current processing status for a capsule
 */
async function getProgressHandler(event: { userId: string; capsuleId: string }) {
  const { userId, capsuleId } = event;

  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
    }));

    if (!result.Item) {
      throw new Error('Learning capsule not found');
    }

    return {
      statusCode: 200,
      body: {
        capsuleId: result.Item.id,
        status: result.Item.status,
        progress: result.Item.progress,
        processingStatus: result.Item.processingStatus,
        errors: result.Item.errors,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt,
        completedAt: result.Item.completedAt,
      },
    };
  } catch (error) {
    logger.error('Failed to get progress', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });

    throw error;
  }
}

// Export handlers
export const updateHandler = createHandler(updateProgressHandler);
export const getHandler = createHandler(getProgressHandler);