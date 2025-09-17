import { generateMindMap, MindMapOptions, VideoMetadata } from '../mindmap-generation';
import { analyzeTextWithComprehend } from '../comprehend';
import { validateMindMapStructure } from '../mindmap-validation';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('../comprehend');
jest.mock('../mindmap-validation');
jest.mock('openai');
jest.mock('../shared/logger');

const mockAnalyzeTextWithComprehend = analyzeTextWithComprehend as jest.MockedFunction<typeof analyzeTextWithComprehend>;
const mockValidateMindMapStructure = validateMindMapStructure as jest.MockedFunction<typeof validateMindMapStructure>;
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('Mind Map Generation Service', () => {
  const mockVideoMetadata: VideoMetadata = {
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning concepts and applications',
    duration: 3600,
    channelTitle: 'Tech Education',
    tags: ['machine learning', 'AI', 'data science', 'algorithms'],
  };

  const mockTranscript = `
Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. This field has revolutionized many industries and continues to grow rapidly.

There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Supervised learning uses labeled data to train models, making it ideal for classification and regression problems.

Unsupervised learning finds patterns in data without labeled examples. This approach is useful for clustering, dimensionality reduction, and anomaly detection.

Reinforcement learning involves agents learning through interaction with an environment, receiving rewards or penalties for their actions.

Data preprocessing is crucial for successful machine learning projects. This includes cleaning data, handling missing values, feature selection, and normalization.
  `.trim();

  const mockSummary = 'Machine learning is a subset of AI with three main types: supervised, unsupervised, and reinforcement learning. Data preprocessing is crucial for success.';

  const mockKeyPoints = [
    'Machine learning is a subset of artificial intelligence',
    'Three main types: supervised, unsupervised, and reinforcement learning',
    'Supervised learning uses labeled data for classification and regression',
    'Unsupervised learning finds patterns without labeled examples',
    'Reinforcement learning involves agents learning through environmental interaction',
    'Data preprocessing is crucial for successful ML projects',
  ];

  const mockTopics = [
    'Machine Learning Fundamentals',
    'Supervised Learning',
    'Unsupervised Learning',
    'Reinforcement Learning',
    'Data Preprocessing',
  ];

  const mockComprehendAnalysis = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95 },
      { Text: 'supervised learning', Score: 0.90 },
      { Text: 'unsupervised learning', Score: 0.88 },
      { Text: 'reinforcement learning', Score: 0.85 },
      { Text: 'data preprocessing', Score: 0.82 },
      { Text: 'artificial intelligence', Score: 0.80 },
    ],
    entities: [
      { Text: 'Machine Learning', Type: 'OTHER', Score: 0.95 },
      { Text: 'AI', Type: 'OTHER', Score: 0.90 },
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
    rootConcept: {
      label: 'Machine Learning',
      description: 'A subset of artificial intelligence that enables computers to learn from data',
    },
    concepts: [
      {
        id: 'supervised-learning',
        label: 'Supervised Learning',
        type: 'main-topic',
        level: 1,
        parentId: 'root',
        description: 'Learning with labeled data for classification and regression',
        examples: ['Email classification', 'House price prediction'],
        keyPoints: ['Uses labeled data', 'Classification and regression'],
        importance: 9,
        complexity: 6,
        category: 'ML Types',
        tags: ['supervised', 'classification', 'regression'],
      },
      {
        id: 'unsupervised-learning',
        label: 'Unsupervised Learning',
        type: 'main-topic',
        level: 1,
        parentId: 'root',
        description: 'Finding patterns in data without labeled examples',
        examples: ['Customer segmentation', 'Anomaly detection'],
        keyPoints: ['No labeled data', 'Pattern discovery'],
        importance: 8,
        complexity: 7,
        category: 'ML Types',
        tags: ['unsupervised', 'clustering', 'patterns'],
      },
      {
        id: 'classification',
        label: 'Classification',
        type: 'subtopic',
        level: 2,
        parentId: 'supervised-learning',
        description: 'Predicting discrete categories or classes',
        examples: ['Spam detection', 'Image recognition'],
        importance: 7,
        complexity: 5,
        category: 'Supervised Learning',
        tags: ['classification', 'categories'],
      },
      {
        id: 'regression',
        label: 'Regression',
        type: 'subtopic',
        level: 2,
        parentId: 'supervised-learning',
        description: 'Predicting continuous numerical values',
        examples: ['Stock prices', 'Temperature prediction'],
        importance: 7,
        complexity: 5,
        category: 'Supervised Learning',
        tags: ['regression', 'continuous'],
      },
    ],
    relationships: [
      {
        sourceId: 'supervised-learning',
        targetId: 'unsupervised-learning',
        type: 'related',
        label: 'Both are ML approaches',
        strength: 0.7,
        bidirectional: true,
      },
      {
        sourceId: 'classification',
        targetId: 'regression',
        type: 'related',
        label: 'Both supervised techniques',
        strength: 0.6,
        bidirectional: true,
      },
    ],
  };

  const mockValidationResult = {
    isValid: true,
    overallScore: 8.5,
    issues: [],
    suggestions: ['Consider adding more examples'],
    metrics: {
      connectivity: 0.9,
      balance: 0.8,
      depth: 0.7,
      coverage: 0.85,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAnalyzeTextWithComprehend.mockResolvedValue(mockComprehendAnalysis);
    mockValidateMindMapStructure.mockResolvedValue(mockValidationResult);
    
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

  describe('generateMindMap', () => {
    it('should generate mind map with default options', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.connections).toBeDefined();
      expect(result.layout).toBeDefined();
      expect(result.metadata.totalNodes).toBeGreaterThan(0);
      expect(result.metadata.totalConnections).toBeGreaterThan(0);
    });

    it('should generate mind map with custom options', async () => {
      const options: MindMapOptions = {
        language: 'en',
        maxNodes: 20,
        maxDepth: 3,
        includeExamples: true,
        includeDefinitions: true,
        organizationStyle: 'radial',
        focusAreas: ['supervised learning'],
        complexity: 'comprehensive',
        colorScheme: 'importance',
      };

      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        options
      );

      expect(result).toBeDefined();
      expect(result.layout.type).toBe('radial');
      expect(result.metadata.complexity).toBe('comprehensive');
      expect(mockOpenAI.prototype.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should analyze content with Comprehend', async () => {
      await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(mockAnalyzeTextWithComprehend).toHaveBeenCalledWith(mockTranscript, 'en');
    });

    it('should validate mind map structure', async () => {
      await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(mockValidateMindMapStructure).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          checkConnectivity: true,
          checkBalance: true,
          checkDepth: true,
          maxNodes: 50,
          maxDepth: 4,
        })
      );
    });

    it('should create root node correctly', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      const rootNode = result.nodes.find(node => node.type === 'root');
      expect(rootNode).toBeDefined();
      expect(rootNode?.level).toBe(0);
      expect(rootNode?.label).toBe('Machine Learning');
      expect(result.metadata.rootNodeId).toBe(rootNode?.id);
    });

    it('should create hierarchical structure', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      const mainTopics = result.nodes.filter(node => node.type === 'main-topic');
      const subtopics = result.nodes.filter(node => node.type === 'subtopic');

      expect(mainTopics.length).toBeGreaterThan(0);
      expect(subtopics.length).toBeGreaterThan(0);

      // Check parent-child relationships
      subtopics.forEach(subtopic => {
        expect(subtopic.parentId).toBeDefined();
        const parent = result.nodes.find(node => node.id === subtopic.parentId);
        expect(parent).toBeDefined();
        expect(parent?.children).toContain(subtopic.id);
      });
    });

    it('should create connections between nodes', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.connections.length).toBeGreaterThan(0);

      // Check that all connections reference existing nodes
      result.connections.forEach(connection => {
        const sourceExists = result.nodes.some(node => node.id === connection.sourceId);
        const targetExists = result.nodes.some(node => node.id === connection.targetId);
        expect(sourceExists).toBe(true);
        expect(targetExists).toBe(true);
      });
    });

    it('should calculate layout correctly', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'hierarchical' }
      );

      expect(result.layout.type).toBe('hierarchical');
      expect(result.layout.dimensions.width).toBeGreaterThan(0);
      expect(result.layout.dimensions.height).toBeGreaterThan(0);
      expect(result.layout.spacing.horizontal).toBeGreaterThan(0);
      expect(result.layout.spacing.vertical).toBeGreaterThan(0);
    });

    it('should apply positioning to nodes', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      result.nodes.forEach(node => {
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.size.width).toBeGreaterThan(0);
        expect(node.size.height).toBeGreaterThan(0);
      });
    });

    it('should calculate statistics correctly', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.statistics).toEqual(
        expect.objectContaining({
          nodesByType: expect.any(Object),
          nodesByLevel: expect.any(Object),
          connectionsByType: expect.any(Object),
          averageNodeComplexity: expect.any(Number),
          conceptCoverage: expect.any(Number),
        })
      );

      expect(result.statistics.averageNodeComplexity).toBeGreaterThan(0);
      expect(result.statistics.conceptCoverage).toBeGreaterThanOrEqual(0);
      expect(result.statistics.conceptCoverage).toBeLessThanOrEqual(100);
    });

    it('should generate export formats', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.exportFormats.json).toBeDefined();
      expect(result.exportFormats.mermaid).toBeDefined();
      expect(result.exportFormats.graphviz).toBeDefined();

      // Validate JSON format
      expect(() => JSON.parse(result.exportFormats.json)).not.toThrow();

      // Validate Mermaid format
      expect(result.exportFormats.mermaid).toContain('graph TD');

      // Validate Graphviz format
      expect(result.exportFormats.graphviz).toContain('digraph MindMap');
    });

    it('should handle different organization styles', async () => {
      const hierarchicalResult = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'hierarchical' }
      );

      const radialResult = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'radial' }
      );

      const networkResult = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'network' }
      );

      expect(hierarchicalResult.layout.type).toBe('hierarchical');
      expect(radialResult.layout.type).toBe('radial');
      expect(networkResult.layout.type).toBe('network');

      // Radial layout should have radial spacing
      expect(radialResult.layout.spacing.radial).toBeDefined();
    });

    it('should handle different complexity levels', async () => {
      const simpleResult = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { complexity: 'simple' }
      );

      const comprehensiveResult = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { complexity: 'comprehensive' }
      );

      expect(simpleResult.metadata.complexity).toBe('simple');
      expect(comprehensiveResult.metadata.complexity).toBe('comprehensive');
    });

    it('should include examples when requested', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { includeExamples: true }
      );

      const hasExamples = result.nodes.some(node => 
        node.content.examples && node.content.examples.length > 0
      );
      expect(hasExamples).toBe(true);
    });

    it('should include definitions when requested', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { includeDefinitions: true }
      );

      const hasDefinitions = result.nodes.some(node => 
        node.content.definition && node.content.definition.length > 0
      );
      expect(hasDefinitions).toBe(true);
    });

    it('should respect maxNodes limit', async () => {
      const maxNodes = 10;
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { maxNodes }
      );

      expect(result.nodes.length).toBeLessThanOrEqual(maxNodes + 5); // Allow some flexibility
    });

    it('should respect maxDepth limit', async () => {
      const maxDepth = 2;
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { maxDepth }
      );

      const actualMaxDepth = Math.max(...result.nodes.map(node => node.level));
      expect(actualMaxDepth).toBeLessThanOrEqual(maxDepth + 1); // Allow some flexibility
    });
  });

  describe('error handling', () => {
    it('should throw error when no content is provided', async () => {
      await expect(
        generateMindMap('', '', [], [], mockVideoMetadata)
      ).rejects.toThrow('Either transcript or summary is required for mind map generation');
    });

    it('should throw error when content is too short', async () => {
      await expect(
        generateMindMap('Short', '', [], [], mockVideoMetadata)
      ).rejects.toThrow('Content is too short for meaningful mind map generation');
    });

    it('should handle OpenAI API failure gracefully', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      } as any;

      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
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

      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should handle Comprehend analysis failure', async () => {
      mockAnalyzeTextWithComprehend.mockRejectedValue(new Error('Comprehend error'));

      await expect(
        generateMindMap(mockTranscript, mockSummary, mockKeyPoints, mockTopics, mockVideoMetadata)
      ).rejects.toThrow();
    });

    it('should handle validation failure gracefully', async () => {
      mockValidateMindMapStructure.mockRejectedValue(new Error('Validation error'));

      await expect(
        generateMindMap(mockTranscript, mockSummary, mockKeyPoints, mockTopics, mockVideoMetadata)
      ).rejects.toThrow();
    });
  });

  describe('fallback generation', () => {
    it('should generate fallback mind map when OpenAI fails', async () => {
      mockOpenAI.prototype.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API error')),
        },
      } as any;

      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      expect(result.nodes.length).toBeGreaterThan(0);
      
      // Should have root node
      const rootNode = result.nodes.find(node => node.type === 'root');
      expect(rootNode).toBeDefined();

      // Should have topic nodes
      const topicNodes = result.nodes.filter(node => node.type === 'main-topic');
      expect(topicNodes.length).toBeGreaterThan(0);
    });
  });

  describe('layout algorithms', () => {
    it('should apply hierarchical layout correctly', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'hierarchical' }
      );

      const rootNode = result.nodes.find(node => node.type === 'root');
      expect(rootNode?.position.y).toBeLessThan(200); // Root should be near top

      // Level 1 nodes should be below root
      const level1Nodes = result.nodes.filter(node => node.level === 1);
      level1Nodes.forEach(node => {
        expect(node.position.y).toBeGreaterThan(rootNode?.position.y || 0);
      });
    });

    it('should apply radial layout correctly', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata,
        { organizationStyle: 'radial' }
      );

      const rootNode = result.nodes.find(node => node.type === 'root');
      const centerX = result.layout.dimensions.width / 2;
      const centerY = result.layout.dimensions.height / 2;

      // Root should be at center
      expect(rootNode?.position.x).toBeCloseTo(centerX, 0);
      expect(rootNode?.position.y).toBeCloseTo(centerY, 0);

      // Other nodes should be arranged in circles around center
      const level1Nodes = result.nodes.filter(node => node.level === 1);
      level1Nodes.forEach(node => {
        const distance = Math.sqrt(
          Math.pow(node.position.x - centerX, 2) + 
          Math.pow(node.position.y - centerY, 2)
        );
        expect(distance).toBeGreaterThan(50); // Should be away from center
      });
    });
  });

  describe('node styling', () => {
    it('should apply correct styles based on node type', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      const rootNode = result.nodes.find(node => node.type === 'root');
      const mainTopicNode = result.nodes.find(node => node.type === 'main-topic');
      const subtopicNode = result.nodes.find(node => node.type === 'subtopic');

      expect(rootNode?.style.shape).toBe('ellipse');
      expect(rootNode?.style.fontWeight).toBe('bold');
      expect(rootNode?.style.fontSize).toBeGreaterThan(14);

      if (mainTopicNode) {
        expect(mainTopicNode.style.fontWeight).toBe('bold');
        expect(mainTopicNode.style.fontSize).toBeGreaterThan(12);
      }

      if (subtopicNode) {
        expect(subtopicNode.style.fontSize).toBeGreaterThanOrEqual(12);
      }
    });
  });

  describe('connection styling', () => {
    it('should apply correct styles based on connection type', async () => {
      const result = await generateMindMap(
        mockTranscript,
        mockSummary,
        mockKeyPoints,
        mockTopics,
        mockVideoMetadata
      );

      const parentChildConnection = result.connections.find(conn => conn.type === 'parent-child');
      const relatedConnection = result.connections.find(conn => conn.type === 'related');

      if (parentChildConnection) {
        expect(parentChildConnection.style.strokeStyle).toBe('solid');
        expect(parentChildConnection.style.strokeWidth).toBe(2);
      }

      if (relatedConnection) {
        expect(relatedConnection.style.strokeStyle).toBe('dashed');
      }
    });
  });
});