import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { Tag, TagCategory, applyCapsuleTags, getTagSuggestions } from '../../services/tagging-system';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ManageTagsRequest {
  userId: string;
  capsuleId: string;
  action: 'add' | 'remove' | 'update' | 'get' | 'suggest';
  tags?: Partial<Tag>[];
  tagIds?: string[];
  query?: string; // For tag suggestions
}

/**
 * Manage tags for a learning capsule
 */
async function manageTagsHandler(event: ManageTagsRequest) {
  const { userId, capsuleId, action, tags = [], tagIds = [], query = '' } = event;

  try {
    logger.info('Managing capsule tags', {
      userId,
      capsuleId,
      action,
      tagCount: tags.length,
      tagIds: tagIds.length,
    });

    switch (action) {
      case 'get':
        return await getCapsuleTags(userId, capsuleId);
      
      case 'suggest':
        return await suggestTags(userId, query);
      
      case 'add':
        return await addTags(userId, capsuleId, tags);
      
      case 'remove':
        return await removeTags(userId, capsuleId, tagIds);
      
      case 'update':
        return await updateTags(userId, capsuleId, tags);
      
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to manage tags', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      action,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Get all tags for a capsule
 */
async function getCapsuleTags(userId: string, capsuleId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
    ProjectionExpression: 'tags, tagCategories, tagSuggestions, autoTaggingEnabled, tagsLastUpdated',
  }));

  if (!result.Item) {
    throw new Error(`Capsule not found: ${capsuleId}`);
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      tags: result.Item.tags || [],
      categories: result.Item.tagCategories || {},
      suggestions: result.Item.tagSuggestions || [],
      autoTaggingEnabled: result.Item.autoTaggingEnabled || false,
      lastUpdated: result.Item.tagsLastUpdated,
    },
  };
}

/**
 * Get tag suggestions based on query
 */
async function suggestTags(userId: string, query: string) {
  // Get user's existing tags from all capsules
  const result = await docClient.send(new QueryCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'CAPSULE#',
    },
    ProjectionExpression: 'tags',
  }));

  // Collect all unique tags from user's capsules
  const allTags: Tag[] = [];
  const tagSet = new Set<string>();

  result.Items?.forEach(item => {
    if (item.tags) {
      item.tags.forEach((tag: Tag) => {
        const tagKey = `${tag.name.toLowerCase()}-${tag.category}`;
        if (!tagSet.has(tagKey)) {
          tagSet.add(tagKey);
          allTags.push(tag);
        }
      });
    }
  });

  // Get suggestions
  const suggestions = await getTagSuggestions(query, allTags, 10);

  // Also include predefined tags that match the query
  const predefinedTags = getPredefinedTags().filter(tag =>
    tag.name.toLowerCase().includes(query.toLowerCase())
  );

  const combinedSuggestions = [...suggestions, ...predefinedTags]
    .slice(0, 15);

  return {
    statusCode: 200,
    body: {
      success: true,
      suggestions: combinedSuggestions,
      query,
    },
  };
}

/**
 * Add tags to a capsule
 */
