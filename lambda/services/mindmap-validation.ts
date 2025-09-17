import { logger } from '../shared/logger';

export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main-topic' | 'subtopic' | 'concept' | 'example' | 'detail';
  level: number;
  position?: { x: number; y: number };
  size?: number;
  color?: string;
  description?: string;
  examples?: string[];
  metadata: {
    importance: number;
    complexity: number;
    connections: number;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  type: 'hierarchy' | 'association' | 'dependency' | 'example' | 'contrast';
  label?: string;
  strength: number;
  bidirectional?: boolean;
}

export interface MindMapValidationResult {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  category: 'excellent' | 'good' | 'fair' | 'poor';
  structureAnalysis: {
    hasRoot: boolean;
    isConnected: boolean;
    hasOrphanNodes: boolean;
    depthBalance: number;
    branchingFactor: number;
  };
}

export interface MindMapCollectionValidation {
  isValid: boolean;
  overallScore: number;
  nodeValidation: {
    validNodes: MindMapNode[];
    invalidNodes: Array<{ node: MindMapNode; issues: string[] }>;
  };
  edgeValidation: {
    validEdges: MindMapEdge[];
    invalidEdges: Array<{ edge: MindMapEdge; issues: string[] }>;
  };
  structureValidation: MindMapValidationResult;
  recommendations: string[];
  statistics: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    averageConnections: number;
    nodeTypeDistribution: Record<string, number>;
    edgeTypeDistribution: Record<string, number>;
  };
}

/**
 * Validate the overall structure of a mind map
 */
export function validateMindMapStructure(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): MindMapValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0.5; // Base score

  // Check for root node
  const rootNodes = nodes.filter(node => node.type === 'root');
  const hasRoot = rootNodes.length === 1;
  
  if (!hasRoot) {
    if (rootNodes.length === 0) {
      issues.push('Mind map must have exactly one root node');
      suggestions.push('Add a root node representing the main topic');
    } else {
      issues.push('Mind map has multiple root nodes');
      suggestions.push('Consolidate into a single root node');
    }
    score -= 0.3;
  } else {
    score += 0.2;
  }

  // Check connectivity
  const connectivityResult = analyzeConnectivity(nodes, edges);
  const isConnected = connectivityResult.isConnected;
  const hasOrphanNodes = connectivityResult.orphanNodes.length > 0;

  if (!isConnected) {
    issues.push('Mind map has disconnected components');
    suggestions.push('Ensure all nodes are connected to the main structure');
    score -= 0.2;
  } else {
    score += 0.15;
  }

  if (hasOrphanNodes) {
    issues.push(`Found ${connectivityResult.orphanNodes.length} orphan nodes`);
    suggestions.push('Connect isolated nodes to the main structure');
    score -= 0.1;
  }

  // Analyze depth balance
  const depthAnalysis = analyzeDepthBalance(nodes);
  const depthBalance = depthAnalysis.balance;

  if (depthBalance < 0.3) {
    issues.push('Mind map structure is unbalanced (too deep or too shallow)');
    suggestions.push('Redistribute nodes across levels for better balance');
    score -= 0.1;
  } else if (depthBalance > 0.7) {
    score += 0.1;
  }

  // Analyze branching factor
  const branchingAnalysis = analyzeBranchingFactor(nodes, edges);
  const branchingFactor = branchingAnalysis.averageBranching;

  if (branchingFactor < 1.5) {
    suggestions.push('Consider adding more connections between related concepts');
  } else if (branchingFactor > 6) {
    suggestions.push('Some nodes may be over-connected; consider simplifying');
    score -= 0.05;
  } else {
    score += 0.05;
  }

  // Check node distribution
  const nodeTypeDistribution = analyzeNodeTypeDistribution(nodes);
  if (nodeTypeDistribution.mainTopicRatio < 0.1) {
    suggestions.push('Add more main topic nodes for better organization');
  } else if (nodeTypeDistribution.mainTopicRatio > 0.4) {
    suggestions.push('Consider consolidating some main topics');
  }

  // Check edge quality
  const edgeQuality = analyzeEdgeQuality(edges, nodes);
  score += edgeQuality.score * 0.1;
  
  if (edgeQuality.issues.length > 0) {
    issues.push(...edgeQuality.issues);
    suggestions.push(...edgeQuality.suggestions);
  }

  // Determine category
  let category: MindMapValidationResult['category'];
  if (score >= 0.85) category = 'excellent';
  else if (score >= 0.7) category = 'good';
  else if (score >= 0.5) category = 'fair';
  else category = 'poor';

  const isValid = score >= 0.4 && issues.length < 5;

  logger.debug('Mind map structure validated', {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    score,
    category,
    issuesCount: issues.length,
    isValid,
  });

  return {
    isValid,
    score,
    issues,
    suggestions,
    category,
    structureAnalysis: {
      hasRoot,
      isConnected,
      hasOrphanNodes,
      depthBalance,
      branchingFactor,
    },
  };
}

