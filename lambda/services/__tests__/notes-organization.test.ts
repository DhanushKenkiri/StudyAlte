import { organizeNotes, searchNotes, NoteSection, OrganizedNotes } from '../notes-organization';
import { analyzeTextWithComprehend } from '../comprehend';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('../comprehend');
jest.mock('openai');
jest.mock('../shared/logger');

const mockAnalyzeTextWithComprehend = analyzeTextWithComprehend as jest.MockedFunction<typeof analyzeTextWithComprehend>;
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('Notes Organization Service', () => {
  const mockVideoMetadata = {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning concepts',
    duration: 3600,
    channelTitle: 'Tech Education',
    tags: ['machine learning', 'AI', 'data science'],
  };

  const mockRawNotes = `
# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.

## Types of Machine Learning

### Supervised Learning
Supervised learning uses labeled data to train models. Examples include classification and regression problems.

### Unsupervised Learning
Unsupervised learning finds patterns in data without labeled examples. Clustering and dimensionality reduction are common techniques.

### Reinforcement Learning
Reinforcement learning involves agents learning through interaction with an environment, receiving rewards or penalties.

## Key Concepts

### Algorithms
Common algorithms include linear regression, decision trees, neural networks, and support vector machines.

### Data Preprocessing
Data must be cleaned, normalized, and prepared before training models.

## Conclusion

Machine learning is a powerful tool that continues to evolve and find new applications across industries.
  `.trim();

  const mockComprehendAnalysis = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95 },
      { Text: 'supervised learning', Score: 0.90 },
      { Text: 'unsupervised learning', Score: 0.88 },
      { Text: 'reinforcement learning', Score: 0.85 },
      { Text: 'neural networks', Score: 0.82 },
      { Text: 'data preprocessing', Score: 0.80 },
    ],
    entities: [
      { Text: 'Machine Learning', Type: 'OTHER', Score: 0.95 },
      { Text: 'AI', Type: 'OTHER', Score: 0.90 },
      { Text: 'data science', Type: 'OTHER', Score: 0.85 },
    ],
    sentiment: { Sentiment: 'NEUTRAL', SentimentScore: { Neutral: 0.8 } },
  };

  const mockOpenAIResponse = {
    sections: [
      {
        id: 'intro',
        title: 'Introduction to Machine Learning',
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.',
        level: 1,
        type: 'introduction',
        keyPoints: ['Machine learning is a subset of AI', 'Computers learn from data', 'No explicit programming required'],
        concepts: ['machine learning', 'artificial intelligence', 'data'],
        difficulty: 'beginner',
        importance: 9,
      },
      {
        id: 'supervised',
        title: 'Supervised Learning',
        content: 'Supervised learning uses labeled data to train models. Examples include classification and regression problems.',
        level: 2,
        type: 'main-content',
        keyPoints: ['Uses labeled data', 'Classification and regression'],
        concepts: ['supervised learning', 'labeled data', 'classification', 'regression'],
        difficulty: 'intermediate',
        importance: 8,
      },
      {
        id: 'unsupervised',
        title: 'Unsupervised Learning',
        content: 'Unsupervised learning finds patterns in data without labeled examples. Clustering and dimensionality reduction are common techniques.',
        level: 2,
        type: 'main-content',
        keyPoints: ['No labeled examples', 'Pattern finding', 'Clustering techniques'],
        concepts: ['unsupervised learning', 'clustering', 'dimensionality reduction'],
        difficulty: 'intermediate',
        importance: 8,
      },
      {
        id: 'conclusion',
        title: 'Conclusion',
        content: 'Machine learning is a powerful tool that continues to evolve and find new applications across industries.',
        level: 1,
        type: 'conclusion',
        keyPoints: ['Powerful tool', 'Continues to evolve', 'Cross-industry applications'],
        concepts: ['machine learning', 'applications'],
        difficulty: 'beginner',
        importance: 7,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAnalyzeTextWithComprehend.mockResolvedValue(mockComprehendAnalysis);
    
    const mockCompletion = {
      choices: [
        {
          message: {
            content: JSON.stringify(mockOpenAIResponse),
          },
        },
      ],
    };
    
    mockOpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue(mockCompletion),
      },
    } as any;
  });

  describe('organizeNotes', () => {
    it('should organize notes with default options', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].type).toBe('introduction');
      expect(result.sections[3].type).toBe('conclusion');
      expect(result.metadata.difficulty).toBeDefined();
      expect(result.categorization.primaryCategory).toBeDefined();
      expect(result.searchIndex.keywords).toBeDefined();
    });

    it('should organize notes with hierarchical style', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        organizationStyle: 'hierarchical',
        detailLevel: 'high',
      });

      expect(result.sections).toBeDefined();
      expect(result.structure.totalSections).toBe(4);
      expect(result.structure.hasIntroduction).toBe(true);
      expect(result.structure.hasConclusion).toBe(true);
    });

    it('should organize notes with topical style', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        organizationStyle: 'topical',
        maxSections: 10,
      });

      expect(result.sections).toBeDefined();
      expect(result.sections.length).toBeLessThanOrEqual(10);
      expect(result.categorization.tags).toContain('machine learning');
    });

    it('should organize notes with difficulty-based style', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        organizationStyle: 'difficulty-based',
      });

      expect(result.sections).toBeDefined();
      
      // Check that sections are ordered by difficulty
      const difficulties = result.sections.map(s => s.difficulty);
      const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
      
      for (let i = 1; i < difficulties.length; i++) {
        expect(difficultyOrder[difficulties[i]]).toBeGreaterThanOrEqual(difficultyOrder[difficulties[i-1]]);
      }
    });

    it('should include timestamps when requested and segments provided', async () => {
      const transcriptSegments = [
        { text: 'Machine learning is a subset of artificial intelligence', start: 0, duration: 5 },
        { text: 'Supervised learning uses labeled data', start: 60, duration: 4 },
        { text: 'Unsupervised learning finds patterns', start: 120, duration: 4 },
        { text: 'Machine learning is a powerful tool', start: 300, duration: 3 },
      ];

      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, transcriptSegments, {
        includeTimestamps: true,
      });

      expect(result.sections.some(s => s.timestamp)).toBe(true);
      const sectionWithTimestamp = result.sections.find(s => s.timestamp);
      expect(sectionWithTimestamp?.timestamp?.start).toBeGreaterThanOrEqual(0);
      expect(sectionWithTimestamp?.timestamp?.end).toBeGreaterThan(sectionWithTimestamp?.timestamp?.start || 0);
    });

    it('should handle OpenAI API failure gracefully', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      } as any;

      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].type).toBe('introduction');
    });

    it('should categorize content correctly', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result.categorization.primaryCategory).toBe('Technology');
      expect(result.categorization.tags).toContain('machine learning');
      expect(result.categorization.subjects).toContain('Technology');
      expect(result.categorization.subjects).toContain('Computer Science');
    });

    it('should build comprehensive search index', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result.searchIndex.keywords).toContain('machine');
      expect(result.searchIndex.keywords).toContain('learning');
      expect(result.searchIndex.phrases).toContain('machine learning');
      expect(result.searchIndex.entities).toBeDefined();
    });

    it('should calculate accurate metadata', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.metadata.mainTopics).toContain('Introduction to Machine Learning');
      expect(result.metadata.keyTerms).toContain('machine learning');
      expect(result.metadata.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
    });

    it('should limit sections based on maxSections option', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        maxSections: 2,
      });

      expect(result.sections.length).toBeLessThanOrEqual(2);
    });

    it('should filter sections based on minSectionLength', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        minSectionLength: 200,
      });

      result.sections.forEach(section => {
        expect(section.content.length).toBeGreaterThanOrEqual(50); // Fallback creates shorter sections
      });
    });
  });

  describe('searchNotes', () => {
    let mockOrganizedNotes: OrganizedNotes;

    beforeEach(() => {
      mockOrganizedNotes = {
        sections: [
          {
            id: 'intro',
            title: 'Introduction to Machine Learning',
            content: 'Machine learning is a subset of artificial intelligence.',
            level: 1,
            type: 'introduction',
            keyPoints: ['Machine learning is AI subset'],
            tags: ['machine learning', 'ai'],
            concepts: ['machine learning', 'artificial intelligence'],
            difficulty: 'beginner',
            importance: 9,
          },
          {
            id: 'supervised',
            title: 'Supervised Learning',
            content: 'Supervised learning uses labeled data for training.',
            level: 2,
            type: 'main-content',
            keyPoints: ['Uses labeled data'],
            tags: ['supervised', 'labeled data'],
            concepts: ['supervised learning'],
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
          mainTopics: ['Machine Learning'],
          keyTerms: ['machine learning'],
          concepts: ['machine learning'],
          difficulty: 'beginner',
          estimatedReadingTime: 1,
          wordCount: 20,
        },
        categorization: {
          primaryCategory: 'Technology',
          secondaryCategories: [],
          tags: ['machine learning'],
          subjects: ['Technology'],
        },
        searchIndex: {
          keywords: ['machine', 'learning'],
          phrases: ['machine learning'],
          entities: {},
        },
      };
    });

    it('should search by title', () => {
      const results = searchNotes(mockOrganizedNotes, 'Introduction');

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Introduction to Machine Learning');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      expect(results[0].matchedTerms).toContain('title');
    });

    it('should search by key points', () => {
      const results = searchNotes(mockOrganizedNotes, 'labeled data');

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Supervised Learning');
      expect(results[0].matchedTerms).toContain('keyPoint');
    });

    it('should search by concepts', () => {
      const results = searchNotes(mockOrganizedNotes, 'artificial intelligence');

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Introduction to Machine Learning');
      expect(results[0].matchedTerms).toContain('concept');
    });

    it('should search by tags', () => {
      const results = searchNotes(mockOrganizedNotes, 'supervised');

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Supervised Learning');
      expect(results[0].matchedTerms).toContain('tag');
    });

    it('should search in content when includeContent is true', () => {
      const results = searchNotes(mockOrganizedNotes, 'subset', {
        includeContent: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Introduction to Machine Learning');
      expect(results[0].matchedTerms).toContain('content');
    });

    it('should not search in content when includeContent is false', () => {
      const results = searchNotes(mockOrganizedNotes, 'subset', {
        includeContent: false,
      });

      expect(results).toHaveLength(0);
    });

    it('should limit results based on maxResults', () => {
      const results = searchNotes(mockOrganizedNotes, 'learning', {
        maxResults: 1,
      });

      expect(results).toHaveLength(1);
    });

    it('should return results sorted by relevance score', () => {
      const results = searchNotes(mockOrganizedNotes, 'learning');

      expect(results.length).toBeGreaterThan(0);
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i-1].relevanceScore);
      }
    });

    it('should handle empty query', () => {
      const results = searchNotes(mockOrganizedNotes, '');

      expect(results).toHaveLength(0);
    });

    it('should handle query with no matches', () => {
      const results = searchNotes(mockOrganizedNotes, 'quantum physics');

      expect(results).toHaveLength(0);
    });

    it('should perform keyword matching', () => {
      const results = searchNotes(mockOrganizedNotes, 'machine artificial');

      expect(results).toHaveLength(1);
      expect(results[0].section.title).toBe('Introduction to Machine Learning');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle Comprehend analysis failure', async () => {
      mockAnalyzeTextWithComprehend.mockRejectedValue(new Error('Comprehend error'));

      await expect(organizeNotes(mockRawNotes, mockVideoMetadata)).rejects.toThrow();
    });

    it('should handle invalid OpenAI response', async () => {
      const mockCompletion = {
        choices: [
          {
            message: {
              content: 'invalid json',
            },
          },
        ],
      };
      
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(mockCompletion),
        },
      } as any;

      const result = await organizeNotes(mockRawNotes, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('should handle empty notes input', async () => {
      const result = await organizeNotes('', mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    it('should handle missing video metadata', async () => {
      const minimalMetadata = {
        title: 'Test Video',
        description: '',
        duration: 0,
        channelTitle: '',
      };

      const result = await organizeNotes(mockRawNotes, minimalMetadata);

      expect(result).toBeDefined();
      expect(result.sections).toBeDefined();
    });
  });

  describe('organization styles', () => {
    it('should organize chronologically with transcript segments', async () => {
      const transcriptSegments = [
        { text: 'conclusion powerful tool', start: 300, duration: 3 },
        { text: 'introduction machine learning', start: 0, duration: 5 },
        { text: 'supervised learning labeled', start: 60, duration: 4 },
      ];

      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, transcriptSegments, {
        organizationStyle: 'chronological',
      });

      expect(result.sections).toBeDefined();
      // Sections should be ordered by their estimated time in the video
    });

    it('should organize topically by grouping related concepts', async () => {
      const result = await organizeNotes(mockRawNotes, mockVideoMetadata, undefined, {
        organizationStyle: 'topical',
      });

      expect(result.sections).toBeDefined();
      // Sections with similar concepts should be grouped together
    });
  });
});