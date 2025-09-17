import { generateSummary, generateSummaryVariations, SummaryOptions, VideoMetadata } from '../summary-generation';
import { analyzeTextWithComprehend } from '../comprehend';
import { validateContentQuality } from '../content-quality';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('../comprehend');
jest.mock('../content-quality');
jest.mock('openai');
jest.mock('../shared/logger');

const mockAnalyzeTextWithComprehend = analyzeTextWithComprehend as jest.MockedFunction<typeof analyzeTextWithComprehend>;
const mockValidateContentQuality = validateContentQuality as jest.MockedFunction<typeof validateContentQuality>;
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('Summary Generation Service', () => {
  const mockVideoMetadata: VideoMetadata = {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning concepts and applications',
    duration: 3600,
    channelTitle: 'Tech Education',
    tags: ['machine learning', 'AI', 'data science', 'algorithms'],
  };

  const mockTranscript = `
Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. This field has revolutionized many industries and continues to grow rapidly.

There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Supervised learning uses labeled data to train models, making it ideal for classification and regression problems. Common algorithms include linear regression, decision trees, and neural networks.

Unsupervised learning finds patterns in data without labeled examples. This approach is useful for clustering, dimensionality reduction, and anomaly detection. Popular techniques include k-means clustering and principal component analysis.

Reinforcement learning involves agents learning through interaction with an environment, receiving rewards or penalties for their actions. This approach has been successful in game playing, robotics, and autonomous systems.

Data preprocessing is crucial for successful machine learning projects. This includes cleaning data, handling missing values, feature selection, and normalization. The quality of your data directly impacts model performance.

Model evaluation is essential to ensure your machine learning system works effectively. Common metrics include accuracy, precision, recall, and F1-score for classification problems, and mean squared error for regression tasks.

Machine learning applications are everywhere today, from recommendation systems and image recognition to natural language processing and autonomous vehicles. As computing power increases and data becomes more abundant, we can expect even more innovative applications in the future.
  `.trim();

  const mockComprehendAnalysis = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95 },
      { Text: 'supervised learning', Score: 0.90 },
      { Text: 'unsupervised learning', Score: 0.88 },
      { Text: 'reinforcement learning', Score: 0.85 },
      { Text: 'data preprocessing', Score: 0.82 },
      { Text: 'model evaluation', Score: 0.80 },
      { Text: 'neural networks', Score: 0.78 },
      { Text: 'decision trees', Score: 0.75 },
    ],
    entities: [
      { Text: 'Machine Learning', Type: 'OTHER', Score: 0.95 },
      { Text: 'AI', Type: 'OTHER', Score: 0.90 },
      { Text: 'data science', Type: 'OTHER', Score: 0.85 },
    ],
    sentiment: {
      Sentiment: 'NEUTRAL',
      SentimentScore: {
        Positive: 0.1,
        Negative: 0.05,
        Neutral: 0.8,
        Mixed: 0.05,
      },
    },
  };

  const mockOpenAIResponse = {
    summary: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without explicit programming. The field encompasses three main types: supervised learning (using labeled data for classification and regression), unsupervised learning (finding patterns without labels), and reinforcement learning (learning through environmental interaction). Key aspects include data preprocessing, model evaluation using metrics like accuracy and precision, and widespread applications in recommendation systems, image recognition, and autonomous vehicles.',
    keyPoints: [
      'Machine learning is a subset of AI that learns from data without explicit programming',
      'Three main types: supervised, unsupervised, and reinforcement learning',
      'Supervised learning uses labeled data for classification and regression',
      'Unsupervised learning finds patterns without labeled examples',
      'Reinforcement learning involves agents learning through environmental interaction',
      'Data preprocessing is crucial for successful ML projects',
      'Model evaluation uses metrics like accuracy, precision, and recall',
      'Applications include recommendation systems, image recognition, and autonomous vehicles',
    ],
    topics: [
      'Machine Learning Fundamentals',
      'Types of Machine Learning',
      'Data Preprocessing',
      'Model Evaluation',
      'Real-world Applications',
    ],
    mainConcepts: [
      'artificial intelligence',
      'supervised learning',
      'unsupervised learning',
      'reinforcement learning',
      'data preprocessing',
      'model evaluation',
    ],
  };

  const mockQualityResult = {
    overallScore: 8.5,
    readabilityScore: 8.0,
    coherenceScore: 9.0,
    completenessScore: 8.5,
    issues: [],
    suggestions: ['Consider adding more specific examples'],
    metrics: {
      wordCount: 85,
      sentenceCount: 4,
      avgWordsPerSentence: 21.25,
      complexWords: 12,
      readingLevel: 'intermediate',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAnalyzeTextWithComprehend.mockResolvedValue(mockComprehendAnalysis);
    mockValidateContentQuality.mockResolvedValue(mockQualityResult);
    
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

  describe('generateSummary', () => {
    it('should generate summary with default options', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.summary).toBe(mockOpenAIResponse.summary);
      expect(result.keyPoints).toEqual(mockOpenAIResponse.keyPoints);
      expect(result.topics).toEqual(mockOpenAIResponse.topics);
      expect(result.mainConcepts).toEqual(mockOpenAIResponse.mainConcepts);
      expect(result.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
      expect(result.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should generate summary with custom options', async () => {
      const options: SummaryOptions = {
        language: 'en',
        length: 'brief',
        style: 'casual',
        includeKeyPoints: true,
        includeTopics: true,
        maxLength: 200,
        focusAreas: ['applications', 'algorithms'],
      };

      const result = await generateSummary(mockTranscript, mockVideoMetadata, options);

      expect(result).toBeDefined();
      expect(result.metadata.language).toBe('en');
      expect(result.metadata.style).toBe('casual');
      expect(result.metadata.length).toBe('brief');
      expect(mockOpenAI.prototype.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should analyze content with Comprehend', async () => {
      await generateSummary(mockTranscript, mockVideoMetadata);

      expect(mockAnalyzeTextWithComprehend).toHaveBeenCalledWith(mockTranscript, 'en');
    });

    it('should validate content quality', async () => {
      await generateSummary(mockTranscript, mockVideoMetadata);

      expect(mockValidateContentQuality).toHaveBeenCalledWith(
        mockOpenAIResponse.summary,
        expect.objectContaining({
          checkReadability: true,
          checkCoherence: true,
          checkCompleteness: true,
          minLength: 50,
          maxLength: 1000,
        })
      );
    });

    it('should calculate correct metadata', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result.metadata).toEqual(
        expect.objectContaining({
          language: 'en',
          style: 'educational',
          length: 'medium',
          sourceLength: mockTranscript.length,
          compressionRatio: expect.any(Number),
          generatedAt: expect.any(String),
        })
      );
      expect(result.metadata.compressionRatio).toBeGreaterThan(1);
    });

    it('should determine difficulty correctly', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
    });

    it('should analyze structure correctly', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result.structure).toEqual(
        expect.objectContaining({
          hasIntroduction: expect.any(Boolean),
          hasConclusion: expect.any(Boolean),
          mainSections: expect.any(Number),
        })
      );
      expect(result.structure.mainSections).toBeGreaterThan(0);
    });

    it('should include insights from Comprehend analysis', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result.insights).toEqual(
        expect.objectContaining({
          keyPhrases: expect.arrayContaining(['machine learning']),
          entities: expect.any(Object),
          sentiment: 'NEUTRAL',
          confidence: expect.any(Number),
        })
      );
    });

    it('should handle different summary lengths', async () => {
      const briefOptions: SummaryOptions = { length: 'brief' };
      const detailedOptions: SummaryOptions = { length: 'detailed' };

      const briefResult = await generateSummary(mockTranscript, mockVideoMetadata, briefOptions);
      const detailedResult = await generateSummary(mockTranscript, mockVideoMetadata, detailedOptions);

      expect(briefResult.metadata.length).toBe('brief');
      expect(detailedResult.metadata.length).toBe('detailed');
    });

    it('should handle different styles', async () => {
      const academicOptions: SummaryOptions = { style: 'academic' };
      const casualOptions: SummaryOptions = { style: 'casual' };
      const technicalOptions: SummaryOptions = { style: 'technical' };

      const academicResult = await generateSummary(mockTranscript, mockVideoMetadata, academicOptions);
      const casualResult = await generateSummary(mockTranscript, mockVideoMetadata, casualOptions);
      const technicalResult = await generateSummary(mockTranscript, mockVideoMetadata, technicalOptions);

      expect(academicResult.metadata.style).toBe('academic');
      expect(casualResult.metadata.style).toBe('casual');
      expect(technicalResult.metadata.style).toBe('technical');
    });

    it('should handle focus areas', async () => {
      const options: SummaryOptions = {
        focusAreas: ['machine learning algorithms', 'data preprocessing'],
      };

      await generateSummary(mockTranscript, mockVideoMetadata, options);

      const callArgs = (mockOpenAI.prototype.chat.completions.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('machine learning algorithms');
      expect(callArgs.messages[1].content).toContain('data preprocessing');
    });
  });

  describe('error handling', () => {
    it('should throw error for empty transcript', async () => {
      await expect(generateSummary('', mockVideoMetadata)).rejects.toThrow(
        'Transcript is required for summary generation'
      );
    });

    it('should throw error for very short transcript', async () => {
      await expect(generateSummary('Short text', mockVideoMetadata)).rejects.toThrow(
        'Transcript is too short for meaningful summary generation'
      );
    });

    it('should handle OpenAI API failure gracefully', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      } as any;

      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.keyPoints).toBeDefined();
      expect(result.topics).toBeDefined();
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

      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should handle Comprehend analysis failure', async () => {
      mockAnalyzeTextWithComprehend.mockRejectedValue(new Error('Comprehend error'));

      await expect(generateSummary(mockTranscript, mockVideoMetadata)).rejects.toThrow();
    });

    it('should handle content quality validation failure', async () => {
      mockValidateContentQuality.mockRejectedValue(new Error('Quality validation error'));

      await expect(generateSummary(mockTranscript, mockVideoMetadata)).rejects.toThrow();
    });
  });

  describe('generateSummaryVariations', () => {
    it('should generate multiple summary variations', async () => {
      const results = await generateSummaryVariations(mockTranscript, mockVideoMetadata);

      expect(results).toHaveLength(3);
      expect(results[0].metadata.style).toBe('educational');
      expect(results[1].metadata.style).toBe('casual');
      expect(results[2].metadata.style).toBe('technical');
    });

    it('should handle partial failures in variations', async () => {
      let callCount = 0;
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
              throw new Error('API error for second variation');
            }
            return Promise.resolve({
              choices: [{ message: { content: JSON.stringify(mockOpenAIResponse) } }],
            });
          }),
        },
      } as any;

      const results = await generateSummaryVariations(mockTranscript, mockVideoMetadata);

      expect(results.length).toBeLessThan(3); // Some variations failed
      expect(results.length).toBeGreaterThan(0); // But some succeeded
    });
  });

  describe('difficulty determination', () => {
    it('should classify beginner content correctly', async () => {
      const beginnerTranscript = `
This video is an introduction to basic concepts. We will cover simple ideas that are easy to understand. 
The content is designed for beginners who are just starting to learn about this topic.
      `.trim();

      const beginnerMetadata = {
        ...mockVideoMetadata,
        title: 'Beginner Introduction to Simple Concepts',
      };

      const result = await generateSummary(beginnerTranscript, beginnerMetadata);

      expect(result.difficulty).toBe('beginner');
    });

    it('should classify advanced content correctly', async () => {
      const advancedTranscript = `
This comprehensive analysis examines sophisticated methodologies and advanced algorithmic implementations. 
The discussion encompasses complex theoretical frameworks, intricate mathematical formulations, and 
professional-grade optimization techniques utilized in contemporary research paradigms.
      `.trim();

      const advancedMetadata = {
        ...mockVideoMetadata,
        title: 'Advanced Professional Techniques for Expert Practitioners',
      };

      const result = await generateSummary(advancedTranscript, advancedMetadata);

      expect(result.difficulty).toBe('advanced');
    });
  });

  describe('structure analysis', () => {
    it('should detect introduction patterns', async () => {
      const transcriptWithIntro = `
This video covers the fundamentals of machine learning. In this comprehensive guide, we will explore...
${mockTranscript}
      `.trim();

      const result = await generateSummary(transcriptWithIntro, mockVideoMetadata);

      expect(result.structure.hasIntroduction).toBe(true);
    });

    it('should detect conclusion patterns', async () => {
      const transcriptWithConclusion = `
${mockTranscript}
In conclusion, machine learning represents a transformative technology. To summarize the key points discussed...
      `.trim();

      const result = await generateSummary(transcriptWithConclusion, mockVideoMetadata);

      expect(result.structure.hasConclusion).toBe(true);
    });

    it('should count main sections correctly', async () => {
      const structuredTranscript = `
First, we discuss the basics. Second, we explore advanced topics. Third, we examine applications. 
Additionally, we cover best practices. Furthermore, we analyze case studies.
      `.trim();

      const result = await generateSummary(structuredTranscript, mockVideoMetadata);

      expect(result.structure.mainSections).toBeGreaterThan(1);
    });
  });

  describe('compression ratio calculation', () => {
    it('should calculate compression ratio correctly', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      expect(result.metadata.compressionRatio).toBeGreaterThan(1);
      expect(result.metadata.compressionRatio).toBe(
        mockTranscript.length / result.summary.length
      );
    });
  });

  describe('reading time estimation', () => {
    it('should estimate reading time correctly', async () => {
      const result = await generateSummary(mockTranscript, mockVideoMetadata);

      const expectedReadingTime = Math.ceil(result.wordCount / 200);
      expect(result.estimatedReadingTime).toBe(expectedReadingTime);
    });
  });
});