/**
 * Validate a single mind map node
 */
export function validateMindMapNode(node: MindMapNode): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Validate required fields
  if (!node.id || node.id.trim().length === 0) {
    issues.push('Node must have a valid ID');
  }

  if (!node.label || node.label.trim().length === 0) {
    issues.push('Node must have a label');
  } else if (node.label.length > 100) {
    issues.push('Node label is too long (max 100 characters)');
    suggestions.push('Shorten the label and use description for details');
  } else if (node.label.length < 2) {
    issues.push('Node label is too short');
    suggestions.push('Provide a more descriptive label');
  }

  // Validate node type
  const validTypes = ['root', 'main-topic', 'subtopic', 'concept', 'example', 'detail'];
  if (!validTypes.includes(node.type)) {
    issues.push(`Invalid node type: ${node.type}`);
    suggestions.push(`Use one of: ${validTypes.join(', ')}`);
  }

  // Validate level
  if (node.level < 0 || node.level > 10) {
    issues.push('Node level must be between 0 and 10');
  }

  // Validate metadata
  if (!node.metadata) {
    issues.push('Node must have metadata');
  } else {
    if (node.metadata.importance < 0 || node.metadata.importance > 1) {
      issues.push('Importance must be between 0 and 1');
    }
    if (node.metadata.complexity < 0 || node.metadata.complexity > 1) {
      issues.push('Complexity must be between 0 and 1');
    }
    if (node.metadata.connections < 0) {
      issues.push('Connections count cannot be negative');
    }
  }

  // Validate position if provided
  if (node.position) {
    if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      issues.push('Position coordinates must be numbers');
    }
  }

  // Validate examples if provided
  if (node.examples && node.examples.length > 5) {
    suggestions.push('Consider limiting examples to 5 or fewer');
  }

  const isValid = issues.length === 0;

  return { isValid, issues, suggestions };
}

/**
 * Validate a single mind map edge
 */
export function validateMindMapEdge(
  edge: MindMapEdge,
  nodes: MindMapNode[]
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Validate required fields
  if (!edge.id || edge.id.trim().length === 0) {
    issues.push('Edge must have a valid ID');
  }

  if (!edge.source || edge.source.trim().length === 0) {
    issues.push('Edge must have a source node ID');
  }

  if (!edge.target || edge.target.trim().length === 0) {
    issues.push('Edge must have a target node ID');
  }

  // Check if source and target nodes exist
  const sourceNode = nodes.find(node => node.id === edge.source);
  const targetNode = nodes.find(node => node.id === edge.target);

  if (!sourceNode) {
    issues.push(`Source node '${edge.source}' does not exist`);
  }

  if (!targetNode) {
    issues.push(`Target node '${edge.target}' does not exist`);
  }

  // Validate edge type
  const validTypes = ['hierarchy', 'association', 'dependency', 'example', 'contrast'];
  if (!validTypes.includes(edge.type)) {
    issues.push(`Invalid edge type: ${edge.type}`);
    suggestions.push(`Use one of: ${validTypes.join(', ')}`);
  }

  // Validate strength
  if (edge.strength < 0 || edge.strength > 1) {
    issues.push('Edge strength must be between 0 and 1');
  }

  // Check for self-loops
  if (edge.source === edge.target) {
    issues.push('Edge cannot connect a node to itself');
  }

  // Validate hierarchical relationships
  if (edge.type === 'hierarchy' && sourceNode && targetNode) {
    if (sourceNode.level >= targetNode.level) {
      issues.push('Hierarchical edges should connect from higher to lower levels');
      suggestions.push('Ensure parent nodes are at lower levels than child nodes');
    }
  }

  const isValid = issues.length === 0;

  return { isValid, issues, suggestions };
}

/**
 * Validate a complete mind map collection
 */