async function addTags(userId: string, capsuleId: string, newTags: Partial<Tag>[]) {
  // Get current capsule data
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  if (!result.Item) {
    throw new Error(`Capsule not found: ${capsuleId}`);
  }

  const currentTags: Tag[] = result.Item.tags || [];

  // Create full tag objects
  const tagsToAdd: Tag[] = newTags.map(tag => ({
    id: tag.id || `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: tag.name || '',
    category: tag.category || 'custom',
    color: tag.color,
    description: tag.description,
    createdAt: tag.createdAt || new Date().toISOString(),
    createdBy: tag.createdBy || 'user',
    parentTagId: tag.parentTagId,
    isCustom: tag.isCustom !== undefined ? tag.isCustom : true,
  }));

  // Avoid duplicates
  const existingTagNames = new Set(
    currentTags.map(tag => `${tag.name.toLowerCase()}-${tag.category}`)
  );

  const uniqueNewTags = tagsToAdd.filter(tag => 
    !existingTagNames.has(`${tag.name.toLowerCase()}-${tag.category}`)
  );

  if (uniqueNewTags.length === 0) {
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'No new tags to add (duplicates filtered)',
        tags: currentTags,
      },
    };
  }

  const updatedTags = [...currentTags, ...uniqueNewTags];

  // Apply tags to get organized structure
  const capsuleTagging = await applyCapsuleTags(capsuleId, updatedTags);

  // Update in database
  await docClient.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
    UpdateExpression: `
      SET 
        tags = :tags,
        tagCategories = :tagCategories,
        tagsLastUpdated = :tagsLastUpdated,
        #updatedAt = :updatedAt
    `,
    ExpressionAttributeNames: {
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':tags': capsuleTagging.tags,
      ':tagCategories': capsuleTagging.categories,
      ':tagsLastUpdated': capsuleTagging.lastUpdated,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  logger.info('Tags added successfully', {
    userId,
    capsuleId,
    newTagsAdded: uniqueNewTags.length,
    totalTags: updatedTags.length,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      tagsAdded: uniqueNewTags.length,
      totalTags: updatedTags.length,
      tags: capsuleTagging.tags,
      categories: capsuleTagging.categories,
    },
  };
}

/**
 * Remove tags from a capsule
 */
async function removeTags(userId: string, capsuleId: string, tagIdsToRemove: string[]) {
  // Get current capsule data
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  if (!result.Item) {
    throw new Error(`Capsule not found: ${capsuleId}`);
  }

  const currentTags: Tag[] = result.Item.tags || [];
  const updatedTags = currentTags.filter(tag => !tagIdsToRemove.includes(tag.id));

  // Apply tags to get organized structure
  const capsuleTagging = await applyCapsuleTags(capsuleId, updatedTags);

  // Update in database
  await docClient.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
    UpdateExpression: `
      SET 
        tags = :tags,
        tagCategories = :tagCategories,
        tagsLastUpdated = :tagsLastUpdated,
        #updatedAt = :updatedAt
    `,
    ExpressionAttributeNames: {
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':tags': capsuleTagging.tags,
      ':tagCategories': capsuleTagging.categories,
      ':tagsLastUpdated': capsuleTagging.lastUpdated,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  logger.info('Tags removed successfully', {
    userId,
    capsuleId,
    tagsRemoved: tagIdsToRemove.length,
    totalTags: updatedTags.length,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      tagsRemoved: tagIdsToRemove.length,
      totalTags: updatedTags.length,
      tags: capsuleTagging.tags,
      categories: capsuleTagging.categories,
    },
  };
}

/**
 * Update existing tags
 */
async function updateTags(userId: string, capsuleId: string, tagsToUpdate: Partial<Tag>[]) {
  // Get current capsule data
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  if (!result.Item) {
    throw new Error(`Capsule not found: ${capsuleId}`);
  }

  const currentTags: Tag[] = result.Item.tags || [];

  // Update tags
  const updatedTags = currentTags.map(currentTag => {
    const updateData = tagsToUpdate.find(update => update.id === currentTag.id);
    return updateData ? { ...currentTag, ...updateData } : currentTag;
  });

  // Apply tags to get organized structure
  const capsuleTagging = await applyCapsuleTags(capsuleId, updatedTags);

  // Update in database
  await docClient.send(new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
    UpdateExpression: `
      SET 
        tags = :tags,
        tagCategories = :tagCategories,
        tagsLastUpdated = :tagsLastUpdated,
        #updatedAt = :updatedAt
    `,
    ExpressionAttributeNames: {
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':tags': capsuleTagging.tags,
      ':tagCategories': capsuleTagging.categories,
      ':tagsLastUpdated': capsuleTagging.lastUpdated,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  logger.info('Tags updated successfully', {
    userId,
    capsuleId,
    tagsUpdated: tagsToUpdate.length,
    totalTags: updatedTags.length,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      tagsUpdated: tagsToUpdate.length,
      totalTags: updatedTags.length,
      tags: capsuleTagging.tags,
      categories: capsuleTagging.categories,
    },
  };
}

/**
 * Get predefined tags for suggestions
 */
function getPredefinedTags(): Tag[] {
  return [
    // Subject tags
    { id: 'subj-prog', name: 'Programming', category: 'subject', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'subj-math', name: 'Mathematics', category: 'subject', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'subj-sci', name: 'Science', category: 'subject', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'subj-bus', name: 'Business', category: 'subject', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'subj-des', name: 'Design', category: 'subject', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    
    // Difficulty tags
    { id: 'diff-beg', name: 'Beginner', category: 'difficulty', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'diff-int', name: 'Intermediate', category: 'difficulty', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'diff-adv', name: 'Advanced', category: 'difficulty', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    
    // Format tags
    { id: 'fmt-tut', name: 'Tutorial', category: 'format', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'fmt-demo', name: 'Demo', category: 'format', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'fmt-lec', name: 'Lecture', category: 'format', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
    { id: 'fmt-quick', name: 'Quick Guide', category: 'format', createdBy: 'system', isCustom: false, createdAt: new Date().toISOString() },
  ];
}

// Export handler
export const handler = createHandler(manageTagsHandler);
