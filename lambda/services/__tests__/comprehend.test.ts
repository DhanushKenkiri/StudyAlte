import { mockClient } from 'aws-sdk-client-mock';
import { ComprehendClient, DetectKeyPhrasesCommand, DetectEntitiesCommand, DetectSentimentCommand } from '@aws-sdk/client-comprehend';
import {
  analyzeTextWithComprehend,
  extractTopKeyPhrases,
  extractEntitiesByType,
  calculateContentQuality,
} from '../comprehend';

// Mock AWS Comprehend client
const comprehendMock = mockClient(ComprehendClient);

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';

describe('Comprehend Service', () => {
  beforeEach(() => {
    comprehendMock.reset();
    jest.clearAllMocks();
  });

  const mockText = 'This is a test document about machine learning and artificial intelligence. John Smith works at OpenAI in San Francisco. The company focuses on developing advanced AI systems.';

  const mockKeyPhrasesResponse = {
    KeyPhrases: [
      { Text: 'machine learning', Score: 0.95, BeginOffset: 35, EndOffset: 51 },
      { Text: 'artificial intelligence', Score: 0.92, BeginOffset: 56, EndOffset: 79 },
      { Text: 'John Smith', Score: 0.88, BeginOffset: 81, EndOffset: 91 },
      { Text: 'OpenAI', Score: 0.85, BeginOffset: 101, EndOffset: 107 },
      { Text: 'San Francisco', Score: 0.82, BeginOffset: 111, EndOffset: 124 },
      { Text: 'advanced AI systems', Score: 0.79, BeginOffset: 160, EndOffset: 179 },
    ],
  };

  const mockEntitiesResponse = {
    Entities: [
      { Text: 'John Smith', Type: 'PERSON', Score: 0.95, BeginOffset: 81, EndOffset: 91 },
      { Text: 'OpenAI', Type: 'ORGANIZATION', Score: 0.90, BeginOffset: 101, EndOffset: 107 },
      { Text: 'San Francisco', Type: 'LOCATION', Score: 0.88, BeginOffset: 111, EndOffset: 124 },
      { Text: 'machine learning', Type: 'OTHER', Score: 0.85, BeginOffset: 35, EndOffset: 51 },
    ],
  };

  const mockSentimentResponse = {
    Sentiment: 'POSITIVE',
    SentimentScore: {
      Positive: 0.8,
      Negative: 0.1,
      Neutral: 0.1,
      Mixed: 0.0,
    },
  };

  describe('analyzeTextWithComprehend', () => {
    it('should successfully analyze text with all services', async () => {
      // Mock all Comprehend services
      comprehendMock.on(DetectKeyPhrasesCommand).resolves(mockKeyPhrasesResponse);
      comprehendMock.on(DetectEntitiesCommand).resolves(mockEntitiesResponse);
      comprehendMock.on(DetectSentimentCommand).resolves(mockSentimentResponse);

      const result = await analyzeTextWithComprehend(mockText, 'en');

      expect(result.keyPhrases).toHaveLength(6);
      expect(result.keyPhrases[0]).toEqual({
        text: 'machine learning',
        score: 0.95,
        beginOffset: 35,
        endOffset: 51,
      });

      expect(result.entities).toHaveLength(4);
      expect(result.entities[0]).toEqual({
        text: 'John Smith',
        type: 'PERSON',
        score: 0.95,
        beginOffset: 81,
        endOffset: 91,
      });

      expect(result.sentiment).toEqual({
        sentiment: 'POSITIVE',
        sentimentScore: {
          positive: 0.8,
          negative: 0.1,
          neutral: 0.1,
          mixed: 0.0,
        },
      });

      // Verify all services were called with correct parameters
      expect(comprehendMock.commandCalls(DetectKeyPhrasesCommand)).toHaveLength(1);
      expect(comprehendMock.commandCalls(DetectEntitiesCommand)).toHaveLength(1);
      expect(comprehendMock.commandCalls(DetectSentimentCommand)).toHaveLength(1);

      const keyPhrasesCall = comprehendMock.commandCalls(DetectKeyPhrasesCommand)[0];
      expect(keyPhrasesCall.args[0].input.Text).toBe(mockText);
      expect(keyPhrasesCall.args[0].input.LanguageCode).toBe('en');
    });

    it('should handle long text by truncating', async () => {
      const longText = 'a'.repeat(6000); // Longer than 5000 character limit

      comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
      comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
      comprehendMock.on(DetectSentimentCommand).resolves({
        Sentiment: 'NEUTRAL',
        SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
      });

      await analyzeTextWithComprehend(longText, 'en');

      // Verify text was truncated to 5000 characters
      const keyPhrasesCall = comprehendMock.commandCalls(DetectKeyPhrasesCommand)[0];
      expect(keyPhrasesCall.args[0].input.Text).toHaveLength(5000);
    });

    it('should handle partial service failures gracefully', async () => {
      // Mock key phrases to succeed
      comprehendMock.on(DetectKeyPhrasesCommand).resolves(mockKeyPhrasesResponse);
      
      // Mock entities to fail
      comprehendMock.on(DetectEntitiesCommand).rejects(new Error('Entities service error'));
      
      // Mock sentiment to succeed
      comprehendMock.on(DetectSentimentCommand).resolves(mockSentimentResponse);

      const result = await analyzeTextWithComprehend(mockText, 'en');

      expect(result.keyPhrases).toHaveLength(6);
      expect(result.entities).toHaveLength(0); // Should be empty due to failure
      expect(result.sentiment.sentiment).toBe('POSITIVE');
    });

    it('should handle complete service failure', async () => {
      // Mock all services to fail
      comprehendMock.on(DetectKeyPhrasesCommand).rejects(new Error('Service error'));
      comprehendMock.on(DetectEntitiesCommand).rejects(new Error('Service error'));
      comprehendMock.on(DetectSentimentCommand).rejects(new Error('Service error'));

      const result = await analyzeTextWithComprehend(mockText, 'en');

      expect(result.keyPhrases).toHaveLength(0);
      expect(result.entities).toHaveLength(0);
      expect(result.sentiment).toEqual({
        sentiment: 'NEUTRAL',
        sentimentScore: { positive: 0, negative: 0, neutral: 1, mixed: 0 },
      });
    });

    it('should use default language code when not provided', async () => {
      comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
      comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
      comprehendMock.on(DetectSentimentCommand).resolves({
        Sentiment: 'NEUTRAL',
        SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
      });

      await analyzeTextWithComprehend(mockText);

      const keyPhrasesCall = comprehendMock.commandCalls(DetectKeyPhrasesCommand)[0];
      expect(keyPhrasesCall.args[0].input.LanguageCode).toBe('en');
    });
  });

  describe('extractTopKeyPhrases', () => {
    const keyPhrases = [
      { text: 'machine learning', score: 0.95, beginOffset: 0, endOffset: 16 },
      { text: 'artificial intelligence', score: 0.92, beginOffset: 20, endOffset: 43 },
      { text: 'neural networks', score: 0.88, beginOffset: 50, endOffset: 65 },
      { text: 'data science', score: 0.75, beginOffset: 70, endOffset: 82 }, // Below default threshold
      { text: 'deep learning', score: 0.85, beginOffset: 90, endOffset: 103 },
    ];

    it('should extract top key phrases above threshold', async () => {
      const result = extractTopKeyPhrases(keyPhrases, 10, 0.8);

      expect(result).toHaveLength(4);
      expect(result).toEqual([
        'machine learning',
        'artificial intelligence',
        'neural networks',
        'deep learning',
      ]);
    });

    it('should respect limit parameter', async () => {
      const result = extractTopKeyPhrases(keyPhrases, 2, 0.8);

      expect(result).toHaveLength(2);
      expect(result).toEqual(['machine learning', 'artificial intelligence']);
    });

    it('should use default parameters', async () => {
      const result = extractTopKeyPhrases(keyPhrases);

      expect(result).toHaveLength(4); // Only phrases above 0.8 threshold
    });

    it('should handle empty input', async () => {
      const result = extractTopKeyPhrases([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('extractEntitiesByType', () => {
    const entities = [
      { text: 'John Smith', type: 'PERSON', score: 0.95, beginOffset: 0, endOffset: 10 },
      { text: 'Jane Doe', type: 'PERSON', score: 0.85, beginOffset: 15, endOffset: 23 },
      { text: 'OpenAI', type: 'ORGANIZATION', score: 0.90, beginOffset: 30, endOffset: 36 },
      { text: 'Microsoft', type: 'ORGANIZATION', score: 0.75, beginOffset: 40, endOffset: 49 }, // Below threshold
      { text: 'San Francisco', type: 'LOCATION', score: 0.88, beginOffset: 55, endOffset: 68 },
      { text: 'AI Conference', type: 'EVENT', score: 0.82, beginOffset: 75, endOffset: 88 },
    ];

    it('should extract entities by type above threshold', async () => {
      const result = extractEntitiesByType(entities, ['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT'], 0.8);

      expect(result).toEqual({
        PERSON: ['John Smith', 'Jane Doe'],
        ORGANIZATION: ['OpenAI'], // Microsoft filtered out due to low score
        LOCATION: ['San Francisco'],
        EVENT: ['AI Conference'],
      });
    });

    it('should use default entity types', async () => {
      const result = extractEntitiesByType(entities);

      expect(Object.keys(result)).toEqual(['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT']);
    });

    it('should handle empty input', async () => {
      const result = extractEntitiesByType([]);

      expect(result).toEqual({
        PERSON: [],
        ORGANIZATION: [],
        LOCATION: [],
        EVENT: [],
      });
    });

    it('should sort entities by score within each type', async () => {
      const unsortedEntities = [
        { text: 'Jane Doe', type: 'PERSON', score: 0.85, beginOffset: 15, endOffset: 23 },
        { text: 'John Smith', type: 'PERSON', score: 0.95, beginOffset: 0, endOffset: 10 },
      ];

      const result = extractEntitiesByType(unsortedEntities, ['PERSON'], 0.8);

      expect(result.PERSON).toEqual(['John Smith', 'Jane Doe']); // Sorted by score descending
    });
  });

  describe('calculateContentQuality', () => {
    it('should calculate quality score with all factors', async () => {
      const analysis = {
        keyPhrases: Array(15).fill(null).map((_, i) => ({ 
          text: `phrase${i}`, 
          score: 0.9, 
          beginOffset: 0, 
          endOffset: 10 
        })),
        entities: [
          { text: 'Person', type: 'PERSON', score: 0.9, beginOffset: 0, endOffset: 6 },
          { text: 'Org', type: 'ORGANIZATION', score: 0.9, beginOffset: 10, endOffset: 13 },
          { text: 'Place', type: 'LOCATION', score: 0.9, beginOffset: 20, endOffset: 25 },
        ],
        sentiment: {
          sentiment: 'POSITIVE' as const,
          sentimentScore: {
            positive: 0.8,
            negative: 0.1,
            neutral: 0.1,
            mixed: 0.0,
          },
        },
      };

      const result = calculateContentQuality(analysis);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.factors.keyPhrasesDensity).toBeCloseTo(0.75); // 15/20 capped at 1
      expect(result.factors.entityRichness).toBeCloseTo(0.6); // 3 types / 5
      expect(result.factors.sentimentBalance).toBeCloseTo(0.45); // (0.8 + 0.1) / 2
    });

    it('should handle low quality content', async () => {
      const analysis = {
        keyPhrases: [], // No key phrases
        entities: [], // No entities
        sentiment: {
          sentiment: 'NEGATIVE' as const,
          sentimentScore: {
            positive: 0.1,
            negative: 0.8,
            neutral: 0.1,
            mixed: 0.0,
          },
        },
      };

      const result = calculateContentQuality(analysis);

      expect(result.score).toBeLessThan(0.3);
      expect(result.factors.keyPhrasesDensity).toBe(0);
      expect(result.factors.entityRichness).toBe(0);
      expect(result.factors.sentimentBalance).toBeCloseTo(0.1); // (0.1 + 0.1) / 2
    });

    it('should cap key phrases density at 1.0', async () => {
      const analysis = {
        keyPhrases: Array(50).fill(null).map((_, i) => ({ 
          text: `phrase${i}`, 
          score: 0.9, 
          beginOffset: 0, 
          endOffset: 10 
        })), // More than 20 phrases
        entities: [],
        sentiment: {
          sentiment: 'NEUTRAL' as const,
          sentimentScore: {
            positive: 0.3,
            negative: 0.2,
            neutral: 0.5,
            mixed: 0.0,
          },
        },
      };

      const result = calculateContentQuality(analysis);

      expect(result.factors.keyPhrasesDensity).toBe(1.0); // Capped at 1.0
    });
  });
});