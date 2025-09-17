// Note: @elastic/elasticsearch would be installed as a dependency
// For now, we'll create a mock client interface
interface ElasticsearchClient {
  indices: {
    exists: (params: { index: string }) => Promise<boolean>;
    create: (params: any) => Promise<any>;
  };
  search: (params: any) => Promise<any>;
  bulk: (params: any) => Promise<any>;
  deleteByQuery: (params: any) => Promise<any>;
  cluster: {
    health: () => Promise<any>;
  };
}

import { Logger } from '../shared/logger';
import { OrganizedNotes } from './notes-organization';

const logger = new Logger('elasticsearch-notes');

// Mock Elasticsearch client for development
const createMockClient = (): ElasticsearchClient => ({
  indices: {
    exists: async () => false,
    create: async () => ({ acknowledged: true }),
  },
  search: async () => ({
    hits: { hits: [], total: { value: 0 } },
    took: 1,
    aggregations: {},
  }),
  bulk: async () => ({ errors: false, items: [] }),
  deleteByQuery: async () => ({ deleted: 0 }),
  cluster: {
    health: async () => ({ status: 'green' }),
  },
});

// Initialize Elasticsearch client (mock for now)
const esClient = createMockClient();

// Initialize Elasticsearch client
const esClient = new Client({
  node: process.env.ELASTICSEARCH_ENDPOINT || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_AUTH ? {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  } : undefined,
});

export interface NotesDocument {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoTitle: string;
  sectionId: string;
  title: string;
  content: string;
  type: string;
  level: number;
  importance: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  concepts: string[];
  keyPoints: string[];
  timestamp?: {
    start: number;
    end: number;
  };
  category: string;
  subjects: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  query: string;
  filters?: {
    userId?: string;
    capsuleIds?: string[];
    categories?: string[];
    subjects?: string[];
    tags?: string[];
    difficulty?: string[];
    sectionTypes?: string[];
    hasTimestamp?: boolean;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  options?: {
    from?: number;
    size?: number;
    sortBy?: 'relevance' | 'date' | 'importance' | 'title';
    sortOrder?: 'asc' | 'desc';
    highlight?: boolean;
    fuzzy?: boolean;
  };
}

export interface SearchResult {
  document: NotesDocument;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took: number;
  aggregations?: Record<string, any>;
}

/**
 * Initialize Elasticsearch index for notes
 */
export async function initializeNotesIndex(): Promise<void> {
  const indexName = getNotesIndexName();

  try {
    // Check if index exists
    const exists = await esClient.indices.exists({ index: indexName });

    if (!exists) {
      // Create index with mapping
      await esClient.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                notes_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'stop',
                    'stemmer',
                    'synonym_filter',
                  ],
                },
              },
              filter: {
                synonym_filter: {
                  type: 'synonym',
                  synonyms: [
                    'ai,artificial intelligence',
                    'ml,machine learning',
                    'nn,neural network,neural networks',
                    'dl,deep learning',
                  ],
                },
              },
            },
          },
          mappings: {
            properties: {
              userId: { type: 'keyword' },
              capsuleId: { type: 'keyword' },
              videoId: { type: 'keyword' },
              videoTitle: {
                type: 'text',
                analyzer: 'notes_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              sectionId: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'notes_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              content: {
                type: 'text',
                analyzer: 'notes_analyzer',
              },
              type: { type: 'keyword' },
              level: { type: 'integer' },
              importance: { type: 'integer' },
              difficulty: { type: 'keyword' },
              tags: { type: 'keyword' },
              concepts: { type: 'keyword' },
              keyPoints: {
                type: 'text',
                analyzer: 'notes_analyzer',
              },
              timestamp: {
                properties: {
                  start: { type: 'float' },
                  end: { type: 'float' },
                },
              },
              category: { type: 'keyword' },
              subjects: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      });

      logger.info('Notes index created successfully', { indexName });
    } else {
      logger.info('Notes index already exists', { indexName });
    }
  } catch (error) {
    logger.error('Failed to initialize notes index', {
      error: error instanceof Error ? error.message : 'Unknown error',
      indexName,
    });
    throw error;
  }
}

/**
 * Index organized notes in Elasticsearch
 */