export function validateMindMapCollection(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): MindMapCollectionValidation {
  const validNodes: MindMapNode[] = [];
  const invalidNodes: Array<{ node: MindMapNode; issues: string[] }> = [];
  const validEdges: MindMapEdge[] = [];
  const invalidEdges: Array<{ edge: MindMapEdge; issues: string[] }> = [];

  // Validate individual nodes
  nodes.forEach(node => {
    const validation = validateMindMapNode(node);
    if (validation.isValid) {
      validNodes.push(node);
    } else {
      invalidNodes.push({ node, issues: validation.issues });
    }
  });

  // Validate individual edges
  edges.forEach(edge => {
    const validation = validateMindMapEdge(edge, validNodes);
    if (validation.isValid) {
      validEdges.push(edge);
    } else {
      invalidEdges.push({ edge, issues: validation.issues });
    }
  });

  // Validate overall structure
  const structureValidation = validateMindMapStructure(validNodes, validEdges);

  // Calculate overall score
  const nodeValidityRatio = validNodes.length / Math.max(1, nodes.length);
  const edgeValidityRatio = validEdges.length / Math.max(1, edges.length);
  const overallScore = (nodeValidityRatio * 0.4 + edgeValidityRatio * 0.3 + structureValidation.score * 0.3);

  // Generate recommendations
  const recommendations: string[] = [];

  if (invalidNodes.length > nodes.length * 0.2) {
    recommendations.push('High number of invalid nodes - review node generation parameters');
  }

  if (invalidEdges.length > edges.length * 0.2) {
    recommendations.push('High number of invalid edges - check node relationships');
  }

  if (overallScore < 0.6) {
    recommendations.push('Overall mind map quality is low - consider regenerating');
  }

  if (!structureValidation.structureAnalysis.hasRoot) {
    recommendations.push('Add a clear root node representing the main topic');
  }

  if (!structureValidation.structureAnalysis.isConnected) {
    recommendations.push('Ensure all concepts are connected to the main structure');
  }

  // Calculate statistics
  const statistics = calculateMindMapStatistics(validNodes, validEdges);

  const isValid = overallScore >= 0.5 && structureValidation.isValid;

  logger.info('Mind map collection validated', {
    totalNodes: nodes.length,
    validNodes: validNodes.length,
    totalEdges: edges.length,
    validEdges: validEdges.length,
    overallScore,
    isValid,
  });

  return {
    isValid,
    overallScore,
    nodeValidation: { validNodes, invalidNodes },
    edgeValidation: { validEdges, invalidEdges },
    structureValidation,
    recommendations,
    statistics,
  };
}

/**
 * Analyze connectivity of the mind map
 */
function analyzeConnectivity(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): {
  isConnected: boolean;
  orphanNodes: MindMapNode[];
  components: MindMapNode[][];
} {
  if (nodes.length === 0) {
    return { isConnected: true, orphanNodes: [], components: [] };
  }

  const adjacencyList: Record<string, string[]> = {};
  
  // Build adjacency list
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });

  edges.forEach(edge => {
    if (adjacencyList[edge.source] && adjacencyList[edge.target]) {
      adjacencyList[edge.source].push(edge.target);
      adjacencyList[edge.target].push(edge.source); // Treat as undirected for connectivity
    }
  });

  // Find connected components using DFS
  const visited = new Set<string>();
  const components: MindMapNode[][] = [];

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component: MindMapNode[] = [];
      dfsVisit(node.id, adjacencyList, visited, component, nodes);
      components.push(component);
    }
  });

  const isConnected = components.length <= 1;
  const orphanNodes = components.filter(comp => comp.length === 1).flat();

  return { isConnected, orphanNodes, components };
}

/**
 * DFS helper function for connectivity analysis
 */
function dfsVisit(
  nodeId: string,
  adjacencyList: Record<string, string[]>,
  visited: Set<string>,
  component: MindMapNode[],
  allNodes: MindMapNode[]
): void {
  visited.add(nodeId);
  const node = allNodes.find(n => n.id === nodeId);
  if (node) {
    component.push(node);
  }

  adjacencyList[nodeId]?.forEach(neighborId => {
    if (!visited.has(neighborId)) {
      dfsVisit(neighborId, adjacencyList, visited, component, allNodes);
    }
  });
}

/**
 * Analyze depth balance of the mind map
 */
