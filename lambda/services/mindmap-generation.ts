import { bedrockClient } from './bedrock-client';
import { analyzeTextWithComprehend, extractTopKeyPhrases, extractEntitiesByType } from './comprehend';
import { validateMindMapStructure, MindMapValidationResult } from './mindmap-validation';

export interface MindMapOptions {
  language?: string;
  maxNodes?: number;
  maxDepth?: number;
  includeExamples?: boolean;
  includeDefinitions?: boolean;
  organizationStyle?: 'hierarchical' | 'radial' | 'network' | 'timeline';
  focusAreas?: string[];
  complexity?: 'simple' | 'detailed' | 'comprehensive';
  colorScheme?: 'default' | 'categorical' | 'importance' | 'difficulty';
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main-topic' | 'subtopic' | 'concept' | 'example' | 'definition';
  level: number;
  parentId?: string;
  children: string[]; // Array of child node IDs
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    shape: 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';
  };
  content: {
    description?: string;
    examples?: string[];
    definition?: string;
    keyPoints?: string[];
    relatedConcepts?: string[];
  };
  metadata: {
    importance: number; // 1-10 scale
    complexity: number; // 1-10 scale
    confidence: number; // AI confidence in the relationship
    tags: string[];
    category: string;
  };
}

export interface MindMapConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'parent-child' | 'related' | 'example' | 'prerequisite' | 'application';
  label?: string;
  strength: number; // 0-1 scale indicating relationship strength
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    arrowType: 'none' | 'arrow' | 'diamond' | 'circle';
  };
  metadata: {
    confidence: number;
    bidirectional: boolean;
    weight: number; // For layout algorithms
  };
}

export interface MindMapLayout {
  type: 'hierarchical' | 'radial' | 'network' | 'timeline';
  centerNode?: string;
  dimensions: {
    width: number;
    height: number;
  };
  spacing: {
    horizontal: number;
    vertical: number;
    radial?: number;
  };
  algorithm: string; // Layout algorithm used
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  connections: MindMapConnection[];
  layout: MindMapLayout;
  metadata: {
    totalNodes: number;
    totalConnections: number;
    maxDepth: number;
    rootNodeId: string;
    createdAt: string;
    version: string;
    complexity: 'simple' | 'detailed' | 'comprehensive';
    estimatedViewTime: number; // in minutes
  };
  statistics: {
    nodesByType: Record<string, number>;
    nodesByLevel: Record<number, number>;
    connectionsByType: Record<string, number>;
    averageNodeComplexity: number;
    conceptCoverage: number; // Percentage of key concepts covered
  };
  validation: MindMapValidationResult;
  exportFormats: {
    svg?: string;
    json: string;
    mermaid?: string;
    graphviz?: string;
  };
}

export interface VideoMetadata {
  title: string;
  description: string;
  duration: number;
  channelTitle: string;
  tags?: string[];
}

/**
 * Generate mind map from video content using AI and concept extraction
 */
