import { Client } from '@elastic/elasticsearch';
import {
  initializeNotesIndex,
  indexOrganizedNotes,
  searchNotes,
  deleteNotesForCapsule,
  getNotesStatistics,
  getSearchSuggestions,
  healthCheck,
} from '../elasticsearch-notes';
import { OrganizedNotes } from '../notes-organization';

// Mock Elasticsearch client
jest.mock('@elastic/elasticsearch');
const MockedClient = Client as jest.MockedClass<typeof Client>;

describe('Elasticsearch Notes Service', () => {
  let mockEsClient: jest.Mocked<Client>;

  const mockOrganizedNotes: OrganizedNotes = {
    sections: [
      {
        id: 'section-1',
        title: 'Introduction to Machine Learning',
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
        level: 1,
        type: 'introduction',
        keyPoints: ['ML is AI subset', 'Computers learn from data'],
        tags: ['machine learning', 'ai'],
        concepts: ['machine learning', 'artificial intelligence'],
        difficulty: 'beginner',
        importance: 9,
      },
      {
        id: 'section-2',
        title: 'Neural Networks',
        content: 'Neural networks are computing systems inspired by biological neural networks.',
        level: 2,
        type: 'main-content',
        keyPoints: ['Inspired by biology', 'Computing systems'],
        tags: ['neural networks', 'biology'],
        concepts: ['neural networks'],
        difficulty: 'intermediate',
        importance: 8,
      },
    ],
    structure: {
      totalSections: 2,
      maxDepth: 2,
      hasIntroduction: true,
      hasConclusion: false,
      hasSummary: false,
    },
    metadata: {
      mainTopics: ['Machine Learning', 'Neural Networks'],
      keyTerms: ['machine learning', 'neural networks'],
      concepts: ['machine learning', 'neural networks'],
      difficulty: 'beginner',
      estimatedReadingTime: 5,
      wordCount: 150,
    },
    categorization: {
      primaryCategory: 'Technology',
      secondaryCategories: ['Computer Science'],
      tags: ['machine learning', 'ai', 'neural networks'],
      subjects: ['Computer Science', 'Artificial Intelligence'],
    },
    searchIndex: {
      keywords: ['machine', 'learning', 'neural', 'networks'],
      phrases: ['machine learning', 'neural networks'],
      entities: {
        TECHNOLOGY: ['machine learning', 'neural networks'],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock ES client
    mockEsClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      bulk: jest.fn(),
      search: jest.fn(),
      deleteByQuery: jest.fn(),
      cluster: {
        health: jest.fn(),
      },
    } as any;

    MockedClient.mockImplementation(() => mockEsClient);
  });

  describe('initializeNotesIndex', () => {
    it('should create index if it does not exist', async () => {
      mockEsClient.indices.exists.mockResolvedValue(false);
      mockEsClient.indices.create.mockResolvedValue({} as any);

      await initializeNotesIndex();

      expect(mockEsClient.indices.exists).toHaveBeenCalledWith({
        index: 'notes-test',
      });
      expect(mockEsClient.indices.create).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          settings: expect.any(Object),
          mappings: expect.any(Object),
        }),
      });
    });

    it('should not create index if it already exists', async () => {
      mockEsClient.indices.exists.mockResolvedValue(true);

      await initializeNotesIndex();

      expect(mockEsClient.indices.exists).toHaveBeenCalled();
      expect(mockEsClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle index creation errors', async () => {
      mockEsClient.indices.exists.mockRejectedValue(new Error('ES connection failed'));

      await expect(initializeNotesIndex()).rejects.toThrow('ES connection failed');
    });
  });

  describe('indexOrganizedNotes', () => {
    it('should index organized notes successfully', async () => {
      mockEsClient.deleteByQuery.mockResolvedValue({} as any);
      mockEsClient.bulk.mockResolvedValue({
        errors: false,
        items: [],
      } as any);

      await indexOrganizedNotes('user-123', 'capsule-123', 'video-123', mockOrganizedNotes);

      expect(mockEsClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'notes-test',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId: 'user-123' } },
                { term: { capsuleId: 'capsule-123' } },
              ],
            },
          },
        },
      });

      expect(mockEsClient.bulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: 'notes-test', _id: 'user-123-capsule-123-section-1' } },
          expect.objectContaining({
            userId: 'user-123',
            capsuleId: 'capsule-123',
            videoId: 'video-123',
            sectionId: 'section-1',
            title: 'Introduction to Machine Learning',
          }),
        ]),
      });
    });

    it('should handle bulk indexing errors', async () => {
      mockEsClient.deleteByQuery.mockResolvedValue({} as any);
      mockEsClient.bulk.mockResolvedValue({
        errors: true,
        items: [
          {
            index: {
              error: {
                type: 'version_conflict_engine_exception',
                reason: 'Document already exists',
              },
            },
          },
        ],
      } as any);

      // Should not throw, but should log errors
      await expect(
        indexOrganizedNotes('user-123', 'capsule-123', 'video-123', mockOrganizedNotes)
      ).resolves.not.toThrow();
    });

    it('should handle empty sections', async () => {
      const emptyNotes: OrganizedNotes = {
        ...mockOrganizedNotes,
        sections: [],
      };

      mockEsClient.deleteByQuery.mockResolvedValue({} as any);

      await indexOrganizedNotes('user-123', 'capsule-123', 'video-123', emptyNotes);

      expect(mockEsClient.deleteByQuery).toHaveBeenCalled();
      expect(mockEsClient.bulk).not.toHaveBeenCalled();
    });
  });

  describe('searchNotes', () => {
    const mockSearchResponse = {
      hits: {
        hits: [
          {
            _source: {
              userId: 'user-123',
              capsuleId: 'capsule-123',
              sectionId: 'section-1',
              title: 'Introduction to Machine Learning',
              content: 'Machine learning is a subset of artificial intelligence.',
            },
            _score: 1.5,
            highlight: {
              title: ['Introduction to <mark>Machine Learning</mark>'],
              content: ['<mark>Machine learning</mark> is a subset of artificial intelligence.'],
            },
          },
        ],
        total: { value: 1 },
      },
      took: 15,
      aggregations: {
        categories: {
          buckets: [{ key: 'Technology', doc_count: 1 }],
        },
      },
    };

    it('should search notes with basic query', async () => {
      mockEsClient.search.mockResolvedValue(mockSearchResponse as any);

      const result = await searchNotes({
        query: 'machine learning',
        filters: { userId: 'user-123' },
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.took).toBe(15);
      expect(result.results[0].document.title).toBe('Introduction to Machine Learning');
      expect(result.results[0].score).toBe(1.5);
      expect(result.results[0].highlights).toBeDefined();

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  multi_match: expect.objectContaining({
                    query: 'machine learning',
                  }),
                }),
              ]),
              filter: expect.arrayContaining([
                { term: { userId: 'user-123' } },
              ]),
            }),
          }),
        }),
      });
    });

    it('should search with filters', async () => {
      mockEsClient.search.mockResolvedValue(mockSearchResponse as any);

      await searchNotes({
        query: 'neural networks',
        filters: {
          userId: 'user-123',
          categories: ['Technology'],
          difficulty: ['intermediate'],
          hasTimestamp: true,
        },
      });

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { term: { userId: 'user-123' } },
                { terms: { category: ['Technology'] } },
                { terms: { difficulty: ['intermediate'] } },
                { exists: { field: 'timestamp' } },
              ]),
            }),
          }),
        }),
      });
    });

    it('should search with options', async () => {
      mockEsClient.search.mockResolvedValue(mockSearchResponse as any);

      await searchNotes({
        query: 'artificial intelligence',
        options: {
          from: 10,
          size: 5,
          sortBy: 'date',
          sortOrder: 'asc',
          highlight: false,
          fuzzy: false,
        },
      });

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          from: 10,
          size: 5,
          sort: [{ createdAt: { order: 'asc' } }],
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  multi_match: expect.not.objectContaining({
                    fuzziness: expect.anything(),
                  }),
                }),
              ]),
            }),
          }),
        }),
      });
    });

    it('should handle search errors', async () => {
      mockEsClient.search.mockRejectedValue(new Error('Search failed'));

      await expect(
        searchNotes({
          query: 'machine learning',
          filters: { userId: 'user-123' },
        })
      ).rejects.toThrow('Search failed');
    });
  });

  describe('deleteNotesForCapsule', () => {
    it('should delete notes for capsule', async () => {
      mockEsClient.deleteByQuery.mockResolvedValue({} as any);

      await deleteNotesForCapsule('user-123', 'capsule-123');

      expect(mockEsClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'notes-test',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId: 'user-123' } },
                { term: { capsuleId: 'capsule-123' } },
              ],
            },
          },
        },
      });
    });

    it('should handle deletion errors', async () => {
      mockEsClient.deleteByQuery.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteNotesForCapsule('user-123', 'capsule-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('getNotesStatistics', () => {
    it('should return notes statistics', async () => {
      const mockStatsResponse = {
        hits: { total: { value: 10 } },
        aggregations: {
          by_category: {
            buckets: [
              { key: 'Technology', doc_count: 5 },
              { key: 'Science', doc_count: 3 },
            ],
          },
          by_difficulty: {
            buckets: [
              { key: 'beginner', doc_count: 4 },
              { key: 'intermediate', doc_count: 6 },
            ],
          },
          by_subject: {
            buckets: [
              { key: 'Computer Science', doc_count: 7 },
              { key: 'Mathematics', doc_count: 3 },
            ],
          },
        },
      };

      mockEsClient.search.mockResolvedValue(mockStatsResponse as any);

      const stats = await getNotesStatistics('user-123');

      expect(stats.totalNotes).toBe(10);
      expect(stats.notesByCategory).toEqual({
        Technology: 5,
        Science: 3,
      });
      expect(stats.notesByDifficulty).toEqual({
        beginner: 4,
        intermediate: 6,
      });
      expect(stats.notesBySubject).toEqual({
        'Computer Science': 7,
        Mathematics: 3,
      });
    });

    it('should handle statistics errors', async () => {
      mockEsClient.search.mockRejectedValue(new Error('Stats failed'));

      await expect(getNotesStatistics('user-123')).rejects.toThrow('Stats failed');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestionsResponse = {
        aggregations: {
          suggestions: {
            buckets: [
              { key: 'machine learning' },
              { key: 'machine vision' },
            ],
          },
          tag_suggestions: {
            buckets: [
              { key: 'ml' },
            ],
          },
        },
      };

      mockEsClient.search.mockResolvedValue(mockSuggestionsResponse as any);

      const suggestions = await getSearchSuggestions('user-123', 'machine', 3);

      expect(suggestions).toEqual(['machine learning', 'machine vision', 'ml']);
    });

    it('should handle suggestions errors gracefully', async () => {
      mockEsClient.search.mockRejectedValue(new Error('Suggestions failed'));

      const suggestions = await getSearchSuggestions('user-123', 'machine');

      expect(suggestions).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockHealthResponse = {
        cluster_name: 'test-cluster',
        status: 'green',
        number_of_nodes: 1,
      };

      mockEsClient.cluster.health.mockResolvedValue(mockHealthResponse as any);

      const health = await healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.cluster).toEqual(mockHealthResponse);
    });

    it('should return unhealthy status on error', async () => {
      mockEsClient.cluster.health.mockRejectedValue(new Error('Health check failed'));

      const health = await healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.cluster).toBeNull();
    });
  });

  describe('query building', () => {
    it('should build query with match_all when no query string', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
        took: 1,
      } as any);

      await searchNotes({
        query: '',
        filters: { userId: 'user-123' },
      });

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                { match_all: {} },
              ]),
            }),
          }),
        }),
      });
    });

    it('should build query with date range filter', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
        took: 1,
      } as any);

      await searchNotes({
        query: 'test',
        filters: {
          userId: 'user-123',
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31',
          },
        },
      });

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                {
                  range: {
                    createdAt: {
                      gte: '2024-01-01',
                      lte: '2024-12-31',
                    },
                  },
                },
              ]),
            }),
          }),
        }),
      });
    });

    it('should build query with hasTimestamp false filter', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
        took: 1,
      } as any);

      await searchNotes({
        query: 'test',
        filters: {
          userId: 'user-123',
          hasTimestamp: false,
        },
      });

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'notes-test',
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                {
                  bool: {
                    must_not: {
                      exists: { field: 'timestamp' },
                    },
                  },
                },
              ]),
            }),
          }),
        }),
      });
    });
  });
});