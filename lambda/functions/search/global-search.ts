import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
import { searchUserContent, GlobalSearchRequest, GlobalSearchResult } from '../../services/notes-search';

const logger = new Logger('global-search');
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface GlobalSearchEvent {
  query: string;
  filters?: {
    contentType?: 'all' | 'capsules' | 'notes' | 'flashcards' | 'quizzes' | 'mindmaps';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    dateRange?: {
      from: string;
      to: string;
    };
  };
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: 'relevance' | 'date' | 'title';
    order: 'asc' | 'desc';
  };
}

/**
 * Global search across all user content
 */
export const handler = createHandler(async (event: GlobalSearchEvent) => {
  const { userId } = event.requestContext.authorizer.claims;
  const { query, filters = {}, pagination = { page: 1, limit: 20 }, sort = { field: 'relevance', order: 'desc' } } = event;

  logger.info('Processing global search request', {
    userId,
    query,
    filters,
    pagination,
    sort,
  });

  if (!query || query.trim().length < 2) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: 'Query must be at least 2 characters long',
      },
    };
  }

  try {
    const searchRequest: GlobalSearchRequest = {
      userId,
      query: query.trim(),
      filters: {
        contentType: filters.contentType || 'all',
        difficulty: filters.difficulty,
        tags: filters.tags || [],
        dateRange: filters.dateRange,
      },
      pagination: {
        page: Math.max(1, pagination.page),
        limit: Math.min(100, Math.max(1, pagination.limit)),
      },
      sort: {
        field: sort.field,
        order: sort.order,
      },
    };

    const searchResult = await searchUserContent(searchRequest);

    logger.info('Global search completed successfully', {
      userId,
      query,
      totalResults: searchResult.totalResults,
      resultsReturned: searchResult.results.length,
      searchTime: searchResult.searchTime,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        ...searchResult,
      },
    };
  } catch (error) {
    logger.error('Global search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      query,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to perform search',
      },
    };
  }
}, {
  allowedMethods: ['GET'],
});
