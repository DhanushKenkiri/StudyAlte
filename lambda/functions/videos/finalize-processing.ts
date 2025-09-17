import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface FinalizeProcessingRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  description?: string;
  tags?: string[];
  options: any;
  validationResult?: any;
  transcriptResult?: any;
  summaryResult?: any;
  flashcardsResult?: any;
  quizResult?: any;
  mindMapResult?: any;
  notesResult?: any;
}

/**
 * Finalize video processing by consolidating all results
 */
async function finalizeProcessingHandler(event: FinalizeProcessingRequest) {
  const { 
    userId, 
    capsuleId, 
    videoId, 
    videoUrl, 
    title, 
    description, 
    tags,
    options,
    validationResult,
    transcriptResult,
    summaryResult,
    flashcardsResult,
    quizResult,
    mindMapResult,
    notesResult
  } = event;

  try {
    logger.info('Finalizing video processing', {
      userId,
      capsuleId,
      videoId,
      hasTranscript: !!transcriptResult,
      hasSummary: !!summaryResult,
      hasFlashcards: !!flashcardsResult,
      hasQuiz: !!quizResult,
      hasMindMap: !!mindMapResult,
      hasNotes: !!notesResult,
    });

    const now = new Date().toISOString();

    // Get current capsule to check what was processed
    const currentCapsule = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
    }));

    if (!currentCapsule.Item) {
      throw new Error('Learning capsule not found');
    }

    // Build the learning content object
    const learningContent: any = {};

    // Add transcript if available
    if (transcriptResult?.Payload?.transcript) {
      learningContent.transcript = {
        text: transcriptResult.Payload.transcript,
        segments: transcriptResult.Payload.segments || [],
        language: transcriptResult.Payload.language || 'en',
        confidence: transcriptResult.Payload.confidence,
        generatedAt: now,
      };
    }

    // Add summary if available
    if (summaryResult?.Payload?.summary) {
      learningContent.summary = {
        text: summaryResult.Payload.summary,
        keyPoints: summaryResult.Payload.keyPoints || [],
        topics: summaryResult.Payload.topics || [],
        generatedAt: now,
      };
    }

    // Add flashcards if available
    if (flashcardsResult?.Payload?.flashcards) {
      learningContent.flashcards = {
        cards: flashcardsResult.Payload.flashcards,
        totalCount: flashcardsResult.Payload.flashcards.length,
        categories: flashcardsResult.Payload.categories || [],
        generatedAt: now,
      };
    }

    // Add quiz if available
    if (quizResult?.Payload?.quiz) {
      learningContent.quiz = {
        questions: quizResult.Payload.quiz,
        totalQuestions: quizResult.Payload.quiz.length,
        difficulty: quizResult.Payload.difficulty || 'medium',
        estimatedTime: quizResult.Payload.estimatedTime || 10,
        generatedAt: now,
      };
    }

    // Add mind map if available
    if (mindMapResult?.Payload?.mindMap) {
      learningContent.mindMap = {
        nodes: mindMapResult.Payload.mindMap.nodes || [],
        edges: mindMapResult.Payload.mindMap.edges || [],
        layout: mindMapResult.Payload.mindMap.layout || 'hierarchical',
        generatedAt: now,
      };
    }

    // Add notes if available
    if (notesResult?.Payload?.notes) {
      learningContent.notes = {
        content: notesResult.Payload.notes,
        sections: notesResult.Payload.sections || [],
        format: notesResult.Payload.format || 'markdown',
        generatedAt: now,
      };
    }

    // Calculate processing statistics
    const processingStats = {
      totalSteps: Object.keys(currentCapsule.Item.processingStatus).length,
      completedSteps: Object.values(currentCapsule.Item.processingStatus).filter(
        status => status === 'completed'
      ).length,
      failedSteps: Object.values(currentCapsule.Item.processingStatus).filter(
        status => status === 'failed'
      ).length,
      skippedSteps: Object.values(currentCapsule.Item.processingStatus).filter(
        status => status === 'skipped'
      ).length,
      processingTime: new Date(now).getTime() - new Date(currentCapsule.Item.startedAt).getTime(),
    };

    // Update the capsule with final results
    const updateCommand = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent = :learningContent,
          processingStats = :processingStats,
          finalizedAt = :finalizedAt,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':learningContent': learningContent,
        ':processingStats': processingStats,
        ':finalizedAt': now,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(updateCommand);

    // Log successful completion
    logger.info('Video processing finalized successfully', {
      userId,
      capsuleId,
      videoId,
      processingStats,
      contentGenerated: {
        transcript: !!learningContent.transcript,
        summary: !!learningContent.summary,
        flashcards: !!learningContent.flashcards,
        quiz: !!learningContent.quiz,
        mindMap: !!learningContent.mindMap,
        notes: !!learningContent.notes,
      },
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        capsuleId,
        videoId,
        processingStats,
        learningContent: Object.keys(learningContent),
        finalizedAt: now,
      },
    };
  } catch (error) {
    logger.error('Failed to finalize video processing', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update capsule with error status
    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Key: {
          PK: `USER#${userId}`,
          SK: `CAPSULE#${capsuleId}`,
        },
        UpdateExpression: `
          SET 
            #status = :status,
            #error = :error,
            completedAt = :completedAt,
            #updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: {
          '#status': 'status',
          '#error': 'error',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':status': 'failed',
          ':error': {
            step: 'finalization',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
          ':completedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
        },
      }));
    } catch (updateError) {
      logger.error('Failed to update capsule with error status', {
        error: updateError instanceof Error ? updateError.message : 'Unknown error',
        userId,
        capsuleId,
      });
    }

    throw error;
  }
}

// Export handler
export const handler = createHandler(finalizeProcessingHandler);