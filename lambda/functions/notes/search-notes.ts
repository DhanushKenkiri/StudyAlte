import { createHandler } from '../../shared/handler';
import { Logger } from '../../shared/logger';
const logger = new Logger('search-notes');
import { searchUserNotes, EnhancedSearchRequest } from '../../services/notes-search';

interface SearchNotesEvent extends EnhancedSearchRequest {
  // Additional event properties if needed
}

/**
 * Lambda function to search user's notes
 */
async function searchNotesHandler(event: SearchNotesEvent) {
  const { userId, query, filters, options } = event;

  try {
    logger.info('Starting notes search', {
      userId,
      query,
      filters,
      options,
    });

    // Validate required parameters
    if (!userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'User ID is required',
        },
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Search query is required',
        },
      };
    }

    // Validate query length
    if (query.length > 500) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Search query is too long (maximum 500 characters)',
        },
      };
    }

    // Perform the search
    const searchResults = await searchUserNotes({
      userId,
      query: query.trim(),
      filters: filters || {},
      options: options || {},
    });

    logger.info('Notes search completed successfully', {
      userId,
      query,
      totalResults: searchResults.totalResults,
      returnedResults: searchResults.results.length,
      searchTime: searchResults.searchTime,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: searchResults,
      },
    };
  } catch (error) {
    logger.error('Notes search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      query,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error during search',
      },
    };
  }
}

export const handler = createHandler(searchNotesHandler);