export async function generateMindMap(
  transcript: string,
  summary: string,
  keyPoints: string[],
  topics: string[],
  videoMetadata: VideoMetadata,
  options: MindMapOptions = {}
): Promise<MindMap> {
  const {
    language = 'en',
    maxNodes = 50,
    maxDepth = 4,
    includeExamples = true,
    includeDefinitions = true,
    organizationStyle = 'hierarchical',
    focusAreas = [],
    complexity = 'detailed',
    colorScheme = 'categorical',
  } = options;

  try {
    logger.info('Starting mind map generation', {
      transcriptLength: transcript.length,
      summaryLength: summary.length,
      keyPointsCount: keyPoints.length,
      topicsCount: topics.length,
      videoTitle: videoMetadata.title,
      options,
    });

    // Validate input
    if (!transcript && !summary) {
      throw new Error('Either transcript or summary is required for mind map generation');
    }

    const contentToAnalyze = transcript || summary;
    if (contentToAnalyze.length < 200) {
      throw new Error('Content is too short for meaningful mind map generation');
    }

    // Analyze content with AWS Comprehend for concept extraction
    const comprehendAnalysis = await analyzeTextWithComprehend(contentToAnalyze, language);
    const topKeyPhrases = extractTopKeyPhrases(comprehendAnalysis.keyPhrases, 30);
    const entities = extractEntitiesByType(comprehendAnalysis.entities);

    // Extract concepts and relationships using OpenAI
    const conceptStructure = await extractConceptsAndRelationships(
      {
        transcript,
        summary,
        keyPoints,
        topics,
      },
      videoMetadata,
      {
        keyPhrases: topKeyPhrases,
        entities,
        sentiment: comprehendAnalysis.sentiment,
      },
      options
    );

    // Build mind map nodes and connections
    const { nodes, connections } = await buildMindMapStructure(
      conceptStructure,
      {
        keyPhrases: topKeyPhrases,
        entities,
        topics,
      },
      options
    );

    // Calculate layout
    const layout = calculateMindMapLayout(nodes, connections, organizationStyle);

    // Apply positioning to nodes
    const positionedNodes = applyLayoutToNodes(nodes, connections, layout);

    // Generate unique mind map ID
    const mindMapId = `mindmap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create mind map object
    const mindMap: MindMap = {
      id: mindMapId,
      title: `Mind Map: ${videoMetadata.title}`,
      nodes: positionedNodes,
      connections,
      layout,
      metadata: {
        totalNodes: positionedNodes.length,
        totalConnections: connections.length,
        maxDepth: Math.max(...positionedNodes.map(node => node.level)),
        rootNodeId: positionedNodes.find(node => node.type === 'root')?.id || '',
        createdAt: new Date().toISOString(),
        version: '1.0',
        complexity,
        estimatedViewTime: Math.ceil(positionedNodes.length / 10), // ~10 nodes per minute
      },
      statistics: calculateMindMapStatistics(positionedNodes, connections),
      validation: { isValid: true, issues: [], suggestions: [] }, // Will be set by validation
      exportFormats: {
        json: JSON.stringify({ nodes: positionedNodes, connections, layout }),
      },
    };

    // Validate mind map structure
    const validationResult = await validateMindMapStructure(mindMap, {
      checkConnectivity: true,
      checkBalance: true,
      checkDepth: true,
      maxNodes,
      maxDepth,
    });

    mindMap.validation = validationResult;

    // Generate export formats
    mindMap.exportFormats.mermaid = generateMermaidFormat(mindMap);
    mindMap.exportFormats.graphviz = generateGraphvizFormat(mindMap);

    logger.info('Mind map generation completed', {
      totalNodes: mindMap.metadata.totalNodes,
      totalConnections: mindMap.metadata.totalConnections,
      maxDepth: mindMap.metadata.maxDepth,
      complexity: mindMap.metadata.complexity,
      validationScore: validationResult.overallScore,
    });

    return mindMap;
  } catch (error) {
    logger.error('Failed to generate mind map', {
      error: error instanceof Error ? error.message : 'Unknown error',
      transcriptLength: transcript.length,
      videoTitle: videoMetadata.title,
      options,
    });
    throw error;
  }
}

/**
 * Extract concepts and relationships using OpenAI
 */
async function extractConceptsAndRelationships(
  content: {
    transcript: string;
    summary: string;
    keyPoints: string[];
    topics: string[];
  },
  videoMetadata: VideoMetadata,
  comprehendInsights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    sentiment: any;
  },
  options: MindMapOptions
): Promise<any> {
  const {
    language = 'en',
    maxNodes = 50,
    maxDepth = 4,
    includeExamples = true,
    includeDefinitions = true,
    complexity = 'detailed',
    focusAreas = [],
  } = options;

  // Build insights context
  const insightsContext = `
Content Analysis Insights:
- Key Phrases: ${comprehendInsights.keyPhrases.join(', ')}
- Named Entities: ${Object.entries(comprehendInsights.entities).map(([type, items]) => `${type}: ${items.join(', ')}`).join('; ')}
- Content Sentiment: ${comprehendInsights.sentiment.Sentiment}
`;

  // Build focus context
  const focusContext = focusAreas.length > 0 
    ? `\nSpecial focus areas: ${focusAreas.join(', ')}`
    : '';

  const prompt = `
You are an expert knowledge mapper specializing in creating comprehensive mind maps from educational content. Extract concepts and their relationships from the following video content.

Video Information:
- Title: ${videoMetadata.title}
- Channel: ${videoMetadata.channelTitle}
- Duration: ${Math.round(videoMetadata.duration / 60)} minutes
- Description: ${videoMetadata.description}
- Tags: ${videoMetadata.tags?.join(', ') || 'None'}

Content Summary:
${content.summary}

Key Points:
${content.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Main Topics:
${content.topics.join(', ')}

${insightsContext}${focusContext}

Source Content:
${content.transcript.substring(0, 6000)}${content.transcript.length > 6000 ? '...' : ''}

Please extract concepts and relationships in the following JSON format:
{
  "rootConcept": {
    "label": "Main topic or title",
    "description": "Brief description of the root concept"
  },
  "concepts": [
    {
      "id": "concept-1",
      "label": "Concept name",
      "type": "main-topic|subtopic|concept|example|definition",
      "level": 1,
      "parentId": "parent-concept-id",
      "description": "Detailed description",
      "examples": ["example1", "example2"],
      "definition": "Clear definition if applicable",
      "keyPoints": ["key point 1", "key point 2"],
      "relatedConcepts": ["related-concept-1", "related-concept-2"],
      "importance": 8,
      "complexity": 6,
      "category": "Category name",
      "tags": ["tag1", "tag2"]
    }
  ],
  "relationships": [
    {
      "sourceId": "concept-1",
      "targetId": "concept-2",
      "type": "parent-child|related|example|prerequisite|application",
      "label": "Relationship description",
      "strength": 0.8,
      "bidirectional": false
    }
  ]
}

Mind Map Requirements:
- Maximum nodes: ${maxNodes}
- Maximum depth: ${maxDepth}
- Complexity level: ${complexity}
- Language: ${language === 'en' ? 'English' : language}
${includeExamples ? '- Include relevant examples for concepts' : '- Focus on core concepts without examples'}
${includeDefinitions ? '- Include clear definitions for key terms' : '- Focus on relationships over definitions'}

Concept Extraction Guidelines:
- Start with the main topic as the root concept
- Create a hierarchical structure with clear parent-child relationships
- Include 2-4 main topics at level 1
- Add 2-6 subtopics for each main topic at level 2
- Include specific concepts and examples at deeper levels
- Ensure each concept has a clear, concise label
- Provide meaningful descriptions for complex concepts
- Identify related concepts that aren't in direct hierarchy
- Rate importance (1-10) and complexity (1-10) for each concept
- Use consistent categorization and tagging

Relationship Guidelines:
- Parent-child: Direct hierarchical relationships
- Related: Concepts that are connected but not hierarchical
- Example: Specific instances or applications of concepts
- Prerequisite: Concepts that must be understood first
- Application: How concepts are used or applied
- Rate relationship strength (0-1) based on how closely connected concepts are
- Specify if relationships are bidirectional

Quality Guidelines:
- Ensure comprehensive coverage of the video content
- Create balanced tree structure (avoid too many children for one parent)
- Use clear, educational language appropriate for learning
- Focus on key learning objectives and outcomes
- Maintain logical flow and coherence
- Avoid redundancy while ensuring completeness
`;

  try {
    const systemPrompt = 'You are an expert knowledge mapper and educational content analyzer. Always respond with valid JSON format containing well-structured concept maps.';
    
    const result = await bedrockClient.generateStructuredResponse(
      `${systemPrompt}\n\n${prompt}`,
      JSON.stringify({
        type: 'object',
        properties: {
          concepts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                importance: { type: 'number' },
                connections: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }),
      {
        temperature: 0.3,
        maxTokens: 4000
      }
    );

    if (!result) {
      throw new Error('No response from Bedrock');
    }

    return result;
  } catch (error) {
    logger.error('Bedrock concept extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.transcript.length + content.summary.length,
      options,
    });

    // Fallback to basic concept extraction
    return generateFallbackConceptStructure(content, videoMetadata, options);
  }
}

/**
 * Build mind map structure from extracted concepts
 */
async function buildMindMapStructure(
  conceptStructure: any,
  insights: {
    keyPhrases: string[];
    entities: Record<string, string[]>;
    topics: string[];
  },
  options: MindMapOptions
): Promise<{ nodes: MindMapNode[]; connections: MindMapConnection[] }> {
  const nodes: MindMapNode[] = [];
  const connections: MindMapConnection[] = [];

  // Create root node
  const rootNode: MindMapNode = {
    id: 'root',
    label: conceptStructure.rootConcept?.label || 'Main Topic',
    type: 'root',
    level: 0,
    children: [],
    position: { x: 0, y: 0 }, // Will be calculated by layout
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
      description: conceptStructure.rootConcept?.description || '',
    },
    metadata: {
      importance: 10,
      complexity: 5,
      confidence: 1.0,
      tags: ['root'],
      category: 'Main Topic',
    },
  };
  nodes.push(rootNode);

  // Process concepts from OpenAI response
  const concepts = conceptStructure.concepts || [];
  
  concepts.forEach((concept: any, index: number) => {
    const nodeId = concept.id || `node-${index}`;
    
    const node: MindMapNode = {
      id: nodeId,
      label: concept.label || `Concept ${index + 1}`,
      type: concept.type || 'concept',
      level: Math.max(1, Math.min(4, concept.level || 1)),
      parentId: concept.parentId || 'root',
      children: [],
      position: { x: 0, y: 0 }, // Will be calculated by layout
      size: calculateNodeSize(concept.label, concept.type),
      style: getNodeStyle(concept.type, concept.importance || 5, options.colorScheme),
      content: {
        description: concept.description || '',
        examples: Array.isArray(concept.examples) ? concept.examples : [],
        definition: concept.definition || '',
        keyPoints: Array.isArray(concept.keyPoints) ? concept.keyPoints : [],
        relatedConcepts: Array.isArray(concept.relatedConcepts) ? concept.relatedConcepts : [],
      },
      metadata: {
        importance: Math.max(1, Math.min(10, concept.importance || 5)),
        complexity: Math.max(1, Math.min(10, concept.complexity || 5)),
        confidence: 0.8, // Default confidence
        tags: Array.isArray(concept.tags) ? concept.tags : [],
        category: concept.category || 'General',
      },
    };

    nodes.push(node);

    // Update parent's children array
    const parentNode = nodes.find(n => n.id === node.parentId);
    if (parentNode) {
      parentNode.children.push(nodeId);
    }
  });

  // Process relationships from OpenAI response
  const relationships = conceptStructure.relationships || [];
  
  relationships.forEach((rel: any, index: number) => {
    const connectionId = `conn-${index}`;
    
    const connection: MindMapConnection = {
      id: connectionId,
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      type: rel.type || 'related',
      label: rel.label || '',
      strength: Math.max(0, Math.min(1, rel.strength || 0.5)),
      style: getConnectionStyle(rel.type, rel.strength || 0.5),
      metadata: {
        confidence: 0.8,
        bidirectional: rel.bidirectional || false,
        weight: rel.strength || 0.5,
      },
    };

    // Only add connection if both nodes exist
    const sourceExists = nodes.some(n => n.id === connection.sourceId);
    const targetExists = nodes.some(n => n.id === connection.targetId);
    
    if (sourceExists && targetExists) {
      connections.push(connection);
    }
  });

  // Add parent-child connections for hierarchy
  nodes.forEach(node => {
    if (node.parentId) {
      const parentChildConnection: MindMapConnection = {
        id: `pc-${node.id}`,
        sourceId: node.parentId,
        targetId: node.id,
        type: 'parent-child',
        strength: 1.0,
        style: getConnectionStyle('parent-child', 1.0),
        metadata: {
          confidence: 1.0,
          bidirectional: false,
          weight: 1.0,
        },
      };

      // Avoid duplicate connections
      const exists = connections.some(c => 
        c.sourceId === parentChildConnection.sourceId && 
        c.targetId === parentChildConnection.targetId &&
        c.type === 'parent-child'
      );

      if (!exists) {
        connections.push(parentChildConnection);
      }
    }
  });

  return { nodes, connections };
}

/**
 * Calculate mind map layout
 */
function calculateMindMapLayout(
  nodes: MindMapNode[],
  connections: MindMapConnection[],
  organizationStyle: string
): MindMapLayout {
  const totalNodes = nodes.length;
  const estimatedWidth = Math.max(800, totalNodes * 150);
  const estimatedHeight = Math.max(600, totalNodes * 100);

  return {
    type: organizationStyle as any,
    centerNode: nodes.find(n => n.type === 'root')?.id,
    dimensions: {
      width: estimatedWidth,
      height: estimatedHeight,
    },
    spacing: {
      horizontal: 200,
      vertical: 150,
      radial: organizationStyle === 'radial' ? 100 : undefined,
    },
    algorithm: `${organizationStyle}-layout-v1`,
  };
}

/**
 * Apply layout positioning to nodes
 */
function applyLayoutToNodes(
  nodes: MindMapNode[],
  connections: MindMapConnection[],
  layout: MindMapLayout
): MindMapNode[] {
  const positionedNodes = [...nodes];
  
  switch (layout.type) {
    case 'hierarchical':
      return applyHierarchicalLayout(positionedNodes, layout);
    case 'radial':
      return applyRadialLayout(positionedNodes, layout);
    case 'network':
      return applyNetworkLayout(positionedNodes, connections, layout);
    case 'timeline':
      return applyTimelineLayout(positionedNodes, layout);
    default:
      return applyHierarchicalLayout(positionedNodes, layout);
  }
}

/**
 * Apply hierarchical layout
 */
function applyHierarchicalLayout(nodes: MindMapNode[], layout: MindMapLayout): MindMapNode[] {
  const rootNode = nodes.find(n => n.type === 'root');
  if (!rootNode) return nodes;

  // Position root at center top
  rootNode.position = {
    x: layout.dimensions.width / 2,
    y: 100,
  };

  // Group nodes by level
  const nodesByLevel = new Map<number, MindMapNode[]>();
  nodes.forEach(node => {
    if (!nodesByLevel.has(node.level)) {
      nodesByLevel.set(node.level, []);
    }
    nodesByLevel.get(node.level)!.push(node);
  });

  // Position nodes level by level
  nodesByLevel.forEach((levelNodes, level) => {
    if (level === 0) return; // Root already positioned

    const y = 100 + level * layout.spacing.vertical;
    const totalWidth = (levelNodes.length - 1) * layout.spacing.horizontal;
    const startX = (layout.dimensions.width - totalWidth) / 2;

    levelNodes.forEach((node, index) => {
      node.position = {
        x: startX + index * layout.spacing.horizontal,
        y,
      };
    });
  });

  return nodes;
}

/**
 * Apply radial layout
 */
function applyRadialLayout(nodes: MindMapNode[], layout: MindMapLayout): MindMapNode[] {
  const rootNode = nodes.find(n => n.type === 'root');
  if (!rootNode) return nodes;

  const centerX = layout.dimensions.width / 2;
  const centerY = layout.dimensions.height / 2;

  // Position root at center
  rootNode.position = { x: centerX, y: centerY };

  // Position other nodes in concentric circles
  const nodesByLevel = new Map<number, MindMapNode[]>();
  nodes.forEach(node => {
    if (node.level > 0) {
      if (!nodesByLevel.has(node.level)) {
        nodesByLevel.set(node.level, []);
      }
      nodesByLevel.get(node.level)!.push(node);
    }
  });

  nodesByLevel.forEach((levelNodes, level) => {
    const radius = level * (layout.spacing.radial || 100);
    const angleStep = (2 * Math.PI) / levelNodes.length;

    levelNodes.forEach((node, index) => {
      const angle = index * angleStep;
      node.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  });

  return nodes;
}

/**
 * Apply network layout (simplified force-directed)
 */
function applyNetworkLayout(
  nodes: MindMapNode[],
  connections: MindMapConnection[],
  layout: MindMapLayout
): MindMapNode[] {
  // Simplified network layout - distribute nodes evenly
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  
  const cellWidth = layout.dimensions.width / cols;
  const cellHeight = layout.dimensions.height / rows;

  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    node.position = {
      x: col * cellWidth + cellWidth / 2,
      y: row * cellHeight + cellHeight / 2,
    };
  });

  return nodes;
}

/**
 * Apply timeline layout
 */
function applyTimelineLayout(nodes: MindMapNode[], layout: MindMapLayout): MindMapNode[] {
  // Sort nodes by importance or complexity for timeline
  const sortedNodes = [...nodes].sort((a, b) => b.metadata.importance - a.metadata.importance);
  
  const stepX = layout.dimensions.width / (sortedNodes.length + 1);
  const centerY = layout.dimensions.height / 2;

  sortedNodes.forEach((node, index) => {
    node.position = {
      x: (index + 1) * stepX,
      y: centerY + (index % 2 === 0 ? -50 : 50), // Alternate above/below timeline
    };
  });

  return nodes;
}

/**
 * Helper functions
 */

function calculateNodeSize(label: string, type: string): { width: number; height: number } {
  const baseWidth = 120;
  const baseHeight = 60;
  
  // Adjust size based on label length and type
  const labelLength = label.length;
  const width = Math.max(baseWidth, Math.min(300, baseWidth + labelLength * 8));
  
  const height = type === 'root' ? baseHeight + 20 : 
                 type === 'main-topic' ? baseHeight + 10 : 
                 baseHeight;
  
  return { width, height };
}

function getNodeStyle(type: string, importance: number, colorScheme?: string): MindMapNode['style'] {
  const baseStyle = {
    fontSize: 12,
    fontWeight: 'normal' as const,
    shape: 'rectangle' as const,
  };

  switch (type) {
    case 'root':
      return {
        ...baseStyle,
        backgroundColor: '#4A90E2',
        borderColor: '#357ABD',
        textColor: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        shape: 'ellipse',
      };
    case 'main-topic':
      return {
        ...baseStyle,
        backgroundColor: '#7ED321',
        borderColor: '#5BA517',
        textColor: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
      };
    case 'subtopic':
      return {
        ...baseStyle,
        backgroundColor: '#F5A623',
        borderColor: '#D1890B',
        textColor: '#FFFFFF',
        fontSize: 13,
      };
    case 'concept':
      return {
        ...baseStyle,
        backgroundColor: '#BD10E0',
        borderColor: '#9013FE',
        textColor: '#FFFFFF',
      };
    case 'example':
      return {
        ...baseStyle,
        backgroundColor: '#B8E986',
        borderColor: '#8CC152',
        textColor: '#333333',
        shape: 'diamond',
      };
    case 'definition':
      return {
        ...baseStyle,
        backgroundColor: '#FFD93D',
        borderColor: '#FFC107',
        textColor: '#333333',
        shape: 'hexagon',
      };
    default:
      return {
        ...baseStyle,
        backgroundColor: '#E0E0E0',
        borderColor: '#BDBDBD',
        textColor: '#333333',
      };
  }
}

function getConnectionStyle(type: string, strength: number): MindMapConnection['style'] {
  const baseStyle = {
    strokeWidth: Math.max(1, Math.min(4, strength * 3)),
    strokeStyle: 'solid' as const,
    arrowType: 'arrow' as const,
  };

  switch (type) {
    case 'parent-child':
      return {
        ...baseStyle,
        strokeColor: '#333333',
        strokeWidth: 2,
      };
    case 'related':
      return {
        ...baseStyle,
        strokeColor: '#666666',
        strokeStyle: 'dashed',
      };
    case 'example':
      return {
        ...baseStyle,
        strokeColor: '#8CC152',
        strokeStyle: 'dotted',
      };
    case 'prerequisite':
      return {
        ...baseStyle,
        strokeColor: '#FF6B6B',
        arrowType: 'diamond',
      };
    case 'application':
      return {
        ...baseStyle,
        strokeColor: '#4ECDC4',
      };
    default:
      return {
        ...baseStyle,
        strokeColor: '#999999',
      };
  }
}

function calculateMindMapStatistics(
  nodes: MindMapNode[],
  connections: MindMapConnection[]
): MindMap['statistics'] {
  const nodesByType = nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nodesByLevel = nodes.reduce((acc, node) => {
    acc[node.level] = (acc[node.level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const connectionsByType = connections.reduce((acc, conn) => {
    acc[conn.type] = (acc[conn.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageNodeComplexity = nodes.reduce((sum, node) => sum + node.metadata.complexity, 0) / nodes.length;

  // Simplified concept coverage calculation
  const uniqueCategories = new Set(nodes.map(node => node.metadata.category));
  const conceptCoverage = Math.min(100, (uniqueCategories.size / 8) * 100); // Assume 8 is ideal

  return {
    nodesByType,
    nodesByLevel,
    connectionsByType,
    averageNodeComplexity,
    conceptCoverage,
  };
}

function generateFallbackConceptStructure(
  content: any,
  videoMetadata: VideoMetadata,
  options: MindMapOptions
): any {
  const rootConcept = {
    label: videoMetadata.title,
    description: videoMetadata.description,
  };

  const concepts = [];
  const relationships = [];

  // Create concepts from topics
  content.topics.forEach((topic: string, index: number) => {
    concepts.push({
      id: `topic-${index}`,
      label: topic,
      type: 'main-topic',
      level: 1,
      parentId: 'root',
      description: `Key topic: ${topic}`,
      importance: 8,
      complexity: 5,
      category: topic,
      tags: ['topic'],
    });
  });

  // Create concepts from key points
  content.keyPoints.forEach((point: string, index: number) => {
    const parentTopicIndex = index % content.topics.length;
    concepts.push({
      id: `point-${index}`,
      label: point.substring(0, 50) + (point.length > 50 ? '...' : ''),
      type: 'concept',
      level: 2,
      parentId: `topic-${parentTopicIndex}`,
      description: point,
      importance: 6,
      complexity: 4,
      category: content.topics[parentTopicIndex] || 'General',
      tags: ['key-point'],
    });
  });

  return {
    rootConcept,
    concepts,
    relationships,
  };
}

function generateMermaidFormat(mindMap: MindMap): string {
  let mermaid = 'graph TD\n';
  
  mindMap.nodes.forEach(node => {
    const shape = node.style.shape === 'ellipse' ? '(())' : 
                  node.style.shape === 'diamond' ? '{}' :
                  node.style.shape === 'hexagon' ? '{{}}' : '[]';
    
    mermaid += `    ${node.id}${shape.charAt(0)}${node.label}${shape.charAt(1)}\n`;
  });

  mindMap.connections.forEach(conn => {
    const arrow = conn.style.strokeStyle === 'dashed' ? '-..->' : '-->';
    mermaid += `    ${conn.sourceId} ${arrow} ${conn.targetId}\n`;
  });

  return mermaid;
}

function generateGraphvizFormat(mindMap: MindMap): string {
  let dot = 'digraph MindMap {\n';
  dot += '    rankdir=TB;\n';
  dot += '    node [fontname="Arial"];\n';
  
  mindMap.nodes.forEach(node => {
    const shape = node.style.shape === 'ellipse' ? 'ellipse' : 
                  node.style.shape === 'diamond' ? 'diamond' :
                  node.style.shape === 'hexagon' ? 'hexagon' : 'box';
    
    dot += `    "${node.id}" [label="${node.label}" shape=${shape} fillcolor="${node.style.backgroundColor}" style=filled];\n`;
  });

  mindMap.connections.forEach(conn => {
    const style = conn.style.strokeStyle === 'dashed' ? 'dashed' : 'solid';
    dot += `    "${conn.sourceId}" -> "${conn.targetId}" [style=${style}];\n`;
  });

  dot += '}';
  return dot;
}