function analyzeDepthBalance(nodes: MindMapNode[]): {
  balance: number;
  maxDepth: number;
  levelDistribution: Record<number, number>;
} {
  const levelDistribution: Record<number, number> = {};
  let maxDepth = 0;

  nodes.forEach(node => {
    levelDistribution[node.level] = (levelDistribution[node.level] || 0) + 1;
    maxDepth = Math.max(maxDepth, node.level);
  });

  // Calculate balance score (0-1, where 1 is perfectly balanced)
  const totalNodes = nodes.length;
  const idealNodesPerLevel = totalNodes / (maxDepth + 1);
  
  let balanceScore = 0;
  for (let level = 0; level <= maxDepth; level++) {
    const actualNodes = levelDistribution[level] || 0;
    const deviation = Math.abs(actualNodes - idealNodesPerLevel) / idealNodesPerLevel;
    balanceScore += Math.max(0, 1 - deviation);
  }
  
  const balance = balanceScore / (maxDepth + 1);

  return { balance, maxDepth, levelDistribution };
}

/**
 * Analyze branching factor of the mind map
 */
function analyzeBranchingFactor(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): {
  averageBranching: number;
  maxBranching: number;
  branchingDistribution: Record<string, number>;
} {
  const branchingCounts: Record<string, number> = {};

  // Count outgoing edges for each node
  nodes.forEach(node => {
    branchingCounts[node.id] = 0;
  });

  edges.forEach(edge => {
    if (branchingCounts[edge.source] !== undefined) {
      branchingCounts[edge.source]++;
    }
  });

  const branchingValues = Object.values(branchingCounts);
  const averageBranching = branchingValues.reduce((sum, count) => sum + count, 0) / branchingValues.length;
  const maxBranching = Math.max(...branchingValues);

  const branchingDistribution: Record<string, number> = {};
  branchingValues.forEach(count => {
    const key = count.toString();
    branchingDistribution[key] = (branchingDistribution[key] || 0) + 1;
  });

  return { averageBranching, maxBranching, branchingDistribution };
}

/**
 * Analyze node type distribution
 */
function analyzeNodeTypeDistribution(nodes: MindMapNode[]): {
  mainTopicRatio: number;
  conceptRatio: number;
  exampleRatio: number;
  distribution: Record<string, number>;
} {
  const distribution: Record<string, number> = {};
  
  nodes.forEach(node => {
    distribution[node.type] = (distribution[node.type] || 0) + 1;
  });

  const total = nodes.length;
  const mainTopicRatio = (distribution['main-topic'] || 0) / total;
  const conceptRatio = (distribution['concept'] || 0) / total;
  const exampleRatio = (distribution['example'] || 0) / total;

  return { mainTopicRatio, conceptRatio, exampleRatio, distribution };
}

/**
 * Analyze edge quality
 */
function analyzeEdgeQuality(
  edges: MindMapEdge[],
  nodes: MindMapNode[]
): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0.5;

  // Check for appropriate edge types
  const hierarchicalEdges = edges.filter(edge => edge.type === 'hierarchy');
  const associationEdges = edges.filter(edge => edge.type === 'association');

  if (hierarchicalEdges.length < edges.length * 0.3) {
    suggestions.push('Consider adding more hierarchical relationships for better structure');
  } else {
    score += 0.1;
  }

  if (associationEdges.length > edges.length * 0.5) {
    suggestions.push('Too many association edges may clutter the mind map');
  }

  // Check edge strength distribution
  const averageStrength = edges.reduce((sum, edge) => sum + edge.strength, 0) / edges.length;
  if (averageStrength < 0.3) {
    suggestions.push('Consider strengthening relationships between concepts');
  } else if (averageStrength > 0.8) {
    suggestions.push('Some relationships may be over-emphasized');
  } else {
    score += 0.1;
  }

  return { score, issues, suggestions };
}

/**
 * Calculate comprehensive mind map statistics
 */
function calculateMindMapStatistics(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  averageConnections: number;
  nodeTypeDistribution: Record<string, number>;
  edgeTypeDistribution: Record<string, number>;
} {
  const nodeTypeDistribution: Record<string, number> = {};
  const edgeTypeDistribution: Record<string, number> = {};

  nodes.forEach(node => {
    nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
  });

  edges.forEach(edge => {
    edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] || 0) + 1;
  });

  const maxDepth = nodes.length > 0 ? Math.max(...nodes.map(node => node.level)) : 0;
  const totalConnections = nodes.reduce((sum, node) => sum + node.metadata.connections, 0);
  const averageConnections = nodes.length > 0 ? totalConnections / nodes.length : 0;

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    maxDepth,
    averageConnections,
    nodeTypeDistribution,
    edgeTypeDistribution,
  };
}