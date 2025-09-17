import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { generateAutoTags, applyCapsuleTags, TaggingOptions, Tag } from '../../services/tagging-system';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface GenerateTagsRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  options?: TaggingOptions;
  existingTags?: Tag[];
}

/**
 * Generate automatic tags for a learning capsule
 */
async function generateTagsHandler(event: GenerateTagsRequest) {
  const { userId, capsuleId, videoId, options = {}, existingTags = [] } = event;

  try {
    logger.info('Starting automatic tag generation', {
      userId,
      capsuleId,
      videoId,
      options,
    });

    // Get capsule content from database
    const capsuleResult = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
    }));

    if (!capsuleResult.Item) {
      throw new Error(`Capsule not found: ${capsuleId}`);
    }

    const capsule = capsuleResult.Item;
    const learningContent = capsule.learningContent || {};

    // Extract content for analysis
    const transcript = learningContent.transcript?.text || '';
    const summary = learningContent.summary?.summary || '';
    const keyPoints = learningContent.summary?.keyPoints || [];

    if (!transcript && !summary) {
      throw new Error('No content available for tag generation');
    }

    // Extract video metadata
    const videoMetadata = {
      title: capsule.videoTitle || '',
      description: capsule.videoDescription || '',
      duration: capsule.videoDuration || 0,
      channelTitle: capsule.channelTitle || '',
      tags: capsule.videoTags || [],
      language: learningContent.transcript?.language || 'en',
    };

    // Generate automatic tags
    const suggestedTags = await generateAutoTags(
      transcript,
      summary,
      keyPoints,
      videoMetadata,
      options
    );

    // Convert suggestions to tags (keeping existing tags)
    const newTags: Tag[] = suggestedTags.map(suggestion => ({
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...suggestion.tag,
      createdAt: new Date().toISOString(),
      confidence: suggestion.confidence,
    }));

    // Combine with existing tags, avoiding duplicates
    const allTags = [...existingTags];
    newTags.forEach(newTag => {
      const exists = allTags.some(existingTag => 
        existingTag.name.toLowerCase() === newTag.name.toLowerCase() &&
        existingTag.category === newTag.category
      );
      if (!exists) {
        allTags.push(newTag);
      }
    });

    // Apply tags to capsule
    const capsuleTagging = await applyCapsuleTags(
      capsuleId,
      allTags,
      suggestedTags
    );

    // Update capsule in database with tags
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          tags = :tags,
          tagSuggestions = :tagSuggestions,
          tagCategories = :tagCategories,
          autoTaggingEnabled = :autoTaggingEnabled,
          tagsLastUpdated = :tagsLastUpdated,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':tags': capsuleTagging.tags,
        ':tagSuggestions': capsuleTagging.suggestedTags,
        ':tagCategories': capsuleTagging.categories,
        ':autoTaggingEnabled': capsuleTagging.autoTaggingEnabled,
        ':tagsLastUpdated': capsuleTagging.lastUpdated,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Automatic tag generation completed', {
      userId,
      capsuleId,
      totalTags: allTags.length,
      newTags: newTags.length,
      suggestedTags: suggestedTags.length,
      categories: Object.keys(capsuleTagging.categories).filter(
        category => capsuleTagging.categories[category as keyof typeof capsuleTagging.categories].length > 0
      ),
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        tagging: capsuleTagging,
        newTagsGenerated: newTags.length,
        totalTags: allTags.length,
      },
    };
  } catch (error) {
    logger.error('Failed to generate automatic tags', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

// Export handler
export const handler = createHandler(generateTagsHandler);
