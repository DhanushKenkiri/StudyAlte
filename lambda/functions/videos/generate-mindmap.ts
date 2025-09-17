import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from '../../shared/handler';
import { logger } from '../../shared/logger';
import OpenAI from 'openai';
import { generateMindMap, MindMapOptions, VideoMetadata } from '../../services/mindmap-generation';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);



interface GenerateMindMapRequest {
  userId: string;
  capsuleId: string;
  videoId: string;
  videoUrl: string;
  title?: string;
  options: MindMapOptions;
  transcriptResult?: {
    Payload: {
      transcript: string;
      segments?: Array<{
        text: string;
        start: number;
        duration: number;
      }>;
      language?: string;
    };
  };
  summaryResult?: {
    Payload: {
      summary: string;
      keyPoints: string[];
      topics: string[];
    };
  };
  validationResult?: {
    Payload: {
      metadata: {
        title: string;
        description: string;
        duration: number;
        channelTitle: string;
        tags: string[];
      };
    };
  };
}

interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main-topic' | 'subtopic' | 'concept' | 'example' | 'detail';
  level: number;
  position?: { x: number; y: number };
  size?: number;
  color?: string;
  description?: string;
  examples?: string[];
  sourceSegment?: {
    start: number;
    end: number;
    text: string;
  };
  metadata: {
    importance: number; // 0-1 scale
    complexity: number; // 0-1 scale
    connections: number; // Number of connections
  };
}

interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  type: 'hierarchy' | 'association' | 'dependency' | 'example' | 'contrast';
  label?: string;
  strength: number; // 0-1 scale
  bidirectional?: boolean;
  style?: {
    color?: string;
    thickness?: number;
    pattern?: 'solid' | 'dashed' | 'dotted';
  };
}

interface MindMapResult {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  layout: string;
  metadata: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    conceptClusters: Array<{
      id: string;
      name: string;
      nodeIds: string[];
      color: string;
    }>;
    statistics: {
      nodesByType: Record<string, number>;
      edgesByType: Record<string, number>;
      averageConnections: number;
    };
  };
  visualSettings: {
    dimensions: { width: number; height: number };
    nodeStyles: Record<string, any>;
    edgeStyles: Record<string, any>;
    colorScheme: string[];
  };
}

/**
 * Generate intelligent mind map from video content using AI
 */
