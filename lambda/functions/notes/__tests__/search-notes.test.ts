import { handler } from '../search-notes';
import { searchUserNotes } from '../../../services/notes-search';

// Mock dependencies
jest.mock('../../../services/notes-search');
jest.mock('../../../shared/logger');

const mockSearchUserNotes = searchUserNotes as jest.MockedFunction<typeof searchUserNotes>;

describe('Search Notes Lambda Function', () => {
  const mockSearchResponse = {
    results: [
      {
        capsuleId: 'capsule-123',
        videoTitle: 'Introduction to Machine Learning',
        videoId: 'video-123',
        sections: [
          {
            section: {
              id: 'section-1',
              title: 'What is Machine Learning',
              content: 'Machine learning is a subset of artificial intelligence...',
              level: 1,
              type: 'introduction',
              keyPoints: ['AI subset', 'Data-driven'],
              tags: ['machine learning', 'ai'],
              concepts: ['machine learning'],
              difficulty: 'beginner',
              importance: 9,
            },
            relevanceScore: 8.5,
            matchedTerms: ['title', 'content'],
            snippet: 'Machine learning is a subset of artificial intelligence...',
          },
        ],
        totalRelevanceScore: 8.5,
        metadata: {
          category: 'Technology',
          tags: ['machine learning', 'ai'],
          difficulty: 'beginner',
          createdAt: '2024-01-01T00:00:00Z',
          subjects: ['Computer Science'],
          estimatedReadingTime: 5,
        },
      },
    ],
    totalResults: 1,
    searchTime: 150,
    suggestions: ['artificial intelligence', 'deep learning'],
    facets: {
      categories: { 'Technology': 1 },
      tags: { 'machine learning': 1, 'ai': 1 },
      difficulties: { 'beginner': 1 },
      subjects: { 'Computer Science': 1 },
    },
    aggregations: {
      totalCapsules: 1,
      totalSections: 1,
      averageRelevanceScore: 8.5,
      topCategories: [{ category: 'Technology', count: 1 }],
      topTags: [{ tag: 'machine learning', count: 1 }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchUserNotes.mockResolvedValue(mockSearchResponse);
  });

  describe('successful searches', () => {
    it('should search notes successfully with basic query', async () => {
      const event = {
        userId: 'user-123',
        query: 'machine learning',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.data).toEqual(mockSearchResponse);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'machine learning',
        filters: {},
        options: {},
      });
    });

    it('should search notes with filters and options', async () => {
      const event = {
        userId: 'user-123',
        query: 'artificial intelligence',
        filters: {
          categories: ['Technology'],
          difficulty: ['beginner', 'intermediate'],
          tags: ['ai'],
        },
        options: {
          maxResults: 20,
          searchType: 'semantic',
          sortBy: 'relevance',
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'artificial intelligence',
        filters: {
          categories: ['Technology'],
          difficulty: ['beginner', 'intermediate'],
          tags: ['ai'],
        },
        options: {
          maxResults: 20,
          searchType: 'semantic',
          sortBy: 'relevance',
        },
      });
    });

    it('should search notes with date range filter', async () => {
      const event = {
        userId: 'user-123',
        query: 'neural networks',
        filters: {
          dateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-12-31T23:59:59Z',
          },
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'neural networks',
        filters: {
          dateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-12-31T23:59:59Z',
          },
        },
        options: {},
      });
    });

    it('should search notes with capsule ID filter', async () => {
      const event = {
        userId: 'user-123',
        query: 'deep learning',
        filters: {
          capsuleIds: ['capsule-123', 'capsule-456'],
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'deep learning',
        filters: {
          capsuleIds: ['capsule-123', 'capsule-456'],
        },
        options: {},
      });
    });

    it('should trim whitespace from query', async () => {
      const event = {
        userId: 'user-123',
        query: '  machine learning  ',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'machine learning',
        filters: {},
        options: {},
      });
    });

    it('should handle empty search results', async () => {
      const emptyResponse = {
        results: [],
        totalResults: 0,
        searchTime: 50,
        suggestions: [],
        facets: {
          categories: {},
          tags: {},
          difficulties: {},
          subjects: {},
        },
        aggregations: {
          totalCapsules: 0,
          totalSections: 0,
          averageRelevanceScore: 0,
          topCategories: [],
          topTags: [],
        },
      };

      mockSearchUserNotes.mockResolvedValue(emptyResponse);

      const event = {
        userId: 'user-123',
        query: 'nonexistent topic',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.data).toEqual(emptyResponse);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when userId is missing', async () => {
      const event = {
        query: 'machine learning',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('User ID is required');
      expect(mockSearchUserNotes).not.toHaveBeenCalled();
    });

    it('should return 400 when query is missing', async () => {
      const event = {
        userId: 'user-123',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Search query is required');
      expect(mockSearchUserNotes).not.toHaveBeenCalled();
    });

    it('should return 400 when query is empty string', async () => {
      const event = {
        userId: 'user-123',
        query: '',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Search query is required');
      expect(mockSearchUserNotes).not.toHaveBeenCalled();
    });

    it('should return 400 when query is only whitespace', async () => {
      const event = {
        userId: 'user-123',
        query: '   ',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Search query is required');
      expect(mockSearchUserNotes).not.toHaveBeenCalled();
    });

    it('should return 400 when query is too long', async () => {
      const longQuery = 'a'.repeat(501);
      const event = {
        userId: 'user-123',
        query: longQuery,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Search query is too long (maximum 500 characters)');
      expect(mockSearchUserNotes).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle search service errors', async () => {
      mockSearchUserNotes.mockRejectedValue(new Error('Database connection failed'));

      const event = {
        userId: 'user-123',
        query: 'machine learning',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Internal server error during search');
    });

    it('should handle unknown errors', async () => {
      mockSearchUserNotes.mockRejectedValue('Unknown error');

      const event = {
        userId: 'user-123',
        query: 'machine learning',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(result.body.success).toBe(false);
      expect(result.body.error).toBe('Internal server error during search');
    });
  });

  describe('search options', () => {
    it('should handle all search options', async () => {
      const event = {
        userId: 'user-123',
        query: 'machine learning',
        options: {
          maxResults: 10,
          searchType: 'phrases',
          includeContent: false,
          sortBy: 'date',
          groupBy: 'category',
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'machine learning',
        filters: {},
        options: {
          maxResults: 10,
          searchType: 'phrases',
          includeContent: false,
          sortBy: 'date',
          groupBy: 'category',
        },
      });
    });

    it('should handle all filter options', async () => {
      const event = {
        userId: 'user-123',
        query: 'artificial intelligence',
        filters: {
          capsuleIds: ['capsule-1', 'capsule-2'],
          categories: ['Technology', 'Science'],
          tags: ['ai', 'ml'],
          difficulty: ['intermediate', 'advanced'],
          subjects: ['Computer Science', 'Mathematics'],
          hasTimestamps: true,
          dateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-12-31T23:59:59Z',
          },
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSearchUserNotes).toHaveBeenCalledWith({
        userId: 'user-123',
        query: 'artificial intelligence',
        filters: {
          capsuleIds: ['capsule-1', 'capsule-2'],
          categories: ['Technology', 'Science'],
          tags: ['ai', 'ml'],
          difficulty: ['intermediate', 'advanced'],
          subjects: ['Computer Science', 'Mathematics'],
          hasTimestamps: true,
          dateRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-12-31T23:59:59Z',
          },
        },
        options: {},
      });
    });
  });

  describe('response format', () => {
    it('should return properly formatted success response', async () => {
      const event = {
        userId: 'user-123',
        query: 'machine learning',
      };

      const result = await handler(event);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');
      expect(result.body).toHaveProperty('success', true);
      expect(result.body).toHaveProperty('data');
      expect(result.body.data).toHaveProperty('results');
      expect(result.body.data).toHaveProperty('totalResults');
      expect(result.body.data).toHaveProperty('searchTime');
      expect(result.body.data).toHaveProperty('suggestions');
      expect(result.body.data).toHaveProperty('facets');
      expect(result.body.data).toHaveProperty('aggregations');
    });

    it('should return properly formatted error response', async () => {
      const event = {
        userId: 'user-123',
      };

      const result = await handler(event);

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('body');
      expect(result.body).toHaveProperty('success', false);
      expect(result.body).toHaveProperty('error');
      expect(typeof result.body.error).toBe('string');
    });
  });
});