import {
  validateMindMapStructure,
  validateMindMapNode,
  validateMindMapEdge,
  validateMindMapCollection,
  MindMapNode,
  MindMapEdge,
} from '../mindmap-validation';

describe('Mind Map Validation Service', () => {
  const validRootNode: MindMapNode = {
    id: 'root',
    label: 'Machine Learning',
    type: 'root',
    level: 0,
    position: { x: 0, y: 0 },
    size: 40,
    color: '#2C3E50',
    description: 'Introduction to machine learning concepts',
    metadata: {
      importance: 1.0,
      complexity: 0.5,
      connections: 2,
    },
  };

  const validMainTopicNode: MindMapNode = {
    id: 'topic-1',
    label: 'Neural Networks',
    type: 'main-topic',
    level: 1,
    position: { x: 100, y: 150 },
    size: 30,
    color: '#E74C3C',
    description: 'Computing systems inspired by biological networks',
    metadata: {
      importance: 0.8,
      complexity: 0.7,
      connections: 2,
    },
  };

  const validConceptNode: MindMapNode = {
    id: 'concept-1',
    label: 'Deep Learning',
    type: 'concept',
    level: 2,
    position: { x: 200, y: 300 },
    size: 20,
    color: '#2ECC71',
    description: 'Multiple layers of neural networks',
    examples: ['CNN', 'RNN', 'Transformer'],
    metadata: {
      importance: 0.6,
      complexity: 0.8,
      connections: 1,
    },
  };

  const validHierarchicalEdge: MindMapEdge = {
    id: 'edge-1',
    source: 'root',
    target: 'topic-1',
    type: 'hierarchy',
    label: 'contains',
    strength: 0.9,
  };

  const validAssociationEdge: MindMapEdge = {
    id: 'edge-2',
    source: 'topic-1',
    target: 'concept-1',
    type: 'association',
    label: 'uses',
    strength: 0.7,
  };

  describe('validateMindMapNode', () => {
    it('should validate a well-formed node', () => {
      const result = validateMindMapNode(validRootNode);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const invalidNode = {
        ...validRootNode,
        id: '',
        label: '',
      };

      const result = validateMindMapNode(invalidNode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Node must have a valid ID');
      expect(result.issues).toContain('Node must have a label');
    });

    it('should validate label length constraints', () => {
      const shortLabelNode = {
        ...validRootNode,
        label: 'A',
      };

      const longLabelNode = {
        ...validRootNode,
        label: 'A'.repeat(101),
      };

      const shortResult = validateMindMapNode(shortLabelNode);
      const longResult = validateMindMapNode(longLabelNode);

      expect(shortResult.isValid).toBe(false);
      expect(shortResult.issues).toContain('Node label is too short');

      expect(longResult.isValid).toBe(false);
      expect(longResult.issues).toContain('Node label is too long (max 100 characters)');
      expect(longResult.suggestions).toContain('Shorten the label and use description for details');
    });

    it('should validate node type', () => {
      const invalidTypeNode = {
        ...validRootNode,
        type: 'invalid-type' as any,
      };

      const result = validateMindMapNode(invalidTypeNode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid node type: invalid-type');
      expect(result.suggestions).toContain('Use one of: root, main-topic, subtopic, concept, example, detail');
    });

    it('should validate level constraints', () => {
      const negativeLevelNode = {
        ...validRootNode,
        level: -1,
      };

      const highLevelNode = {
        ...validRootNode,
        level: 11,
      };

      const negativeResult = validateMindMapNode(negativeLevelNode);
      const highResult = validateMindMapNode(highLevelNode);

      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.issues).toContain('Node level must be between 0 and 10');

      expect(highResult.isValid).toBe(false);
      expect(highResult.issues).toContain('Node level must be between 0 and 10');
    });

    it('should validate metadata constraints', () => {
      const invalidMetadataNode = {
        ...validRootNode,
        metadata: {
          importance: 1.5, // Invalid: > 1
          complexity: -0.1, // Invalid: < 0
          connections: -1, // Invalid: < 0
        },
      };

      const result = validateMindMapNode(invalidMetadataNode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Importance must be between 0 and 1');
      expect(result.issues).toContain('Complexity must be between 0 and 1');
      expect(result.issues).toContain('Connections count cannot be negative');
    });

    it('should validate position coordinates', () => {
      const invalidPositionNode = {
        ...validRootNode,
        position: { x: 'invalid' as any, y: 100 },
      };

      const result = validateMindMapNode(invalidPositionNode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Position coordinates must be numbers');
    });

    it('should suggest limiting examples', () => {
      const manyExamplesNode = {
        ...validConceptNode,
        examples: ['Ex1', 'Ex2', 'Ex3', 'Ex4', 'Ex5', 'Ex6'],
      };

      const result = validateMindMapNode(manyExamplesNode);

      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('Consider limiting examples to 5 or fewer');
    });
  });

  describe('validateMindMapEdge', () => {
    const nodes = [validRootNode, validMainTopicNode, validConceptNode];

    it('should validate a well-formed edge', () => {
      const result = validateMindMapEdge(validHierarchicalEdge, nodes);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const invalidEdge = {
        ...validHierarchicalEdge,
        id: '',
        source: '',
        target: '',
      };

      const result = validateMindMapEdge(invalidEdge, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Edge must have a valid ID');
      expect(result.issues).toContain('Edge must have a source node ID');
      expect(result.issues).toContain('Edge must have a target node ID');
    });

    it('should validate node existence', () => {
      const edgeWithMissingNodes = {
        ...validHierarchicalEdge,
        source: 'non-existent-source',
        target: 'non-existent-target',
      };

      const result = validateMindMapEdge(edgeWithMissingNodes, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("Source node 'non-existent-source' does not exist");
      expect(result.issues).toContain("Target node 'non-existent-target' does not exist");
    });

    it('should validate edge type', () => {
      const invalidTypeEdge = {
        ...validHierarchicalEdge,
        type: 'invalid-type' as any,
      };

      const result = validateMindMapEdge(invalidTypeEdge, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid edge type: invalid-type');
      expect(result.suggestions).toContain('Use one of: hierarchy, association, dependency, example, contrast');
    });

    it('should validate strength constraints', () => {
      const invalidStrengthEdge = {
        ...validHierarchicalEdge,
        strength: 1.5,
      };

      const result = validateMindMapEdge(invalidStrengthEdge, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Edge strength must be between 0 and 1');
    });

    it('should detect self-loops', () => {
      const selfLoopEdge = {
        ...validHierarchicalEdge,
        source: 'root',
        target: 'root',
      };

      const result = validateMindMapEdge(selfLoopEdge, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Edge cannot connect a node to itself');
    });

    it('should validate hierarchical relationships', () => {
      const invalidHierarchyEdge = {
        ...validHierarchicalEdge,
        source: 'concept-1', // level 2
        target: 'root', // level 0 - invalid hierarchy
        type: 'hierarchy' as const,
      };

      const result = validateMindMapEdge(invalidHierarchyEdge, nodes);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Hierarchical edges should connect from higher to lower levels');
      expect(result.suggestions).toContain('Ensure parent nodes are at lower levels than child nodes');
    });
  });

  describe('validateMindMapStructure', () => {
    const validNodes = [validRootNode, validMainTopicNode, validConceptNode];
    const validEdges = [validHierarchicalEdge, validAssociationEdge];

    it('should validate a well-structured mind map', () => {
      const result = validateMindMapStructure(validNodes, validEdges);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.category).toBeOneOf(['good', 'excellent']);
      expect(result.structureAnalysis.hasRoot).toBe(true);
      expect(result.structureAnalysis.isConnected).toBe(true);
      expect(result.structureAnalysis.hasOrphanNodes).toBe(false);
    });

    it('should identify missing root node', () => {
      const nodesWithoutRoot = [validMainTopicNode, validConceptNode];

      const result = validateMindMapStructure(nodesWithoutRoot, validEdges);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Mind map must have exactly one root node');
      expect(result.suggestions).toContain('Add a root node representing the main topic');
      expect(result.structureAnalysis.hasRoot).toBe(false);
    });

    it('should identify multiple root nodes', () => {
      const multipleRootNodes = [
        validRootNode,
        { ...validRootNode, id: 'root-2', label: 'Another Root' },
        validMainTopicNode,
      ];

      const result = validateMindMapStructure(multipleRootNodes, validEdges);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Mind map has multiple root nodes');
      expect(result.suggestions).toContain('Consolidate into a single root node');
    });

    it('should identify disconnected components', () => {
      const disconnectedNodes = [
        validRootNode,
        validMainTopicNode,
        { ...validConceptNode, id: 'isolated-node', label: 'Isolated Node' },
      ];
      const limitedEdges = [validHierarchicalEdge]; // Only connects root to topic-1

      const result = validateMindMapStructure(disconnectedNodes, limitedEdges);

      expect(result.structureAnalysis.isConnected).toBe(false);
      expect(result.structureAnalysis.hasOrphanNodes).toBe(true);
      expect(result.issues).toContain('Mind map has disconnected components');
      expect(result.issues).toContain('Found 1 orphan nodes');
      expect(result.suggestions).toContain('Ensure all nodes are connected to the main structure');
    });

    it('should analyze depth balance', () => {
      // Create unbalanced structure (all nodes at level 0)
      const unbalancedNodes = [
        validRootNode,
        { ...validMainTopicNode, level: 0 },
        { ...validConceptNode, level: 0 },
      ];

      const result = validateMindMapStructure(unbalancedNodes, validEdges);

      expect(result.structureAnalysis.depthBalance).toBeLessThan(0.5);
      expect(result.issues).toContain('Mind map structure is unbalanced (too deep or too shallow)');
      expect(result.suggestions).toContain('Redistribute nodes across levels for better balance');
    });

    it('should analyze branching factor', () => {
      // Create high branching structure
      const manyChildNodes = Array.from({ length: 8 }, (_, i) => ({
        ...validConceptNode,
        id: `child-${i}`,
        label: `Child ${i}`,
      }));

      const manyChildEdges = manyChildNodes.map((node, i) => ({
        ...validHierarchicalEdge,
        id: `edge-${i}`,
        source: 'root',
        target: node.id,
      }));

      const highBranchingNodes = [validRootNode, ...manyChildNodes];
      const highBranchingEdges = manyChildEdges;

      const result = validateMindMapStructure(highBranchingNodes, highBranchingEdges);

      expect(result.structureAnalysis.branchingFactor).toBeGreaterThan(6);
      expect(result.suggestions).toContain('Some nodes may be over-connected; consider simplifying');
    });
  });

  describe('validateMindMapCollection', () => {
    const validNodes = [validRootNode, validMainTopicNode, validConceptNode];
    const validEdges = [validHierarchicalEdge, validAssociationEdge];

    it('should validate a complete valid mind map', () => {
      const result = validateMindMapCollection(validNodes, validEdges);

      expect(result.isValid).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0.7);
      expect(result.nodeValidation.validNodes).toHaveLength(3);
      expect(result.nodeValidation.invalidNodes).toHaveLength(0);
      expect(result.edgeValidation.validEdges).toHaveLength(2);
      expect(result.edgeValidation.invalidEdges).toHaveLength(0);
      expect(result.structureValidation.isValid).toBe(true);
    });

    it('should identify invalid nodes and edges', () => {
      const mixedNodes = [
        validRootNode,
        validMainTopicNode,
        {
          ...validConceptNode,
          id: '', // Invalid
          label: '', // Invalid
        },
      ];

      const mixedEdges = [
        validHierarchicalEdge,
        {
          ...validAssociationEdge,
          source: '', // Invalid
          target: 'non-existent', // Invalid
        },
      ];

      const result = validateMindMapCollection(mixedNodes, mixedEdges);

      expect(result.nodeValidation.validNodes).toHaveLength(2);
      expect(result.nodeValidation.invalidNodes).toHaveLength(1);
      expect(result.edgeValidation.validEdges).toHaveLength(1);
      expect(result.edgeValidation.invalidEdges).toHaveLength(1);
      expect(result.overallScore).toBeLessThan(0.8);
    });

    it('should calculate statistics correctly', () => {
      const result = validateMindMapCollection(validNodes, validEdges);

      expect(result.statistics.totalNodes).toBe(3);
      expect(result.statistics.totalEdges).toBe(2);
      expect(result.statistics.maxDepth).toBe(2);
      expect(result.statistics.averageConnections).toBeGreaterThan(0);
      expect(result.statistics.nodeTypeDistribution).toEqual({
        root: 1,
        'main-topic': 1,
        concept: 1,
      });
      expect(result.statistics.edgeTypeDistribution).toEqual({
        hierarchy: 1,
        association: 1,
      });
    });

    it('should provide recommendations for poor quality', () => {
      const poorNodes = Array(10).fill(null).map((_, i) => ({
        ...validRootNode,
        id: `poor-node-${i}`,
        label: '', // Invalid
      }));

      const poorEdges = Array(10).fill(null).map((_, i) => ({
        ...validHierarchicalEdge,
        id: `poor-edge-${i}`,
        source: '', // Invalid
        target: '', // Invalid
      }));

      const result = validateMindMapCollection(poorNodes, poorEdges);

      expect(result.recommendations).toContain('High number of invalid nodes - review node generation parameters');
      expect(result.recommendations).toContain('High number of invalid edges - check node relationships');
      expect(result.recommendations).toContain('Overall mind map quality is low - consider regenerating');
    });

    it('should handle empty mind map', () => {
      const result = validateMindMapCollection([], []);

      expect(result.isValid).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.statistics.totalNodes).toBe(0);
      expect(result.statistics.totalEdges).toBe(0);
    });

    it('should provide structural recommendations', () => {
      const nodesWithoutRoot = [validMainTopicNode, validConceptNode];
      const disconnectedEdges: MindMapEdge[] = []; // No edges = disconnected

      const result = validateMindMapCollection(nodesWithoutRoot, disconnectedEdges);

      expect(result.recommendations).toContain('Add a clear root node representing the main topic');
      expect(result.recommendations).toContain('Ensure all concepts are connected to the main structure');
    });
  });

  describe('connectivity analysis', () => {
    it('should detect connected components correctly', () => {
      const connectedNodes = [validRootNode, validMainTopicNode, validConceptNode];
      const connectedEdges = [
        { ...validHierarchicalEdge, source: 'root', target: 'topic-1' },
        { ...validAssociationEdge, source: 'topic-1', target: 'concept-1' },
      ];

      const result = validateMindMapStructure(connectedNodes, connectedEdges);

      expect(result.structureAnalysis.isConnected).toBe(true);
      expect(result.structureAnalysis.hasOrphanNodes).toBe(false);
    });

    it('should detect orphan nodes', () => {
      const nodesWithOrphan = [
        validRootNode,
        validMainTopicNode,
        { ...validConceptNode, id: 'orphan', label: 'Orphan Node' },
      ];
      const limitedEdges = [validHierarchicalEdge]; // Only connects root to topic-1

      const result = validateMindMapStructure(nodesWithOrphan, limitedEdges);

      expect(result.structureAnalysis.isConnected).toBe(false);
      expect(result.structureAnalysis.hasOrphanNodes).toBe(true);
    });
  });
});