async function generateMindMapHandler(event: GenerateMindMapRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting mind map generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
      hasSummary: !!summaryResult?.Payload?.summary,
    });

    // Get content sources
    const transcript = transcriptResult?.Payload?.transcript || '';
    const summary = summaryResult?.Payload?.summary || '';
    const keyPoints = summaryResult?.Payload?.keyPoints || [];
    const topics = summaryResult?.Payload?.topics || [];

    // If no content available, try to get from database
    let contentSources = { transcript, summary, keyPoints, topics };
    if (!transcript && !summary) {
      contentSources = await getContentFromDatabase(userId, capsuleId);
    }

    if (!contentSources.transcript && !contentSources.summary) {
      throw new Error('No content available for mind map generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoTitle = metadata?.title || event.title || 'Unknown Video';

    // Analyze content with Comprehend for additional insights
    const comprehendAnalysis = await analyzeTextWithComprehend(
      contentSources.transcript || contentSources.summary,
      options.language || 'en'
    );

    // Generate mind map using OpenAI
    const mindMapResult = await generateMindMapWithOpenAI(
      contentSources,
      {
        title: videoTitle,
        description: metadata?.description || '',
        channelTitle: metadata?.channelTitle || '',
        duration: metadata?.duration || 0,
      },
      options,
      comprehendAnalysis,
      transcriptResult?.Payload?.segments
    );

    // Store mind map in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.mindMap = :mindMap,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':mindMap': {
          ...mindMapResult,
          generatedAt: new Date().toISOString(),
          videoTitle,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Mind map generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalNodes: mindMapResult.metadata.totalNodes,
      totalEdges: mindMapResult.metadata.totalEdges,
      maxDepth: mindMapResult.metadata.maxDepth,
      layout: mindMapResult.layout,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        mindMap: mindMapResult,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate mind map', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Generate mind map using OpenAI GPT-4
 */
async function generateMindMapWithOpenAI(
  content: {
    transcript: string;
    summary: string;
    keyPoints: string[];
    topics: string[];
  },
  metadata: {
    title: string;
    description: string;
    channelTitle: string;
    duration: number;
  },
  options: GenerateMindMapRequest['options'],
  comprehendAnalysis?: any,
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<MindMapResult> {
  const {
    language = 'en',
    layout = 'hierarchical',
    maxNodes = 50,
    maxDepth = 4,
    includeRelationships = true,
    groupByConcepts = true,
    includeExamples = true,
    colorCoding = true,
  } = options;

  // Extract insights from Comprehend analysis
  let comprehendInsights = '';
  if (comprehendAnalysis) {
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 20);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);
    
    comprehendInsights = `
Key Concepts for Mind Map:
- Important Terms: ${topKeyPhrases.join(', ')}
- Named Entities: ${Object.entries(entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
`;
  }

  // Build the prompt
  const prompt = `
You are an expert knowledge visualization specialist creating mind maps for educational content. Create a comprehensive mind map from the following video content.

Video Information:
- Title: ${metadata.title}
- Channel: ${metadata.channelTitle}
- Duration: ${Math.round(metadata.duration / 60)} minutes

Content Summary:
${content.summary}

Key Points:
${content.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Main Topics:
${content.topics.join(', ')}

${comprehendInsights}

Full Transcript (for reference):
${content.transcript.substring(0, 6000)}${content.transcript.length > 6000 ? '...' : ''}

Please create a mind map in the following JSON format:
{
  "nodes": [
    {
      "id": "unique-node-id",
      "label": "Node label text",
      "type": "root|main-topic|subtopic|concept|example|detail",
      "level": 0-${maxDepth},
      "description": "Detailed description of the concept",
      "examples": ["example1", "example2"],
      "metadata": {
        "importance": 0.0-1.0,
        "complexity": 0.0-1.0,
        "connections": 0
      }
    }
  ],
  "edges": [
    {
      "id": "unique-edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "type": "hierarchy|association|dependency|example|contrast",
      "label": "Relationship description",
      "strength": 0.0-1.0
    }
  ]
}

Requirements:
- Create maximum ${maxNodes} nodes
- Maximum depth of ${maxDepth} levels
- Start with "${metadata.title}" as the root node (level 0)
- Create main topics at level 1
- Add subtopics and concepts at deeper levels
${includeExamples ? '- Include example nodes where relevant' : '- Focus on concepts, avoid example nodes'}
${includeRelationships ? '- Create rich relationships between related concepts' : '- Keep relationships simple and hierarchical'}
${groupByConcepts ? '- Group related concepts together' : '- Distribute concepts evenly'}
- Use clear, concise labels (max 50 characters)
- Importance: 1.0 for root, 0.8-0.9 for main topics, 0.5-0.7 for subtopics, 0.3-0.5 for details
- Complexity: Based on how difficult the concept is to understand
- Ensure all nodes are connected to the graph (no isolated nodes)
- Create meaningful relationships with appropriate types
- Write in ${language === 'en' ? 'English' : language}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert knowledge visualization specialist. Always respond with valid JSON format containing well-structured mind map data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4, // Balanced creativity and consistency
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(responseContent);
    const rawNodes = result.nodes || [];
    const rawEdges = result.edges || [];

    // Process and enhance mind map
    const processedMindMap = await processMindMap(
      rawNodes,
      rawEdges,
      options,
      segments
    );

    return processedMindMap;
  } catch (error) {
    logger.error('OpenAI mind map generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic mind map generation
    return generateFallbackMindMap(content, metadata, options);
  }
}

/**
 * Process and enhance raw mind map data from OpenAI
 */
async function processMindMap(
  rawNodes: any[],
  rawEdges: any[],
  options: GenerateMindMapRequest['options'],
  segments?: Array<{ text: string; start: number; duration: number }>
): Promise<MindMapResult> {
  const processedNodes: MindMapNode[] = [];
  const processedEdges: MindMapEdge[] = [];

  // Process nodes
  rawNodes.forEach((rawNode, index) => {
    if (!rawNode.id || !rawNode.label) {
      logger.warn('Skipping invalid node', { index, node: rawNode });
      return;
    }

    // Find source segment if available
    const sourceSegment = findSourceSegment(rawNode.label + ' ' + (rawNode.description || ''), segments);

    const processedNode: MindMapNode = {
      id: rawNode.id,
      label: rawNode.label.substring(0, 50), // Limit label length
      type: rawNode.type || 'concept',
      level: Math.max(0, Math.min(options.maxDepth || 4, rawNode.level || 1)),
      description: rawNode.description || '',
      examples: Array.isArray(rawNode.examples) ? rawNode.examples.slice(0, 3) : [],
      sourceSegment,
      metadata: {
        importance: Math.max(0, Math.min(1, rawNode.metadata?.importance || 0.5)),
        complexity: Math.max(0, Math.min(1, rawNode.metadata?.complexity || 0.5)),
        connections: 0, // Will be calculated later
      },
    };

    processedNodes.push(processedNode);
  });

  // Process edges
  rawEdges.forEach((rawEdge, index) => {
    if (!rawEdge.id || !rawEdge.source || !rawEdge.target) {
      logger.warn('Skipping invalid edge', { index, edge: rawEdge });
      return;
    }

    // Verify source and target nodes exist
    const sourceExists = processedNodes.some(node => node.id === rawEdge.source);
    const targetExists = processedNodes.some(node => node.id === rawEdge.target);

    if (!sourceExists || !targetExists) {
      logger.warn('Skipping edge with missing nodes', { 
        source: rawEdge.source, 
        target: rawEdge.target,
        sourceExists,
        targetExists 
      });
      return;
    }

    const processedEdge: MindMapEdge = {
      id: rawEdge.id,
      source: rawEdge.source,
      target: rawEdge.target,
      type: rawEdge.type || 'hierarchy',
      label: rawEdge.label || '',
      strength: Math.max(0, Math.min(1, rawEdge.strength || 0.5)),
      bidirectional: rawEdge.bidirectional || false,
    };

    processedEdges.push(processedEdge);
  });

  // Calculate node connections
  processedNodes.forEach(node => {
    const connections = processedEdges.filter(edge => 
      edge.source === node.id || edge.target === node.id
    ).length;
    node.metadata.connections = connections;
  });

  // Apply layout-specific positioning
  const positionedNodes = applyLayout(processedNodes, processedEdges, options.layout || 'hierarchical');

  // Validate mind map structure and quality
  const validationResult = validateMindMapCollection(positionedNodes, processedEdges);
  
  // Use only valid nodes and edges
  const finalNodes = validationResult.nodeValidation.validNodes;
  const finalEdges = validationResult.edgeValidation.validEdges;

  // Apply color coding if requested
  if (options.colorCoding) {
    applyColorCoding(finalNodes, finalEdges);
  }

  // Create concept clusters
  const conceptClusters = createConceptClusters(finalNodes, finalEdges, options.groupByConcepts || false);

  // Calculate statistics
  const statistics = calculateMindMapStatistics(finalNodes, finalEdges);

  // Create visual settings
  const visualSettings = createVisualSettings(options);

  return {
    nodes: finalNodes,
    edges: finalEdges,
    layout: options.layout || 'hierarchical',
    metadata: {
      totalNodes: finalNodes.length,
      totalEdges: finalEdges.length,
      maxDepth: Math.max(...finalNodes.map(node => node.level)),
      conceptClusters,
      statistics,
    },
    visualSettings,
    qualityValidation: {
      totalGenerated: rawNodes.length,
      validNodes: validationResult.nodeValidation.validNodes.length,
      invalidNodes: validationResult.nodeValidation.invalidNodes.length,
      validEdges: validationResult.edgeValidation.validEdges.length,
      invalidEdges: validationResult.edgeValidation.invalidEdges.length,
      overallScore: validationResult.overallScore,
      structureScore: validationResult.structureValidation.score,
      recommendations: validationResult.recommendations,
    },
  };
}

/**
 * Apply layout-specific positioning to nodes
 */
function applyLayout(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  layout: string
): MindMapNode[] {
  const positionedNodes = [...nodes];

  switch (layout) {
    case 'hierarchical':
      applyHierarchicalLayout(positionedNodes);
      break;
    case 'radial':
      applyRadialLayout(positionedNodes);
      break;
    case 'force-directed':
      applyForceDirectedLayout(positionedNodes, edges);
      break;
    case 'circular':
      applyCircularLayout(positionedNodes);
      break;
    default:
      applyHierarchicalLayout(positionedNodes);
  }

  return positionedNodes;
}

/**
 * Apply hierarchical layout positioning
 */
function applyHierarchicalLayout(nodes: MindMapNode[]): void {
  const nodesByLevel: Record<number, MindMapNode[]> = {};
  
  // Group nodes by level
  nodes.forEach(node => {
    if (!nodesByLevel[node.level]) {
      nodesByLevel[node.level] = [];
    }
    nodesByLevel[node.level].push(node);
  });

  // Position nodes level by level
  Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
    const levelNum = parseInt(level);
    const y = levelNum * 150; // Vertical spacing between levels
    const totalWidth = Math.max(800, levelNodes.length * 200);
    const startX = -totalWidth / 2;

    levelNodes.forEach((node, index) => {
      node.position = {
        x: startX + (index + 0.5) * (totalWidth / levelNodes.length),
        y: y,
      };
      
      // Size based on importance
      node.size = 20 + (node.metadata.importance * 30);
    });
  });
}

/**
 * Apply radial layout positioning
 */
function applyRadialLayout(nodes: MindMapNode[]): void {
  const rootNode = nodes.find(node => node.type === 'root');
  if (!rootNode) return;

  rootNode.position = { x: 0, y: 0 };
  rootNode.size = 40;

  const nodesByLevel: Record<number, MindMapNode[]> = {};
  nodes.filter(node => node.type !== 'root').forEach(node => {
    if (!nodesByLevel[node.level]) {
      nodesByLevel[node.level] = [];
    }
    nodesByLevel[node.level].push(node);
  });

  Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
    const levelNum = parseInt(level);
    const radius = levelNum * 120;
    const angleStep = (2 * Math.PI) / levelNodes.length;

    levelNodes.forEach((node, index) => {
      const angle = index * angleStep;
      node.position = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
      node.size = 15 + (node.metadata.importance * 25);
    });
  });
}

/**
 * Apply force-directed layout positioning (simplified)
 */
function applyForceDirectedLayout(nodes: MindMapNode[], edges: MindMapEdge[]): void {
  // Simplified force-directed layout
  // In a real implementation, this would use iterative physics simulation
  
  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    const radius = 100 + (node.level * 80);
    
    node.position = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
    node.size = 15 + (node.metadata.importance * 25);
  });
}

/**
 * Apply circular layout positioning
 */
function applyCircularLayout(nodes: MindMapNode[]): void {
  const radius = Math.max(200, nodes.length * 15);
  const angleStep = (2 * Math.PI) / nodes.length;

  nodes.forEach((node, index) => {
    const angle = index * angleStep;
    node.position = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
    node.size = 15 + (node.metadata.importance * 25);
  });
}

/**
 * Apply color coding to nodes and edges
 */
function applyColorCoding(nodes: MindMapNode[], edges: MindMapEdge[]): void {
  const colorScheme = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Color by type
  const typeColors: Record<string, string> = {
    'root': '#2C3E50',
    'main-topic': '#E74C3C',
    'subtopic': '#3498DB',
    'concept': '#2ECC71',
    'example': '#F39C12',
    'detail': '#9B59B6',
  };

  nodes.forEach(node => {
    node.color = typeColors[node.type] || colorScheme[0];
  });

  // Color edges by type
  const edgeColors: Record<string, string> = {
    'hierarchy': '#34495E',
    'association': '#16A085',
    'dependency': '#E67E22',
    'example': '#F39C12',
    'contrast': '#E74C3C',
  };

  edges.forEach(edge => {
    if (!edge.style) edge.style = {};
    edge.style.color = edgeColors[edge.type] || '#7F8C8D';
    edge.style.thickness = Math.max(1, edge.strength * 3);
  });
}

/**
 * Create concept clusters for grouping related nodes
 */
function createConceptClusters(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  groupByConcepts: boolean
): Array<{ id: string; name: string; nodeIds: string[]; color: string }> {
  if (!groupByConcepts) return [];

  const clusters: Array<{ id: string; name: string; nodeIds: string[]; color: string }> = [];
  const colorScheme = ['#FFE5E5', '#E5F3FF', '#E5FFE5', '#FFF5E5', '#F0E5FF'];

  // Group by main topics (level 1 nodes)
  const mainTopics = nodes.filter(node => node.level === 1);
  
  mainTopics.forEach((mainTopic, index) => {
    const relatedNodes = findRelatedNodes(mainTopic, nodes, edges);
    
    clusters.push({
      id: `cluster-${mainTopic.id}`,
      name: mainTopic.label,
      nodeIds: [mainTopic.id, ...relatedNodes.map(node => node.id)],
      color: colorScheme[index % colorScheme.length],
    });
  });

  return clusters;
}

/**
 * Find nodes related to a given node
 */
function findRelatedNodes(
  targetNode: MindMapNode,
  allNodes: MindMapNode[],
  edges: MindMapEdge[]
): MindMapNode[] {
  const relatedNodeIds = new Set<string>();
  
  // Find directly connected nodes
  edges.forEach(edge => {
    if (edge.source === targetNode.id) {
      relatedNodeIds.add(edge.target);
    } else if (edge.target === targetNode.id) {
      relatedNodeIds.add(edge.source);
    }
  });

  return allNodes.filter(node => relatedNodeIds.has(node.id));
}

/**
 * Calculate mind map statistics
 */
function calculateMindMapStatistics(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): {
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  averageConnections: number;
} {
  const nodesByType = nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const edgesByType = edges.reduce((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalConnections = nodes.reduce((sum, node) => sum + node.metadata.connections, 0);
  const averageConnections = nodes.length > 0 ? totalConnections / nodes.length : 0;

  return {
    nodesByType,
    edgesByType,
    averageConnections,
  };
}

/**
 * Create visual settings for the mind map
 */
function createVisualSettings(options: GenerateMindMapRequest['options']): {
  dimensions: { width: number; height: number };
  nodeStyles: Record<string, any>;
  edgeStyles: Record<string, any>;
  colorScheme: string[];
} {
  return {
    dimensions: { width: 1200, height: 800 },
    nodeStyles: {
      default: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
      },
      root: {
        borderWidth: 3,
        fontSize: 16,
        fontWeight: 'bold',
      },
      'main-topic': {
        fontSize: 14,
        fontWeight: 'bold',
      },
    },
    edgeStyles: {
      default: {
        strokeWidth: 1,
        strokeColor: '#7F8C8D',
      },
      hierarchy: {
        strokeWidth: 2,
        strokeColor: '#34495E',
      },
    },
    colorScheme: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ],
  };
}

/**
 * Find the source segment in transcript that relates to the concept
 */
function findSourceSegment(
  conceptText: string,
  segments?: Array<{ text: string; start: number; duration: number }>
): MindMapNode['sourceSegment'] {
  if (!segments || segments.length === 0) return undefined;

  const conceptWords = conceptText.toLowerCase().split(/\s+/);
  let bestMatch = { segment: segments[0], score: 0 };

  for (const segment of segments) {
    const segmentWords = segment.text.toLowerCase().split(/\s+/);
    const commonWords = conceptWords.filter(word => 
      word.length > 3 && segmentWords.includes(word)
    );
    const score = commonWords.length / Math.max(conceptWords.length, segmentWords.length);

    if (score > bestMatch.score) {
      bestMatch = { segment, score };
    }
  }

  if (bestMatch.score > 0.1) {
    return {
      start: bestMatch.segment.start,
      end: bestMatch.segment.start + bestMatch.segment.duration,
      text: bestMatch.segment.text,
    };
  }

  return undefined;
}

/**
 * Get content from database if not provided in event
 */
async function getContentFromDatabase(userId: string, capsuleId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  const item = result.Item;
  return {
    transcript: item?.learningContent?.transcript?.text || '',
    summary: item?.learningContent?.summary?.summary || '',
    keyPoints: item?.learningContent?.summary?.keyPoints || [],
    topics: item?.learningContent?.summary?.topics || [],
  };
}

/**
 * Generate basic fallback mind map if OpenAI fails
 */
function generateFallbackMindMap(
  content: { transcript: string; summary: string; keyPoints: string[]; topics: string[] },
  metadata: { title: string; description: string },
  options: GenerateMindMapRequest['options']
): MindMapResult {
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];

  // Create root node
  const rootNode: MindMapNode = {
    id: 'root',
    label: metadata.title,
    type: 'root',
    level: 0,
    position: { x: 0, y: 0 },
    size: 40,
    color: '#2C3E50',
    description: metadata.description,
    metadata: {
      importance: 1.0,
      complexity: 0.5,
      connections: 0,
    },
  };
  nodes.push(rootNode);

  // Create topic nodes
  content.topics.forEach((topic, index) => {
    const topicNode: MindMapNode = {
      id: `topic-${index}`,
      label: topic,
      type: 'main-topic',
      level: 1,
      position: { x: (index - content.topics.length / 2) * 200, y: 150 },
      size: 30,
      color: '#E74C3C',
      metadata: {
        importance: 0.8,
        complexity: 0.6,
        connections: 1,
      },
    };
    nodes.push(topicNode);

    // Create edge from root to topic
    edges.push({
      id: `edge-root-topic-${index}`,
      source: 'root',
      target: `topic-${index}`,
      type: 'hierarchy',
      strength: 0.9,
    });
  });

  // Create key point nodes
  content.keyPoints.forEach((keyPoint, index) => {
    if (index < 6) { // Limit to 6 key points
      const keyPointNode: MindMapNode = {
        id: `keypoint-${index}`,
        label: keyPoint.substring(0, 40) + (keyPoint.length > 40 ? '...' : ''),
        type: 'concept',
        level: 2,
        position: { x: (index - 3) * 150, y: 300 },
        size: 20,
        color: '#2ECC71',
        description: keyPoint,
        metadata: {
          importance: 0.6,
          complexity: 0.5,
          connections: 1,
        },
      };
      nodes.push(keyPointNode);

      // Connect to most relevant topic
      const topicIndex = index % content.topics.length;
      edges.push({
        id: `edge-topic-keypoint-${index}`,
        source: `topic-${topicIndex}`,
        target: `keypoint-${index}`,
        type: 'hierarchy',
        strength: 0.7,
      });
    }
  });

  // Update connection counts
  nodes.forEach(node => {
    const connections = edges.filter(edge => 
      edge.source === node.id || edge.target === node.id
    ).length;
    node.metadata.connections = connections;
  });

  return {
    nodes,
    edges,
    layout: options.layout || 'hierarchical',
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxDepth: 2,
      conceptClusters: [],
      statistics: calculateMindMapStatistics(nodes, edges),
    },
    visualSettings: createVisualSettings(options),
  };
}

// Export handler
export const handler = createHandler(generateMindMapHandler);  val
idationResult?: {
    Payload: {
      metadata: {
        title: string;
        description: string;
        duration: number;
        channelTitle: string;
        tags: string[];
      };
    };
  };
}

/**
 * Generate mind map from video content
 */
async function generateMindMapHandler(event: GenerateMindMapRequest) {
  const { userId, capsuleId, videoId, options, transcriptResult, summaryResult, validationResult } = event;

  try {
    logger.info('Starting mind map generation', {
      userId,
      capsuleId,
      videoId,
      options,
      hasTranscript: !!transcriptResult?.Payload?.transcript,
      hasSummary: !!summaryResult?.Payload?.summary,
    });

    // Get content sources
    const transcript = transcriptResult?.Payload?.transcript || '';
    const summary = summaryResult?.Payload?.summary || '';
    const keyPoints = summaryResult?.Payload?.keyPoints || [];
    const topics = summaryResult?.Payload?.topics || [];

    // If no content available, try to get from database
    let contentSources = { transcript, summary, keyPoints, topics };
    if (!transcript && !summary) {
      contentSources = await getContentFromDatabase(userId, capsuleId);
    }

    if (!contentSources.transcript && !contentSources.summary) {
      throw new Error('No content available for mind map generation');
    }

    // Get video metadata
    const metadata = validationResult?.Payload?.metadata;
    const videoMetadata: VideoMetadata = {
      title: metadata?.title || event.title || 'Unknown Video',
      description: metadata?.description || '',
      duration: metadata?.duration || 0,
      channelTitle: metadata?.channelTitle || '',
      tags: metadata?.tags || [],
    };

    // Generate mind map using the service
    const mindMap = await generateMindMap(
      contentSources.transcript,
      contentSources.summary,
      contentSources.keyPoints,
      contentSources.topics,
      videoMetadata,
      options
    );

    // Store mind map in database
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME!,
      Key: {
        PK: `USER#${userId}`,
        SK: `CAPSULE#${capsuleId}`,
      },
      UpdateExpression: `
        SET 
          learningContent.mindMap = :mindMap,
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':mindMap': {
          ...mindMap,
          generatedAt: new Date().toISOString(),
          videoTitle: videoMetadata.title,
          videoId,
        },
        ':updatedAt': new Date().toISOString(),
      },
    }));

    logger.info('Mind map generated successfully', {
      userId,
      capsuleId,
      videoId,
      totalNodes: mindMap.metadata.totalNodes,
      totalConnections: mindMap.metadata.totalConnections,
      maxDepth: mindMap.metadata.maxDepth,
      complexity: mindMap.metadata.complexity,
      validationScore: mindMap.validation.overallScore,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        mindMap,
        videoId,
        capsuleId,
      },
    };
  } catch (error) {
    logger.error('Failed to generate mind map', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      capsuleId,
      videoId,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Get content from database if not provided in event
 */
async function getContentFromDatabase(userId: string, capsuleId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME!,
    Key: {
      PK: `USER#${userId}`,
      SK: `CAPSULE#${capsuleId}`,
    },
  }));

  const item = result.Item;
  return {
    transcript: item?.learningContent?.transcript?.text || '',
    summary: item?.learningContent?.summary?.summary || '',
    keyPoints: item?.learningContent?.summary?.keyPoints || [],
    topics: item?.learningContent?.summary?.topics || [],
  };
}

export const handler = createHandler(generateMindMapHandler);