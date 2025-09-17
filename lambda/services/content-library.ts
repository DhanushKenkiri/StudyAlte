import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../shared/logger';
import { Tag } from './tagging-system';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface CapsuleSummary {
  id: string;
  userId: string;
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  channelTitle: string;
  duration: number;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  progress?: {
    completionPercentage: number;
    lastStudied: string;
    studyTime: number;
  };
  learningContent: {
    hasTranscript: boolean;
    hasSummary: boolean;
    hasFlashcards: boolean;
    hasQuiz: boolean;
    hasMindMap: boolean;
    hasNotes: boolean;
  };
  statistics: {
    totalFlashcards: number;
    totalQuizQuestions: number;
    studySessions: number;
    averageScore: number;
  };
}

export interface LibraryFilter {
  tags?: string[]; // Tag names or IDs
  subjects?: string[];
  difficulty?: string[];
  formats?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  duration?: {
    min: number; // seconds
    max: number; // seconds
  };
  progress?: {
    completed?: boolean;
    inProgress?: boolean;
    notStarted?: boolean;
  };
  hasContent?: {
    transcript?: boolean;
    summary?: boolean;
    flashcards?: boolean;
    quiz?: boolean;
    mindMap?: boolean;
    notes?: boolean;
  };
  search?: string; // Text search in title/description
}

export interface LibrarySortOption {
  field: 'createdAt' | 'updatedAt' | 'title' | 'duration' | 'progress' | 'relevance';
  direction: 'asc' | 'desc';
}

export interface LibraryView {
  type: 'grid' | 'list' | 'table';
  itemsPerPage: number;
  page: number;
}

export interface LibraryRequest {
  userId: string;
  filters?: LibraryFilter;
  sort?: LibrarySortOption;
  view?: LibraryView;
  includeStatistics?: boolean;
}

export interface LibraryResponse {
  capsules: CapsuleSummary[];
  totalCount: number;
  filteredCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  aggregations: {
    tagCounts: Record<string, number>;
    subjectCounts: Record<string, number>;
    difficultyCounts: Record<string, number>;
    formatCounts: Record<string, number>;
    progressDistribution: {
      completed: number;
      inProgress: number;
      notStarted: number;
    };
  };
  appliedFilters: LibraryFilter;
  sortedBy: LibrarySortOption;
}

/**
 * Get user's content library with filtering, sorting, and pagination
 */
export async function getContentLibrary(request: LibraryRequest): Promise<LibraryResponse> {
  try {
    const {
      userId,
      filters = {},
      sort = { field: 'updatedAt', direction: 'desc' },
      view = { type: 'grid', itemsPerPage: 20, page: 1 },
      includeStatistics = true,
    } = request;

    logger.info('Fetching content library', {
      userId,
      filters,
      sort,
      view,
    });

    // Get all user's capsules
    const allCapsules = await getUserCapsules(userId);

    // Apply filters
    const filteredCapsules = applyFilters(allCapsules, filters);

    // Apply sorting
    const sortedCapsules = applySorting(filteredCapsules, sort);

    // Calculate pagination
    const totalCount = allCapsules.length;
    const filteredCount = filteredCapsules.length;
    const { itemsPerPage, page } = view;
    const totalPages = Math.ceil(filteredCount / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCapsules = sortedCapsules.slice(startIndex, endIndex);

    // Generate aggregations
    const aggregations = generateAggregations(allCapsules, filteredCapsules);

    const response: LibraryResponse = {
      capsules: paginatedCapsules,
      totalCount,
      filteredCount,
      pagination: {
        currentPage: page,
        totalPages,
        itemsPerPage,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      aggregations,
      appliedFilters: filters,
      sortedBy: sort,
    };

    logger.info('Content library fetched successfully', {
      userId,
      totalCount,
      filteredCount,
      returnedCount: paginatedCapsules.length,
      currentPage: page,
      totalPages,
    });

    return response;
  } catch (error) {
    logger.error('Failed to fetch content library', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: request.userId,
    });
    throw error;
  }
}

/**
 * Get all capsules for a user
 */
async function getUserCapsules(userId: string): Promise<CapsuleSummary[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'CAPSULE#',
    },
  }));

  return (result.Items || []).map(item => ({
    id: item.SK.replace('CAPSULE#', ''),
    userId: item.userId,
    videoId: item.videoId,
    videoTitle: item.videoTitle || '',
    videoDescription: item.videoDescription || '',
    channelTitle: item.channelTitle || '',
    duration: item.videoDuration || 0,
    thumbnail: item.videoThumbnail || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: item.tags || [],
    progress: item.progress,
    learningContent: {
      hasTranscript: Boolean(item.learningContent?.transcript),
      hasSummary: Boolean(item.learningContent?.summary),
      hasFlashcards: Boolean(item.learningContent?.flashcards),
      hasQuiz: Boolean(item.learningContent?.quiz),
      hasMindMap: Boolean(item.learningContent?.mindMap),
      hasNotes: Boolean(item.learningContent?.notes),
    },
    statistics: {
      totalFlashcards: item.learningContent?.flashcards?.cards?.length || 0,
      totalQuizQuestions: item.learningContent?.quiz?.questions?.length || 0,
      studySessions: item.statistics?.studySessions || 0,
      averageScore: item.statistics?.averageScore || 0,
    },
  }));
}

