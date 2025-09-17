// Re-export types from the backend service for frontend use
export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main-topic' | 'subtopic' | 'concept' | 'example' | 'definition';
  level: number;
  parentId?: string;
  children: string[];
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
    importance: number;
    complexity: number;
    confidence: number;
    tags: string[];
    category: string;
  };
  // Additional properties for D3 force simulation
  fx?: number | null;
  fy?: number | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface MindMapConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'parent-child' | 'related' | 'example' | 'prerequisite' | 'application';
  label?: string;
  strength: number;
  style: {
    strokeColor: string;
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    arrowType: 'none' | 'arrow' | 'diamond' | 'circle';
  };
  metadata: {
    confidence: number;
    bidirectional: boolean;
    weight: number;
  };
  // Additional properties for D3 force simulation
  source?: MindMapNode | string;
  target?: MindMapNode | string;
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
  algorithm: string;
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
    estimatedViewTime: number;
  };
  statistics: {
    nodesByType: Record<string, number>;
    nodesByLevel: Record<number, number>;
    connectionsByType: Record<string, number>;
    averageNodeComplexity: number;
    conceptCoverage: number;
  };
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
  };
  exportFormats?: {
    svg?: string;
    json: string;
    mermaid?: string;
    graphviz?: string;
  };
}

export interface MindMapViewSettings {
  layoutType: 'hierarchical' | 'radial' | 'network';
  colorScheme: 'default' | 'categorical' | 'importance' | 'difficulty';
  showLabels: boolean;
  showConnections: boolean;
  nodeSize: number;
  animationSpeed: number;
  showMinimap: boolean;
  showLegend: boolean;
}

export interface MindMapInteractionEvent {
  type: 'node-click' | 'node-hover' | 'connection-click' | 'background-click';
  node?: MindMapNode;
  connection?: MindMapConnection;
  position?: { x: number; y: number };
  originalEvent?: Event;
}

export interface MindMapSearchResult {
  node: MindMapNode;
  score: number;
  matchType: 'label' | 'description' | 'tag' | 'content';
  matchText: string;
}

export interface MindMapFilter {
  nodeTypes?: string[];
  categories?: string[];
  importanceRange?: [number, number];
  complexityRange?: [number, number];
  tags?: string[];
  levels?: number[];
}

export interface MindMapExportOptions {
  format: 'svg' | 'png' | 'pdf' | 'json' | 'mermaid' | 'graphviz';
  includeMetadata?: boolean;
  includeStyles?: boolean;
  resolution?: number; // For raster formats
  backgroundColor?: string;
  dimensions?: { width: number; height: number };
}