export async function indexOrganizedNotes(
  userId: string,
  capsuleId: string,
  videoId: string,
  organizedNotes: OrganizedNotes
): Promise<void> {
  const indexName = getNotesIndexName();

  try {
    // Delete existing documents for this capsule
    await deleteNotesForCapsule(userId, capsuleId);

    // Prepare documents for indexing
    const documents: NotesDocument[] = organizedNotes.sections.map(section => ({
      userId,
      capsuleId,
      videoId,
      videoTitle: organizedNotes.metadata.mainTopics[0] || 'Unknown Video',
      sectionId: section.id,
      title: section.title,
      content: section.content,
      type: section.type,
      level: section.level,
      importance: section.importance,
      difficulty: section.difficulty,
      tags: section.tags,
      concepts: section.concepts,
      keyPoints: section.keyPoints,
      timestamp: section.timestamp,
      category: organizedNotes.categorization.primaryCategory,
      subjects: organizedNotes.categorization.subjects,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Bulk index documents
    if (documents.length > 0) {
      const body = documents.flatMap(doc => [
        { index: { _index: indexName, _id: `${userId}-${capsuleId}-${doc.sectionId}` } },
        doc,
      ]);

      const response = await esClient.bulk({ body });

      if (response.errors) {
        const errorItems = response.items.filter((item: any) => item.index?.error);
        logger.error('Some documents failed to index', {
          errors: errorItems.map((item: any) => item.index.error),
        });
      } else {
        logger.info('Notes indexed successfully', {
          userId,
          capsuleId,
          documentsIndexed: documents.length,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to index organized notes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });
    throw error;
  }
}

/**
 * Search notes in Elasticsearch
 */
export async function searchNotes(query: SearchQuery): Promise<SearchResponse> {
  const indexName = getNotesIndexName();

  try {
    const {
      from = 0,
      size = 20,
      sortBy = 'relevance',
      sortOrder = 'desc',
      highlight = true,
      fuzzy = true,
    } = query.options || {};

    // Build Elasticsearch query
    const esQuery: any = {
      index: indexName,
      body: {
        from,
        size,
        query: buildSearchQuery(query.query, query.filters, fuzzy),
        sort: buildSortQuery(sortBy, sortOrder),
        aggs: buildAggregations(),
      },
    };

    // Add highlighting if requested
    if (highlight) {
      esQuery.body.highlight = {
        fields: {
          title: { fragment_size: 150, number_of_fragments: 1 },
          content: { fragment_size: 150, number_of_fragments: 3 },
          keyPoints: { fragment_size: 100, number_of_fragments: 2 },
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      };
    }

    const response = await esClient.search(esQuery);

    // Process results
    const results: SearchResult[] = response.hits.hits.map((hit: any) => ({
      document: hit._source as NotesDocument,
      score: hit._score,
      highlights: hit.highlight,
    }));

    logger.info('Notes search completed', {
      query: query.query,
      totalResults: response.hits.total.value,
      returnedResults: results.length,
      took: response.took,
    });

    return {
      results,
      total: response.hits.total.value,
      took: response.took,
      aggregations: response.aggregations,
    };
  } catch (error) {
    logger.error('Notes search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: query.query,
    });
    throw error;
  }
}

/**
 * Delete notes for a specific capsule
 */
export async function deleteNotesForCapsule(userId: string, capsuleId: string): Promise<void> {
  const indexName = getNotesIndexName();

  try {
    await esClient.deleteByQuery({
      index: indexName,
      body: {
        query: {
          bool: {
            must: [
              { term: { userId } },
              { term: { capsuleId } },
            ],
          },
        },
      },
    });

    logger.info('Notes deleted for capsule', { userId, capsuleId });
  } catch (error) {
    logger.error('Failed to delete notes for capsule', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
    });
    throw error;
  }
}

/**
 * Get notes statistics for a user
 */
export async function getNotesStatistics(userId: string): Promise<{
  totalNotes: number;
  notesByCategory: Record<string, number>;
  notesByDifficulty: Record<string, number>;
  notesBySubject: Record<string, number>;
}> {
  const indexName = getNotesIndexName();

  try {
    const response = await esClient.search({
      index: indexName,
      body: {
        size: 0,
        query: {
          term: { userId },
        },
        aggs: {
          by_category: {
            terms: { field: 'category', size: 20 },
          },
          by_difficulty: {
            terms: { field: 'difficulty', size: 10 },
          },
          by_subject: {
            terms: { field: 'subjects', size: 20 },
          },
        },
      },
    });

    const totalNotes = response.hits.total.value;
    const notesByCategory = Object.fromEntries(
      response.aggregations.by_category.buckets.map((bucket: any) => [bucket.key, bucket.doc_count])
    );
    const notesByDifficulty = Object.fromEntries(
      response.aggregations.by_difficulty.buckets.map((bucket: any) => [bucket.key, bucket.doc_count])
    );
    const notesBySubject = Object.fromEntries(
      response.aggregations.by_subject.buckets.map((bucket: any) => [bucket.key, bucket.doc_count])
    );

    return {
      totalNotes,
      notesByCategory,
      notesByDifficulty,
      notesBySubject,
    };
  } catch (error) {
    logger.error('Failed to get notes statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Build Elasticsearch search query
 */
function buildSearchQuery(queryString: string, filters: SearchQuery['filters'], fuzzy: boolean): any {
  const must: any[] = [];
  const filter: any[] = [];

  // Main search query
  if (queryString && queryString.trim()) {
    const searchQuery: any = {
      multi_match: {
        query: queryString,
        fields: [
          'title^3',
          'content^2',
          'keyPoints^2',
          'concepts^1.5',
          'tags^1.5',
        ],
        type: 'best_fields',
        operator: 'or',
      },
    };

    if (fuzzy) {
      searchQuery.multi_match.fuzziness = 'AUTO';
    }

    must.push(searchQuery);
  } else {
    must.push({ match_all: {} });
  }

  // Apply filters
  if (filters) {
    if (filters.userId) {
      filter.push({ term: { userId: filters.userId } });
    }

    if (filters.capsuleIds && filters.capsuleIds.length > 0) {
      filter.push({ terms: { capsuleId: filters.capsuleIds } });
    }

    if (filters.categories && filters.categories.length > 0) {
      filter.push({ terms: { category: filters.categories } });
    }

    if (filters.subjects && filters.subjects.length > 0) {
      filter.push({ terms: { subjects: filters.subjects } });
    }

    if (filters.tags && filters.tags.length > 0) {
      filter.push({ terms: { tags: filters.tags } });
    }

    if (filters.difficulty && filters.difficulty.length > 0) {
      filter.push({ terms: { difficulty: filters.difficulty } });
    }

    if (filters.sectionTypes && filters.sectionTypes.length > 0) {
      filter.push({ terms: { type: filters.sectionTypes } });
    }

    if (filters.hasTimestamp !== undefined) {
      if (filters.hasTimestamp) {
        filter.push({ exists: { field: 'timestamp' } });
      } else {
        must.push({ bool: { must_not: { exists: { field: 'timestamp' } } } });
      }
    }

    if (filters.dateRange) {
      filter.push({
        range: {
          createdAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        },
      });
    }
  }

  return {
    bool: {
      must,
      filter,
    },
  };
}

/**
 * Build Elasticsearch sort query
 */
function buildSortQuery(sortBy: string, sortOrder: string): any[] {
  switch (sortBy) {
    case 'date':
      return [{ createdAt: { order: sortOrder } }];
    case 'importance':
      return [{ importance: { order: sortOrder } }];
    case 'title':
      return [{ 'title.keyword': { order: sortOrder } }];
    case 'relevance':
    default:
      return [{ _score: { order: sortOrder } }];
  }
}

/**
 * Build Elasticsearch aggregations
 */
function buildAggregations(): any {
  return {
    categories: {
      terms: { field: 'category', size: 20 },
    },
    subjects: {
      terms: { field: 'subjects', size: 20 },
    },
    difficulties: {
      terms: { field: 'difficulty', size: 10 },
    },
    section_types: {
      terms: { field: 'type', size: 10 },
    },
    tags: {
      terms: { field: 'tags', size: 50 },
    },
  };
}

/**
 * Get notes index name
 */
function getNotesIndexName(): string {
  const environment = process.env.NODE_ENV || 'development';
  return `notes-${environment}`;
}

/**
 * Health check for Elasticsearch
 */
export async function healthCheck(): Promise<{ status: string; cluster: any }> {
  try {
    const health = await esClient.cluster.health();
    return {
      status: 'healthy',
      cluster: health,
    };
  } catch (error) {
    logger.error('Elasticsearch health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      status: 'unhealthy',
      cluster: null,
    };
  }
}

/**
 * Create search suggestions based on user's notes
 */
export async function getSearchSuggestions(
  userId: string,
  query: string,
  limit: number = 5
): Promise<string[]> {
  const indexName = getNotesIndexName();

  try {
    const response = await esClient.search({
      index: indexName,
      body: {
        size: 0,
        query: {
          bool: {
            must: [
              { term: { userId } },
              {
                multi_match: {
                  query,
                  fields: ['title', 'concepts', 'tags'],
                  type: 'phrase_prefix',
                },
              },
            ],
          },
        },
        aggs: {
          suggestions: {
            terms: {
              field: 'concepts',
              size: limit * 2,
              include: `.*${query.toLowerCase()}.*`,
            },
          },
          tag_suggestions: {
            terms: {
              field: 'tags',
              size: limit,
              include: `.*${query.toLowerCase()}.*`,
            },
          },
        },
      },
    });

    const conceptSuggestions = response.aggregations.suggestions.buckets.map((bucket: any) => bucket.key);
    const tagSuggestions = response.aggregations.tag_suggestions.buckets.map((bucket: any) => bucket.key);

    const allSuggestions = [...conceptSuggestions, ...tagSuggestions];
    const uniqueSuggestions = [...new Set(allSuggestions)];

    return uniqueSuggestions.slice(0, limit);
  } catch (error) {
    logger.error('Failed to get search suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      query,
    });
    return [];
  }
}