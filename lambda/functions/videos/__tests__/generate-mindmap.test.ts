import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../generate-mindmap';
import { generateMindMap } from '../../../services/mindmap-generation';

// Mock AWS clients
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Mock mind map generation service
jest.mock('../../../services/mindmap-generation');
const mockGenerateMindMap = generateMindMap as jest.MockedFunction<typeof generateMindMap>;

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.OPENAI_API_KEY = 'test-api-key';

describe('Generate Mind Map Lambda Function', () => {
  beforeEach(() => {
    dynamoMock.reset();
    jest.clearAllMocks();
  });

  const mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Machine Learning Basics',
    options: {
      language: 'en',
      layout: 'hierarchical' as const,
      maxNodes: 20,
      maxDepth: 3,
      includeRelationships: true,
      groupByConcepts: true,
      includeExamples: true,
      colorCoding: true,
    },
    transcriptResult: {
      Payload: {
        transcript: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. Neural networks are computing systems inspired by biological neural networks. Deep learning uses multiple layers of neural networks.',
        segments: [
          { text: 'Machine learning is a subset of artificial intelligence', start: 0, duration: 5 },
          { text: 'Neural networks are computing systems', start: 10, duration: 4 },
          { text: 'Deep learning uses multiple layers', start: 20, duration: 3 },
        ],
        language: 'en',
      },
    },
    summaryResult: {
      Payload: {
        summary: 'This video covers machine learning fundamentals, neural networks, and deep learning concepts.',
        keyPoints: [
          'Machine learning enables computers to learn from data',
          'Neural networks are inspired by biological systems',
          'Deep learning uses multiple layers of neural networks',
        ],
        topics: ['Machine Learning', 'Neural Networks', 'Deep Learning'],
      },
    },
    validationResult: {
      Payload: {
        metadata: {
          title: 'Machine Learning Basics',
          description: 'Introduction to ML concepts',
          duration: 600,
          channelTitle: 'Tech Education',
          tags: ['machine learning', 'AI'],
        },
      },
    },
  };

  const mockComprehendResponse = {
    keyPhrases: [
      { Text: 'machine learning', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'artificial intelligence', Score: 0.92, BeginOffset: 30, EndOffset: 53 },
      { Text: 'neural networks', Score: 0.88, BeginOffset: 100, EndOffset: 115 },
      { Text: 'deep learning', Score: 0.85, BeginOffset: 150, EndOffset: 163 },
    ],
    entities: [
      { Text: 'machine learning', Type: 'OTHER', Score: 0.95, BeginOffset: 0, EndOffset: 16 },
      { Text: 'neural networks', Type: 'OTHER', Score: 0.88, BeginOffset: 100, EndOffset: 115 },
    ],
    sentiment: {
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.4, Negative: 0.1, Neutral: 0.5, Mixed: 0.0 },
    },
  };

  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            nodes: [
              {
                id: 'root',
                label: 'Machine Learning Basics',
                type: 'root',
                level: 0,
                description: 'Introduction to machine learning concepts',
                metadata: {
                  importance: 1.0,
                  complexity: 0.5,
                  connections: 3,
                },
              },
              {
                id: 'ml-topic',
                label: 'Machine Learning',
                type: 'main-topic',
                level: 1,
                description: 'AI subset that enables learning from data',
                metadata: {
                  importance: 0.9,
                  complexity: 0.6,
                  connections: 2,
                },
              },
              {
                id: 'nn-topic',
                label: 'Neural Networks',
                type: 'main-topic',
                level: 1,
                description: 'Computing systems inspired by biological networks',
                metadata: {
                  importance: 0.8,
                  complexity: 0.7,
                  connections: 2,
                },
              },
              {
                id: 'dl-concept',
                label: 'Deep Learning',
                type: 'concept',
                level: 2,
                description: 'Multiple layers of neural networks',
                metadata: {
                  importance: 0.7,
                  complexity: 0.8,
                  connections: 1,
                },
              },
            ],
            edges: [
              {
                id: 'edge-root-ml',
                source: 'root',
                target: 'ml-topic',
                type: 'hierarchy',
                strength: 0.9,
              },
              {
                id: 'edge-root-nn',
                source: 'root',
                target: 'nn-topic',
                type: 'hierarchy',
                strength: 0.8,
              },
              {
                id: 'edge-nn-dl',
                source: 'nn-topic',
                target: 'dl-concept',
                type: 'hierarchy',
                strength: 0.7,
              },
            ],
          }),
        },
      },
    ],
  };

  it('should successfully generate mind map with OpenAI and Comprehend', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: mockComprehendResponse.keyPhrases });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: mockComprehendResponse.entities });
    comprehendMock.on(DetectSentimentCommand).resolves(mockComprehendResponse.sentiment);

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.mindMap.nodes).toHaveLength(4);
    expect(result.body.mindMap.edges).toHaveLength(3);
    expect(result.body.mindMap.layout).toBe('hierarchical');
    expect(result.body.mindMap.metadata.totalNodes).toBe(4);
    expect(result.body.mindMap.metadata.totalEdges).toBe(3);

    // Verify mind map structure
    const rootNode = result.body.mindMap.nodes.find((node: any) => node.type === 'root');
    expect(rootNode).toBeDefined();
    expect(rootNode.label).toBe('Machine Learning Basics');
    expect(rootNode.level).toBe(0);

    // Verify positioning was applied
    result.body.mindMap.nodes.forEach((node: any) => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(node.size).toBeGreaterThan(0);
    });

    // Verify color coding was applied
    result.body.mindMap.nodes.forEach((node: any) => {
      expect(node.color).toBeDefined();
    });

    // Verify DynamoDB update was called
    expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
    const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(updateCall.args[0].input.Key.PK).toBe('USER#user-123');
    expect(updateCall.args[0].input.Key.SK).toBe('CAPSULE#capsule-123');
  });

  it('should handle missing content by fetching from database', async () => {
    const eventWithoutContent = {
      ...mockEvent,
      transcriptResult: undefined,
      summaryResult: undefined,
    };

    // Mock DynamoDB get to return capsule with content
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {
          transcript: {
            text: 'Database transcript about machine learning concepts',
          },
          summary: {
            summary: 'Database summary of ML concepts',
            keyPoints: ['Key point from database'],
            topics: ['Database Topic'],
          },
        },
      },
    });

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(eventWithoutContent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);

    // Verify DynamoDB get was called
    expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
  });

  it('should throw error when no content is available', async () => {
    const eventWithoutContent = {
      ...mockEvent,
      transcriptResult: undefined,
      summaryResult: undefined,
    };

    // Mock DynamoDB get to return capsule without content
    dynamoMock.on(GetCommand).resolves({
      Item: {
        learningContent: {},
      },
    });

    await expect(handler(eventWithoutContent)).rejects.toThrow('No content available for mind map generation');
  });

  it('should handle OpenAI API failure with fallback mind map', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: mockComprehendResponse.keyPhrases });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: mockComprehendResponse.entities });
    comprehendMock.on(DetectSentimentCommand).resolves(mockComprehendResponse.sentiment);

    // Mock OpenAI to throw error
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.mindMap.nodes.length).toBeGreaterThan(0);
    expect(result.body.mindMap.edges.length).toBeGreaterThan(0);
    
    // Fallback should have root node
    const rootNode = result.body.mindMap.nodes.find((node: any) => node.type === 'root');
    expect(rootNode).toBeDefined();
    expect(rootNode.label).toBe('Machine Learning Basics');
  });

  it('should respect layout option', async () => {
    const radialEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        layout: 'radial' as const,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(radialEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.mindMap.layout).toBe('radial');

    // Verify radial positioning (root at center, others in circles)
    const rootNode = result.body.mindMap.nodes.find((node: any) => node.type === 'root');
    expect(rootNode.position.x).toBe(0);
    expect(rootNode.position.y).toBe(0);
  });

  it('should respect maxNodes option', async () => {
    const limitedEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        maxNodes: 3,
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(limitedEvent);

    expect(result.statusCode).toBe(200);

    // Verify OpenAI was called with correct max nodes
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('maximum 3 nodes');
  });

  it('should handle different layout types', async () => {
    const layouts = ['hierarchical', 'radial', 'force-directed', 'circular'];

    for (const layout of layouts) {
      const layoutEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          layout: layout as any,
        },
      };

      // Mock Comprehend responses
      comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
      comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
      comprehendMock.on(DetectSentimentCommand).resolves({
        Sentiment: 'NEUTRAL',
        SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
      });

      // Mock OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      // Mock DynamoDB update
      dynamoMock.on(UpdateCommand).resolves({});

      const result = await handler(layoutEvent);

      expect(result.statusCode).toBe(200);
      expect(result.body.mindMap.layout).toBe(layout);

      // All nodes should have positions
      result.body.mindMap.nodes.forEach((node: any) => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });

      // Reset mocks for next iteration
      dynamoMock.reset();
      comprehendMock.reset();
      mockOpenAI.chat.completions.create.mockClear();
    }
  });

  it('should handle invalid OpenAI JSON response', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI to return invalid JSON
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Invalid JSON response' } }],
    } as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    // Should fallback to basic mind map
    expect(result.body.mindMap.nodes.length).toBeGreaterThan(0);
  });

  it('should filter out invalid nodes and edges', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response with some invalid nodes/edges
    const responseWithInvalidData = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              nodes: [
                {
                  id: 'valid-node',
                  label: 'Valid Node',
                  type: 'concept',
                  level: 1,
                  metadata: { importance: 0.8, complexity: 0.6, connections: 1 },
                },
                {
                  // Missing id
                  label: 'Invalid Node',
                  type: 'concept',
                  level: 1,
                  metadata: { importance: 0.5, complexity: 0.5, connections: 0 },
                },
                {
                  id: 'another-valid-node',
                  label: 'Another Valid Node',
                  type: 'root',
                  level: 0,
                  metadata: { importance: 1.0, complexity: 0.5, connections: 1 },
                },
              ],
              edges: [
                {
                  id: 'valid-edge',
                  source: 'another-valid-node',
                  target: 'valid-node',
                  type: 'hierarchy',
                  strength: 0.8,
                },
                {
                  // Missing source
                  id: 'invalid-edge',
                  target: 'valid-node',
                  type: 'hierarchy',
                  strength: 0.5,
                },
              ],
            }),
          },
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(responseWithInvalidData as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.mindMap.nodes).toHaveLength(2); // Only valid nodes
    expect(result.body.mindMap.edges).toHaveLength(1); // Only valid edges
  });

  it('should create concept clusters when groupByConcepts is enabled', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.mindMap.metadata.conceptClusters).toBeDefined();
    expect(Array.isArray(result.body.mindMap.metadata.conceptClusters)).toBe(true);
  });

  it('should respect language option', async () => {
    const spanishEvent = {
      ...mockEvent,
      options: {
        ...mockEvent.options,
        language: 'es',
      },
    };

    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(spanishEvent);

    expect(result.statusCode).toBe(200);

    // Verify Comprehend was called with Spanish language code
    const comprehendCalls = comprehendMock.commandCalls(DetectKeyPhrasesCommand);
    expect(comprehendCalls[0].args[0].input.LanguageCode).toBe('es');

    // Verify OpenAI prompt included Spanish language instruction
    const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(openAICall.messages[1].content).toContain('Write in es');
  });

  it('should calculate statistics correctly', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.mindMap.metadata.statistics).toBeDefined();
    expect(result.body.mindMap.metadata.statistics.nodesByType).toBeDefined();
    expect(result.body.mindMap.metadata.statistics.edgesByType).toBeDefined();
    expect(typeof result.body.mindMap.metadata.statistics.averageConnections).toBe('number');
  });

  it('should include visual settings', async () => {
    // Mock Comprehend responses
    comprehendMock.on(DetectKeyPhrasesCommand).resolves({ KeyPhrases: [] });
    comprehendMock.on(DetectEntitiesCommand).resolves({ Entities: [] });
    comprehendMock.on(DetectSentimentCommand).resolves({
      Sentiment: 'NEUTRAL',
      SentimentScore: { Positive: 0.3, Negative: 0.2, Neutral: 0.5, Mixed: 0.0 },
    });

    // Mock OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

    // Mock DynamoDB update
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body.mindMap.visualSettings).toBeDefined();
    expect(result.body.mindMap.visualSettings.dimensions).toBeDefined();
    expect(result.body.mindMap.visualSettings.nodeStyles).toBeDefined();
    expect(result.body.mindMap.visualSettings.edgeStyles).toBeDefined();
    expect(result.body.mindMap.visualSettings.colorScheme).toBeDefined();
    expect(Array.isArray(result.body.mindMap.visualSettings.colorScheme)).toBe(true);
  });
});  const
 mockEvent = {
    userId: 'user-123',
    capsuleId: 'capsule-123',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Machine Learning Basics',
    options: {
      language: 'en',
      organizationStyle: 'hierarchical' as const,
      maxNodes: 20,
      maxDepth: 3,
      includeExamples: true,
      includeDefinitions: true,
      focusAreas: ['machine learning'],
      complexity: 'detailed' as const,
      colorScheme: 'categorical' as const,
    },
    transcriptResult: {
      Payload: {
        transcript: 'This is a test transcript about machine learning and artificial intelligence.',
        language: 'en',
      },
    },
    summaryResult: {
      Payload: {
        summary: 'Machine learning is a subset of AI that learns from data.',
        keyPoints: [
          'Machine learning is a subset of AI',
          'It learns from data without explicit programming',
          'There are three main types of ML',
        ],
        topics: ['Machine Learning', 'Artificial Intelligence', 'Data Science'],
      },
    },
    validationResult: {
      Payload: {
        metadata: {
          title: 'Introduction to Machine Learning',
          description: 'A comprehensive guide to ML concepts',
          duration: 3600,
          channelTitle: 'Tech Education',
          tags: ['machine learning', 'AI'],
        },
      },
    },
  };

  const mockMindMap = {
    id: 'mindmap-123',
    title: 'Mind Map: Introduction to Machine Learning',
    nodes: [
      {
        id: 'root',
        label: 'Machine Learning',
        type: 'root',
        level: 0,
        children: ['supervised', 'unsupervised'],
        position: { x: 400, y: 100 },
        size: { width: 200, height: 80 },
        style: {
          backgroundColor: '#4A90E2',
          borderColor: '#357ABD',
          textColor: '#FFFFFF',
          fontSize: 16,
          fontWeight: 'bold',
          shape: 'ellipse',
        },
        content: {
          description: 'A subset of artificial intelligence',
        },
        metadata: {
          importance: 10,
          complexity: 5,
          confidence: 1.0,
          tags: ['root'],
          category: 'Main Topic',
        },
      },
      {
        id: 'supervised',
        label: 'Supervised Learning',
        type: 'main-topic',
        level: 1,
        parentId: 'root',
        children: [],
        position: { x: 200, y: 250 },
        size: { width: 180, height: 70 },
        style: {
          backgroundColor: '#7ED321',
          borderColor: '#5BA517',
          textColor: '#FFFFFF',
          fontSize: 14,
          fontWeight: 'bold',
          shape: 'rectangle',
        },
        content: {
          description: 'Learning with labeled data',
          examples: ['Classification', 'Regression'],
        },
        metadata: {
          importance: 9,
          complexity: 6,
          confidence: 0.9,
          tags: ['supervised', 'labeled-data'],
          category: 'ML Types',
        },
      },
    ],
    connections: [
      {
        id: 'pc-supervised',
        sourceId: 'root',
        targetId: 'supervised',
        type: 'parent-child',
        strength: 1.0,
        style: {
          strokeColor: '#333333',
          strokeWidth: 2,
          strokeStyle: 'solid',
          arrowType: 'arrow',
        },
        metadata: {
          confidence: 1.0,
          bidirectional: false,
          weight: 1.0,
        },
      },
    ],
    layout: {
      type: 'hierarchical',
      centerNode: 'root',
      dimensions: { width: 800, height: 600 },
      spacing: { horizontal: 200, vertical: 150 },
      algorithm: 'hierarchical-layout-v1',
    },
    metadata: {
      totalNodes: 2,
      totalConnections: 1,
      maxDepth: 1,
      rootNodeId: 'root',
      createdAt: '2024-01-01T00:00:00Z',
      version: '1.0',
      complexity: 'detailed',
      estimatedViewTime: 1,
    },
    statistics: {
      nodesByType: { root: 1, 'main-topic': 1 },
      nodesByLevel: { 0: 1, 1: 1 },
      connectionsByType: { 'parent-child': 1 },
      averageNodeComplexity: 5.5,
      conceptCoverage: 80,
    },
    validation: {
      isValid: true,
      overallScore: 8.5,
      issues: [],
      suggestions: [],
      metrics: {
        connectivity: 0.9,
        balance: 0.8,
        depth: 0.7,
        coverage: 0.85,
      },
    },
    exportFormats: {
      json: '{"nodes":[],"connections":[],"layout":{}}',
      mermaid: 'graph TD\n    root((Machine Learning))\n    supervised[Supervised Learning]',
      graphviz: 'digraph MindMap {\n    "root" [label="Machine Learning"];\n}',
    },
  };

  describe('successful mind map generation', () => {
    beforeEach(() => {
      mockGenerateMindMap.mockResolvedValue(mockMindMap);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should generate mind map successfully with transcript and summary', async () => {
      const result = await handler(mockEvent);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.mindMap).toEqual(mockMindMap);
      expect(result.body.videoId).toBe(mockEvent.videoId);
      expect(result.body.capsuleId).toBe(mockEvent.capsuleId);
    });

    it('should call generateMindMap with correct parameters', async () => {
      await handler(mockEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        mockEvent.transcriptResult.Payload.transcript,
        mockEvent.summaryResult.Payload.summary,
        mockEvent.summaryResult.Payload.keyPoints,
        mockEvent.summaryResult.Payload.topics,
        {
          title: mockEvent.validationResult.Payload.metadata.title,
          description: mockEvent.validationResult.Payload.metadata.description,
          duration: mockEvent.validationResult.Payload.metadata.duration,
          channelTitle: mockEvent.validationResult.Payload.metadata.channelTitle,
          tags: mockEvent.validationResult.Payload.metadata.tags,
        },
        mockEvent.options
      );
    });

    it('should store mind map in database', async () => {
      await handler(mockEvent);

      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
      const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
      expect(updateCall.args[0].input).toEqual({
        TableName: 'test-table',
        Key: {
          PK: 'USER#user-123',
          SK: 'CAPSULE#capsule-123',
        },
        UpdateExpression: expect.stringContaining('learningContent.mindMap'),
        ExpressionAttributeNames: {
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':mindMap': expect.objectContaining({
            ...mockMindMap,
            generatedAt: expect.any(String),
            videoTitle: mockEvent.validationResult.Payload.metadata.title,
            videoId: mockEvent.videoId,
          }),
          ':updatedAt': expect.any(String),
        },
      });
    });

    it('should handle missing transcript by fetching from database', async () => {
      const eventWithoutTranscript = {
        ...mockEvent,
        transcriptResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          learningContent: {
            transcript: {
              text: 'Database transcript content',
            },
            summary: {
              summary: 'Database summary',
              keyPoints: ['Point 1', 'Point 2'],
              topics: ['Topic 1'],
            },
          },
        },
      });

      await handler(eventWithoutTranscript);

      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        'Database transcript content',
        'Database summary',
        ['Point 1', 'Point 2'],
        ['Topic 1'],
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use event title when metadata title is missing', async () => {
      const eventWithoutMetadataTitle = {
        ...mockEvent,
        validationResult: {
          Payload: {
            metadata: {
              ...mockEvent.validationResult.Payload.metadata,
              title: '',
            },
          },
        },
      };

      await handler(eventWithoutMetadataTitle);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          title: mockEvent.title,
        }),
        expect.any(Object)
      );
    });

    it('should handle missing validation result', async () => {
      const eventWithoutValidation = {
        ...mockEvent,
        validationResult: undefined,
      };

      await handler(eventWithoutValidation);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          title: mockEvent.title,
          description: '',
          duration: 0,
          channelTitle: '',
          tags: [],
        }),
        expect.any(Object)
      );
    });

    it('should handle missing summary result', async () => {
      const eventWithoutSummary = {
        ...mockEvent,
        summaryResult: undefined,
      };

      await handler(eventWithoutSummary);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        '',
        [],
        [],
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when no content is available', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({ Item: {} });

      await expect(handler(eventWithoutContent)).rejects.toThrow(
        'No content available for mind map generation'
      );
    });

    it('should handle mind map generation service errors', async () => {
      mockGenerateMindMap.mockRejectedValue(new Error('Mind map generation failed'));

      await expect(handler(mockEvent)).rejects.toThrow('Mind map generation failed');
    });

    it('should handle database update errors', async () => {
      mockGenerateMindMap.mockResolvedValue(mockMindMap);
      dynamoMock.on(UpdateCommand).rejects(new Error('Database error'));

      await expect(handler(mockEvent)).rejects.toThrow('Database error');
    });

    it('should handle database get errors when fetching content', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).rejects(new Error('Database get error'));

      await expect(handler(eventWithoutContent)).rejects.toThrow('Database get error');
    });
  });

  describe('different mind map options', () => {
    beforeEach(() => {
      mockGenerateMindMap.mockResolvedValue(mockMindMap);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should handle different organization styles', async () => {
      const radialEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          organizationStyle: 'radial' as const,
        },
      };

      await handler(radialEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          organizationStyle: 'radial',
        })
      );
    });

    it('should handle different complexity levels', async () => {
      const comprehensiveEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          complexity: 'comprehensive' as const,
        },
      };

      await handler(comprehensiveEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          complexity: 'comprehensive',
        })
      );
    });

    it('should handle custom max nodes and depth', async () => {
      const customEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          maxNodes: 30,
          maxDepth: 5,
        },
      };

      await handler(customEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          maxNodes: 30,
          maxDepth: 5,
        })
      );
    });

    it('should handle focus areas', async () => {
      const focusEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          focusAreas: ['supervised learning', 'neural networks'],
        },
      };

      await handler(focusEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          focusAreas: ['supervised learning', 'neural networks'],
        })
      );
    });

    it('should handle include/exclude options', async () => {
      const optionsEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          includeExamples: false,
          includeDefinitions: false,
        },
      };

      await handler(optionsEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          includeExamples: false,
          includeDefinitions: false,
        })
      );
    });

    it('should handle color scheme options', async () => {
      const colorEvent = {
        ...mockEvent,
        options: {
          ...mockEvent.options,
          colorScheme: 'importance' as const,
        },
      };

      await handler(colorEvent);

      expect(mockGenerateMindMap).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          colorScheme: 'importance',
        })
      );
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      mockGenerateMindMap.mockResolvedValue(mockMindMap);
      dynamoMock.on(UpdateCommand).resolves({});
    });

    it('should return properly formatted success response', async () => {
      const result = await handler(mockEvent);

      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');
      expect(result.body).toHaveProperty('success', true);
      expect(result.body).toHaveProperty('mindMap');
      expect(result.body).toHaveProperty('videoId');
      expect(result.body).toHaveProperty('capsuleId');
      expect(result.body.mindMap).toEqual(mockMindMap);
    });

    it('should include all mind map properties', async () => {
      const result = await handler(mockEvent);

      expect(result.body.mindMap).toHaveProperty('id');
      expect(result.body.mindMap).toHaveProperty('title');
      expect(result.body.mindMap).toHaveProperty('nodes');
      expect(result.body.mindMap).toHaveProperty('connections');
      expect(result.body.mindMap).toHaveProperty('layout');
      expect(result.body.mindMap).toHaveProperty('metadata');
      expect(result.body.mindMap).toHaveProperty('statistics');
      expect(result.body.mindMap).toHaveProperty('validation');
      expect(result.body.mindMap).toHaveProperty('exportFormats');
    });
  });

  describe('database operations', () => {
    beforeEach(() => {
      mockGenerateMindMap.mockResolvedValue(mockMindMap);
    });

    it('should fetch content from database when not provided', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          learningContent: {
            transcript: {
              text: 'Fetched transcript',
            },
            summary: {
              summary: 'Fetched summary',
              keyPoints: ['Fetched point'],
              topics: ['Fetched topic'],
            },
          },
        },
      });
      dynamoMock.on(UpdateCommand).resolves({});

      await handler(eventWithoutContent);

      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      const getCall = dynamoMock.commandCalls(GetCommand)[0];
      expect(getCall.args[0].input).toEqual({
        TableName: 'test-table',
        Key: {
          PK: 'USER#user-123',
          SK: 'CAPSULE#capsule-123',
        },
      });
    });

    it('should handle empty database response for content', async () => {
      const eventWithoutContent = {
        ...mockEvent,
        transcriptResult: undefined,
        summaryResult: undefined,
      };

      dynamoMock.on(GetCommand).resolves({});

      await expect(handler(eventWithoutContent)).rejects.toThrow(
        'No content available for mind map generation'
      );
    });
  });
});