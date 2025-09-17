import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Alert,
  Button,
  ButtonGroup,
  Chip,
} from '@mui/material';
import { MindMapVisualization } from '../components/mindmap';
import { MindMap } from '../components/mindmap/types';

const demoMindMap: MindMap = {
  id: 'demo-mindmap',
  title: 'Machine Learning Concepts',
  nodes: [
    {
      id: 'root',
      label: 'Machine Learning',
      type: 'root',
      level: 0,
      children: ['supervised', 'unsupervised', 'reinforcement'],
      position: { x: 400, y: 300 },
      size: { width: 150, height: 80 },
      style: {
        backgroundColor: '#e3f2fd',
        borderColor: '#1976d2',
        textColor: '#000000',
        fontSize: 16,
        fontWeight: 'bold',
        shape: 'rectangle',
      },
      content: {
        description: 'Machine learning is a method of data analysis that automates analytical model building.',
        keyPoints: ['Automated learning', 'Pattern recognition', 'Data-driven decisions'],
      },
      metadata: {
        importance: 10,
        complexity: 7,
        confidence: 0.95,
        tags: ['ai', 'ml', 'core'],
        category: 'Core Concept',
      },
    },
    // Add more nodes...
  ],
  connections: [],
  layout: {
    type: 'hierarchical',
    dimensions: { width: 800, height: 600 },
    spacing: { horizontal: 200, vertical: 150 },
    algorithm: 'tree',
  },
  metadata: {
    totalNodes: 1,
    totalConnections: 0,
    maxDepth: 0,
    rootNodeId: 'root',
    createdAt: '2024-01-01T00:00:00Z',
    version: '1.0',
    complexity: 'detailed',
    estimatedViewTime: 10,
  },
  statistics: {
    nodesByType: { root: 1 },
    nodesByLevel: { 0: 1 },
    connectionsByType: {},
    averageNodeComplexity: 7,
    conceptCoverage: 1.0,
  },
};

export const MindMapDemoPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Mind Map Visualization Demo
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Interactive mind map visualization with D3.js integration
      </Alert>

      <Box sx={{ height: '80vh' }}>
        <MindMapVisualization
          mindMap={demoMindMap}
          onNodeClick={setSelectedNode}
          onNodeHover={(node) => console.log('Hovered:', node?.label)}
        />
      </Box>
    </Container>
  );
};