/**
 * Apply filters to capsules
 */
function applyFilters(capsules: CapsuleSummary[], filters: LibraryFilter): CapsuleSummary[] {
  let filtered = [...capsules];

  // Tag filters
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(capsule =>
      filters.tags!.some(filterTag =>
        capsule.tags.some(tag =>
          tag.name.toLowerCase().includes(filterTag.toLowerCase()) ||
          tag.id === filterTag
        )
      )
    );
  }

  // Subject filters
  if (filters.subjects && filters.subjects.length > 0) {
    filtered = filtered.filter(capsule =>
      filters.subjects!.some(subject =>
        capsule.tags.some(tag =>
          tag.category === 'subject' &&
          tag.name.toLowerCase().includes(subject.toLowerCase())
        )
      )
    );
  }

  // Difficulty filters
  if (filters.difficulty && filters.difficulty.length > 0) {
    filtered = filtered.filter(capsule =>
      filters.difficulty!.some(difficulty =>
        capsule.tags.some(tag =>
          tag.category === 'difficulty' &&
          tag.name.toLowerCase().includes(difficulty.toLowerCase())
        )
      )
    );
  }

  // Format filters
  if (filters.formats && filters.formats.length > 0) {
    filtered = filtered.filter(capsule =>
      filters.formats!.some(format =>
        capsule.tags.some(tag =>
          tag.category === 'format' &&
          tag.name.toLowerCase().includes(format.toLowerCase())
        )
      )
    );
  }

  // Date range filters
  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    filtered = filtered.filter(capsule => {
      const capsuleDate = new Date(capsule.createdAt);
      const startDate = new Date(start);
      const endDate = new Date(end);
      return capsuleDate >= startDate && capsuleDate <= endDate;
    });
  }

  // Duration filters
  if (filters.duration) {
    const { min, max } = filters.duration;
    filtered = filtered.filter(capsule =>
      capsule.duration >= min && capsule.duration <= max
    );
  }

  // Progress filters
  if (filters.progress) {
    if (filters.progress.completed) {
      filtered = filtered.filter(capsule =>
        capsule.progress && capsule.progress.completionPercentage >= 100
      );
    }
    if (filters.progress.inProgress) {
      filtered = filtered.filter(capsule =>
        capsule.progress &&
        capsule.progress.completionPercentage > 0 &&
        capsule.progress.completionPercentage < 100
      );
    }
    if (filters.progress.notStarted) {
      filtered = filtered.filter(capsule =>
        !capsule.progress || capsule.progress.completionPercentage === 0
      );
    }
  }

  // Content type filters
  if (filters.hasContent) {
    const content = filters.hasContent;
    filtered = filtered.filter(capsule => {
      const learningContent = capsule.learningContent;
      return (
        (!content.transcript || learningContent.hasTranscript) &&
        (!content.summary || learningContent.hasSummary) &&
        (!content.flashcards || learningContent.hasFlashcards) &&
        (!content.quiz || learningContent.hasQuiz) &&
        (!content.mindMap || learningContent.hasMindMap) &&
        (!content.notes || learningContent.hasNotes)
      );
    });
  }

  // Text search filters
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filtered = filtered.filter(capsule =>
      capsule.videoTitle.toLowerCase().includes(searchTerm) ||
      capsule.videoDescription.toLowerCase().includes(searchTerm) ||
      capsule.channelTitle.toLowerCase().includes(searchTerm) ||
      capsule.tags.some(tag =>
        tag.name.toLowerCase().includes(searchTerm) ||
        tag.description?.toLowerCase().includes(searchTerm)
      )
    );
  }

  return filtered;
}

