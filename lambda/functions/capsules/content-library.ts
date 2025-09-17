import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import { 
  getContentLibrary, 
  performBulkOperation,
  LibraryRequest,
  LibraryFilter,
  LibrarySortOption,
  LibraryView 
} from '../../services/content-library';

interface ContentLibraryRequest {
  userId: string;
  action: 'get' | 'bulk';
  filters?: LibraryFilter;
  sort?: LibrarySortOption;
  view?: LibraryView;
  includeStatistics?: boolean;
  // For bulk operations
  bulkOperation?: {
    operation: 'delete' | 'archive' | 'addTags' | 'removeTags' | 'export';
    capsuleIds: string[];
    operationData?: any;
  };
}

/**
 * Handle content library requests
 */
async function contentLibraryHandler(event: ContentLibraryRequest) {
  const { userId, action } = event;

  try {
    logger.info('Processing content library request', {
      userId,
      action,
    });

    switch (action) {
      case 'get':
        return await handleGetLibrary(event);
      
      case 'bulk':
        return await handleBulkOperation(event);
      
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  } catch (error) {
    logger.error('Failed to process content library request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      action,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Handle getting the content library
 */
async function handleGetLibrary(event: ContentLibraryRequest) {
  const {
    userId,
    filters,
    sort,
    view,
    includeStatistics,
  } = event;

  const request: LibraryRequest = {
    userId,
    filters,
    sort,
    view,
    includeStatistics,
  };

  const library = await getContentLibrary(request);

  logger.info('Content library retrieved successfully', {
    userId,
    totalCount: library.totalCount,
    filteredCount: library.filteredCount,
    returnedCount: library.capsules.length,
    appliedFilters: Object.keys(library.appliedFilters || {}).length,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      library,
    },
  };
}

/**
 * Handle bulk operations on capsules
 */
async function handleBulkOperation(event: ContentLibraryRequest) {
  const { userId, bulkOperation } = event;

  if (!bulkOperation) {
    throw new Error('Bulk operation data is required');
  }

  const { operation, capsuleIds, operationData } = bulkOperation;

  if (!capsuleIds || capsuleIds.length === 0) {
    throw new Error('Capsule IDs are required for bulk operations');
  }

  const result = await performBulkOperation(
    userId,
    capsuleIds,
    operation,
    operationData
  );

  logger.info('Bulk operation completed', {
    userId,
    operation,
    capsuleCount: capsuleIds.length,
    processedCount: result.processedCount,
    errorCount: result.errors.length,
  });

  return {
    statusCode: 200,
    body: {
      success: result.success,
      result,
    },
  };
}

// Export handler
export const handler = createHandler(contentLibraryHandler);