/**
 * Apply sorting to capsules
 */
function applySorting(capsules: CapsuleSummary[], sort: LibrarySortOption): CapsuleSummary[] {
  const { field, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...capsules].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'title':
        comparison = a.videoTitle.localeCompare(b.videoTitle);
        break;
      case 'duration':
        comparison = a.duration - b.duration;
        break;
      case 'progress':
        const aProgress = a.progress?.completionPercentage || 0;
        const bProgress = b.progress?.completionPercentage || 0;
        comparison = aProgress - bProgress;
        break;
      case 'relevance':
        // Relevance sorting would need search context
        comparison = 0;
        break;
      default:
        comparison = 0;
    }

    return comparison * multiplier;
  });
}

/**
 * Generate aggregations for the library
 */
function generateAggregations(
  allCapsules: CapsuleSummary[],
  filteredCapsules: CapsuleSummary[]
): LibraryResponse['aggregations'] {
  // Count tags
  const tagCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};

  filteredCapsules.forEach(capsule => {
    capsule.tags.forEach(tag => {
      tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;

      switch (tag.category) {
        case 'subject':
          subjectCounts[tag.name] = (subjectCounts[tag.name] || 0) + 1;
          break;
        case 'difficulty':
          difficultyCounts[tag.name] = (difficultyCounts[tag.name] || 0) + 1;
          break;
        case 'format':
          formatCounts[tag.name] = (formatCounts[tag.name] || 0) + 1;
          break;
      }
    });
  });

  // Count progress distribution
  const progressDistribution = {
    completed: 0,
    inProgress: 0,
    notStarted: 0,
  };

  filteredCapsules.forEach(capsule => {
    if (!capsule.progress || capsule.progress.completionPercentage === 0) {
      progressDistribution.notStarted++;
    } else if (capsule.progress.completionPercentage >= 100) {
      progressDistribution.completed++;
    } else {
      progressDistribution.inProgress++;
    }
  });

  return {
    tagCounts,
    subjectCounts,
    difficultyCounts,
    formatCounts,
    progressDistribution,
  };
}

/**
 * Perform bulk operations on capsules
 */
export async function performBulkOperation(
  userId: string,
  capsuleIds: string[],
  operation: 'delete' | 'archive' | 'addTags' | 'removeTags' | 'export',
  operationData?: any
): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
  try {
    logger.info('Performing bulk operation', {
      userId,
      operation,
      capsuleCount: capsuleIds.length,
    });

    let processedCount = 0;
    const errors: string[] = [];

    for (const capsuleId of capsuleIds) {
      try {
        switch (operation) {
          case 'delete':
            await deleteCapsule(userId, capsuleId);
            break;
          case 'archive':
            await archiveCapsule(userId, capsuleId);
            break;
          case 'addTags':
            await addTagsToCapsule(userId, capsuleId, operationData.tags);
            break;
          case 'removeTags':
            await removeTagsFromCapsule(userId, capsuleId, operationData.tagIds);
            break;
          case 'export':
            // Export operation would be handled differently
            break;
        }
        processedCount++;
      } catch (error) {
        errors.push(`Failed to ${operation} capsule ${capsuleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info('Bulk operation completed', {
      userId,
      operation,
      processedCount,
      errorCount: errors.length,
    });

    return {
      success: errors.length === 0,
      processedCount,
      errors,
    };
  } catch (error) {
    logger.error('Failed to perform bulk operation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      operation,
    });
    throw error;
  }
}

// Helper functions for bulk operations
async function deleteCapsule(userId: string, capsuleId: string): Promise<void> {
  // Implementation would delete the capsule from DynamoDB
  // This is a placeholder
}

async function archiveCapsule(userId: string, capsuleId: string): Promise<void> {
  // Implementation would mark the capsule as archived
  // This is a placeholder
}

async function addTagsToCapsule(userId: string, capsuleId: string, tags: Tag[]): Promise<void> {
  // Implementation would add tags to the capsule
  // This is a placeholder
}

async function removeTagsFromCapsule(userId: string, capsuleId: string, tagIds: string[]): Promise<void> {
  // Implementation would remove tags from the capsule
  // This is a placeholder
}
